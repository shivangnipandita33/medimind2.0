"""MediMind API.

Original routes are preserved:
  GET  /                              welcome
  GET  /medicine                      sample
  POST /add_medicine
  GET  /all_medicines
  PUT  /update_medicine/{id}
  DELETE /delete_medicine/{id}
  GET  /search_medicine/{name}

New routes:
  PATCH /medicine_status/{id}         Take / Snooze / Missed / Pending
  GET   /stats                        dashboard counts
  POST  /ai/ask                       Gemini medicine assistant
  GET   /health
"""
import os
import secrets
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from pathlib import Path

try:  # load backend/.env no matter which folder uvicorn is started from
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
except ImportError:
    pass

import models
from ai import DISCLAIMER, AIError, ask_gemini, gemini_status, scan_prescription
from database import Base, SessionLocal, engine, run_migrations
from schemas import (
    AskRequest,
    FamilyCreate,
    FamilyLogin,
    FamilyUpdate,
    MedicineCreate,
    MedicineUpdate,
    ScanRequest,
    SettingsUpdate,
    SOSCreate,
    StatusUpdate,
)

Base.metadata.create_all(bind=engine)
run_migrations()


def _backfill_pins() -> None:
    db = SessionLocal()
    try:
        for m in db.query(models.FamilyMember).filter((models.FamilyMember.pin == None) | (models.FamilyMember.pin == "")):  # noqa: E711
            m.pin = f"{secrets.randbelow(1_000_000):06d}"
        db.commit()
    finally:
        db.close()


_backfill_pins()

app = FastAPI(title="MediMind API", version="4.0.0")

# Add your deployed frontend URL(s) in backend/.env, comma separated:
#   ALLOWED_ORIGINS=https://medimind.example.com
_EXTRA_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        *_EXTRA_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------------------------------------------- helpers
def _today() -> str:
    return date.today().isoformat()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize(m: models.Medicine) -> dict:
    """Status resets to Pending automatically on a new day."""
    status = m.status if (m.status and m.status_date == _today()) else "Pending"
    return {
        "id": m.id,
        "name": m.name,
        "dosage": m.dosage,
        "time": m.time,
        "status": status,
        "snoozed_until": m.snoozed_until if status == "Snoozed" else None,
        "image_url": m.image_url,
        "notes": m.notes,
    }


def get_or_404(db: Session, medicine_id: int) -> models.Medicine:
    med = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return med


# ------------------------------------------------------------ original routes
@app.get("/")
def home():
    return {"message": "Welcome to MediMind 💊"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/medicine")
def medicine():
    return {"name": "Vitamin D", "time": "8:00 AM", "message": "Take your medicine on time 💊"}


@app.post("/add_medicine")
def add_medicine(payload: MedicineCreate, db: Session = Depends(get_db)):
    med = models.Medicine(
        name=payload.name.strip(),
        dosage=payload.dosage.strip(),
        time=payload.time.strip(),
        image_url=payload.image_url or None,
        notes=payload.notes or None,
        status="Pending",
        status_date=_today(),
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"message": "Medicine added successfully 💊", "medicine": serialize(med)}


@app.get("/all_medicines")
def all_medicines(db: Session = Depends(get_db)):
    meds = db.query(models.Medicine).order_by(models.Medicine.id).all()
    return [serialize(m) for m in meds]


@app.put("/update_medicine/{medicine_id}")
def update_medicine(medicine_id: int, payload: MedicineUpdate, db: Session = Depends(get_db)):
    med = get_or_404(db, medicine_id)
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "dosage", "time"):
        if data.get(field) is not None:
            setattr(med, field, data[field].strip())
    if "image_url" in data:
        med.image_url = data["image_url"] or None
    if "notes" in data:
        med.notes = data["notes"] or None
    db.commit()
    db.refresh(med)
    return {"message": "Medicine updated successfully", "medicine": serialize(med)}


@app.delete("/delete_medicine/{medicine_id}")
def delete_medicine(medicine_id: int, db: Session = Depends(get_db)):
    med = get_or_404(db, medicine_id)
    db.delete(med)
    db.commit()
    return {"message": "Medicine deleted successfully"}


@app.get("/search_medicine/{name}")
def search_medicine(name: str, db: Session = Depends(get_db)):
    results = (
        db.query(models.Medicine).filter(models.Medicine.name.ilike(f"%{name}%")).all()
    )
    if not results:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return [serialize(m) for m in results]


# --------------------------------------------------------------- new routes
@app.patch("/medicine_status/{medicine_id}")
def update_status(medicine_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    med = get_or_404(db, medicine_id)
    med.status = payload.status
    med.status_date = _today()
    if payload.status != "Pending":
        db.add(
            models.DoseLog(
                medicine_id=med.id,
                medicine_name=med.name,
                status=payload.status,
                at=_now_iso(),
            )
        )
    if payload.status == "Snoozed":
        minutes = payload.snooze_minutes or 5
        until = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        med.snoozed_until = until.isoformat()
    else:
        med.snoozed_until = None
    db.commit()
    db.refresh(med)
    return {"message": f"Marked as {payload.status}", "medicine": serialize(med)}


@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    items = [serialize(m) for m in db.query(models.Medicine).all()]
    counts = {s: 0 for s in ("Pending", "Taken", "Snoozed", "Missed")}
    for it in items:
        counts[it["status"]] += 1
    total = len(items)
    adherence = round(counts["Taken"] / total * 100) if total else 0
    return {"total": total, **{k.lower(): v for k, v in counts.items()}, "adherence": adherence}


@app.post("/ai/ask")
async def ai_ask(payload: AskRequest, db: Session = Depends(get_db)):
    meds = [serialize(m) for m in db.query(models.Medicine).all()]
    try:
        answer = await ask_gemini(
            payload.question,
            [t.model_dump() for t in payload.history],
            meds,
            payload.language,
            payload.mode,
        )
    except AIError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return {"answer": answer, "disclaimer": DISCLAIMER}


@app.get("/ai/status")
async def ai_status():
    """Open http://localhost:8000/ai/status to see exactly why the AI is (not) working."""
    return await gemini_status()


# ================================================================= v3 routes
# ---------------------------------------------------------------- settings
PROFILE_FIELDS = (
    "patient_dob", "patient_gender", "blood_group", "conditions", "allergies",
    "doctor_name", "doctor_phone", "address",
)
SETTING_DEFAULTS = {
    "patient_name": "", "language": "en", "emergency_number": "112",
    **{k: "" for k in PROFILE_FIELDS},
}
_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I so it is easy to read out loud


def _patient_id(db: Session) -> str:
    """Created once, then stays the same forever. Example: MM-7K2P9Q"""
    row = db.get(models.Setting, "patient_id")
    if not row:
        row = models.Setting(key="patient_id", value="MM-" + "".join(secrets.choice(_ID_ALPHABET) for _ in range(6)))
        db.add(row)
        db.commit()
    return row.value


def _age(dob: str):
    try:
        b = date.fromisoformat(dob)
    except (TypeError, ValueError):
        return None
    t = date.today()
    years = t.year - b.year - ((t.month, t.day) < (b.month, b.day))
    return years if 0 <= years < 130 else None


def _settings(db: Session) -> dict:
    rows = {r.key: r.value for r in db.query(models.Setting).all()}
    out = {k: rows.get(k, v) for k, v in SETTING_DEFAULTS.items()}
    out["patient_id"] = _patient_id(db)
    out["age"] = _age(out["patient_dob"])
    return out


def _profile(db: Session) -> dict:
    """The patient profile family members can see (no settings they have no use for)."""
    st = _settings(db)
    keys = ("patient_id", "patient_name", "age", "patient_dob", "patient_gender", "blood_group",
            "conditions", "allergies", "doctor_name", "doctor_phone", "address", "emergency_number")
    return {k: st[k] for k in keys}


@app.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return _settings(db)


@app.put("/settings")
def put_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        row = db.get(models.Setting, key)
        if row:
            row.value = value.strip()
        else:
            db.add(models.Setting(key=key, value=value.strip()))
    db.commit()
    return _settings(db)


# ------------------------------------------------------------------ family
def _member(m: models.FamilyMember) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "relation": m.relation,
        "phone": m.phone,
        "language": m.language or "en",
        "access_code": m.access_code,
        "pin": m.pin,
        "photo": m.photo,
    }


def _new_pin() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _new_code(db: Session) -> str:
    while True:
        code = secrets.token_urlsafe(12)
        if not db.query(models.FamilyMember).filter_by(access_code=code).first():
            return code


def _get_member(db: Session, member_id: int) -> models.FamilyMember:
    m = db.get(models.FamilyMember, member_id)
    if not m:
        raise HTTPException(status_code=404, detail="Family member not found")
    return m


@app.get("/family")
def list_family(db: Session = Depends(get_db)):
    return [_member(m) for m in db.query(models.FamilyMember).order_by(models.FamilyMember.id)]


@app.post("/family")
def add_family(payload: FamilyCreate, db: Session = Depends(get_db)):
    m = models.FamilyMember(
        name=payload.name.strip(),
        relation=(payload.relation or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        language=payload.language,
        photo=payload.photo or None,
        access_code=_new_code(db),
        pin=_new_pin(),
        created_at=_now_iso(),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"member": _member(m)}


@app.put("/family/{member_id}")
def update_family(member_id: int, payload: FamilyUpdate, db: Session = Depends(get_db)):
    m = _get_member(db, member_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("name"):
        m.name = data["name"].strip()
    if "relation" in data:
        m.relation = (data["relation"] or "").strip() or None
    if "phone" in data:
        m.phone = (data["phone"] or "").strip() or None
    if data.get("language"):
        m.language = data["language"]
    if "photo" in data:
        m.photo = data["photo"] or None
    db.commit()
    db.refresh(m)
    return {"member": _member(m)}


@app.post("/family/{member_id}/new_link")
def regenerate_link(member_id: int, db: Session = Depends(get_db)):
    """Old link AND old PIN stop working immediately."""
    m = _get_member(db, member_id)
    m.access_code = _new_code(db)
    m.pin = _new_pin()
    db.commit()
    db.refresh(m)
    return {"member": _member(m)}


@app.delete("/family/{member_id}")
def delete_family(member_id: int, db: Session = Depends(get_db)):
    db.delete(_get_member(db, member_id))
    db.commit()
    return {"message": "Family member removed"}


def _sos(e: models.SOSEvent) -> dict:
    return {
        "id": e.id,
        "created_at": e.created_at,
        "status": e.status,
        "latitude": e.latitude,
        "longitude": e.longitude,
        "message": e.message,
    }


def _overview(db: Session) -> dict:
    """Everything the family dashboard shows (read-only)."""
    items = [serialize(m) for m in db.query(models.Medicine).order_by(models.Medicine.id)]
    counts = {s: 0 for s in ("Pending", "Taken", "Snoozed", "Missed")}
    for it in items:
        counts[it["status"]] += 1
    total = len(items)
    logs = db.query(models.DoseLog).order_by(models.DoseLog.id.desc()).limit(15).all()
    sos = db.query(models.SOSEvent).order_by(models.SOSEvent.id.desc()).limit(5).all()
    return {
        "patient_name": _settings(db)["patient_name"],
        "profile": _profile(db),
        "stats": {
            "total": total,
            **{k.lower(): v for k, v in counts.items()},
            "adherence": round(counts["Taken"] / total * 100) if total else 0,
        },
        "medicines": [
            {k: it[k] for k in ("id", "name", "dosage", "time", "status", "image_url")} for it in items
        ],
        "activity": [
            {"id": l.id, "medicine": l.medicine_name, "status": l.status, "at": l.at} for l in logs
        ],
        "sos": [_sos(e) for e in sos],
        "generated_at": _now_iso(),
    }


@app.get("/family/overview")
def family_overview(db: Session = Depends(get_db)):
    return _overview(db)


@app.get("/family/view/{code}")
def family_view(code: str, db: Session = Depends(get_db)):
    """Read-only dashboard for a family member, authorised by their private link code."""
    if not db.query(models.FamilyMember).filter_by(access_code=code).first():
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    return _overview(db)


# ------------------------------------------------------------ family login
_FAILS: dict = {}  # "ip:<addr>" / "all" -> [timestamps of failed logins]; in-memory brute-force guard
_MAX_FAILS_IP, _MAX_FAILS_ALL, _WINDOW = 6, 30, 600


def _recent_fails(key: str, now: float) -> list:
    return [t for t in _FAILS.get(key, []) if now - t < _WINDOW]


@app.post("/family/login")
def family_login(payload: FamilyLogin, request: Request, db: Session = Depends(get_db)):
    """A family member logs in with the Patient ID + the 6-digit PIN the patient gave them.
    Failed attempts are limited per IP address AND across the whole server, so guessing
    different Patient IDs or PINs does not get around the limit."""
    ip_key = f"ip:{request.client.host if request.client else '?'}"
    now = datetime.now(timezone.utc).timestamp()
    ip_fails, all_fails = _recent_fails(ip_key, now), _recent_fails("all", now)
    if len(ip_fails) >= _MAX_FAILS_IP or len(all_fails) >= _MAX_FAILS_ALL:
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Please wait 10 minutes and try again.")

    pid = "".join(payload.patient_id.upper().split())
    pin = "".join(payload.pin.split())
    ok = secrets.compare_digest(pid.encode(), _patient_id(db).encode())  # bytes: str would crash on non-ASCII
    member = None
    if ok:
        for m in db.query(models.FamilyMember).all():
            if m.pin and secrets.compare_digest(m.pin.encode(), pin.encode()):
                member = m
                break
    if not member:
        _FAILS[ip_key] = ip_fails + [now]
        _FAILS["all"] = all_fails + [now]
        raise HTTPException(status_code=401, detail="Wrong Patient ID or PIN. Ask the patient for the correct details.")

    _FAILS.pop(ip_key, None)
    return {"access_code": member.access_code, "member": {"name": member.name, "relation": member.relation}}


# --------------------------------------------------------------------- SOS
async def _post_webhook(payload: dict) -> None:
    """Optional: forward the alert to a service you control (Twilio function, ntfy, Zapier, n8n ...)."""
    url = os.getenv("SOS_WEBHOOK_URL")
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except httpx.HTTPError:
        pass


@app.post("/sos")
def trigger_sos(payload: SOSCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    event = models.SOSEvent(
        created_at=_now_iso(),
        status="Active",
        latitude=payload.latitude,
        longitude=payload.longitude,
        message=(payload.message or "").strip() or None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    settings = _settings(db)
    family = [_member(m) for m in db.query(models.FamilyMember).order_by(models.FamilyMember.id)]
    maps = (
        f"https://maps.google.com/?q={event.latitude},{event.longitude}"
        if event.latitude is not None and event.longitude is not None
        else None
    )
    background.add_task(
        _post_webhook,
        {
            "type": "sos",
            "patient_name": settings["patient_name"],
            "created_at": event.created_at,
            "maps_link": maps,
            "family": [{"name": f["name"], "phone": f["phone"], "language": f["language"]} for f in family],
        },
    )
    return {
        "event": _sos(event),
        "patient_name": settings["patient_name"],
        "emergency_number": settings["emergency_number"],
        "family": [{k: f[k] for k in ("id", "name", "relation", "phone", "language")} for f in family],
    }


@app.get("/sos")
def list_sos(db: Session = Depends(get_db)):
    rows = db.query(models.SOSEvent).order_by(models.SOSEvent.id.desc()).limit(20).all()
    return [_sos(e) for e in rows]


@app.patch("/sos/{event_id}/resolve")
def resolve_sos(event_id: int, db: Session = Depends(get_db)):
    e = db.get(models.SOSEvent, event_id)
    if not e:
        raise HTTPException(status_code=404, detail="SOS event not found")
    e.status = "Resolved"
    e.resolved_at = _now_iso()
    db.commit()
    return {"event": _sos(e)}


# ------------------------------------------------------------ prescription
@app.post("/scan_prescription")
async def scan_rx(payload: ScanRequest):
    """Reads a prescription photo and returns *suggested* medicines. Nothing is saved until the
    user reviews and confirms them in the app."""
    try:
        medicines = await scan_prescription(payload.image)
    except AIError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return {"medicines": medicines, "disclaimer": DISCLAIMER}
