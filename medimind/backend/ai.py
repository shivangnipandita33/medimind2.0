"""Google Gemini 2.5 Flash integration (REST, no extra SDK needed)."""
import json
import os
import re
from typing import List

import httpx

# The key and model are read at CALL time (not import time) so editing backend/.env and restarting
# always takes effect, and so a missing/late-loaded .env can't silently freeze an empty value.
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
# Newest first. Retired models (404 "no longer available") are skipped automatically.
FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]


def _api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")


def _models() -> List[str]:
    first = (os.getenv("GEMINI_MODEL") or "").strip()
    order = ([first] if first else []) + FALLBACK_MODELS
    seen, out = set(), []
    for m in order:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out

DISCLAIMER = (
    "MediMind's AI answers are informational only and are not a replacement "
    "for professional medical advice. Always consult a doctor or pharmacist."
)

SYSTEM_PROMPT = """You are MediMind Assistant, a careful medicine information helper.
Rules:
- Give clear, general, factual information about medicines (uses, common side effects, how/when they are usually taken, common precautions).
- NEVER invent facts. If you are not sure, or the medicine is unfamiliar, say you are not sure and suggest asking a pharmacist or doctor.
- NEVER diagnose, and NEVER tell the user to change, stop, or double a dose. For dosing decisions, always refer them to their doctor or pharmacist.
- For emergencies (overdose, severe allergic reaction, chest pain, trouble breathing) tell them to contact local emergency services immediately.
- Reply in plain text only: short paragraphs or simple lines starting with "-". Do not use markdown symbols like ** or #.
- Keep answers concise (under 180 words).
"""


class AIError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


DOCTOR_PROMPT = """You are MediMind Doctor Assistant: a calm health-information guide, NOT a doctor.
Rules:
- Help the person understand symptoms in general terms, what commonly causes them, simple home-care steps that are generally safe, and what questions to ask their doctor.
- NEVER give a diagnosis and NEVER name a prescription medicine or dose to take. Do not tell them to stop or change a prescribed medicine.
- Always end with a clear urgency line, exactly one of: "Urgency: emergency - call emergency services now", "Urgency: see a doctor within 24 hours", "Urgency: see a doctor soon", or "Urgency: home care is usually fine, but see a doctor if it gets worse".
- Red flags (chest pain, trouble breathing, signs of stroke, severe bleeding, fainting, confusion, thoughts of self-harm, severe allergic reaction, high fever in a baby) -> urgency is emergency.
- If a question about their own medicines is asked, use the medicine list provided and mention possible interactions only as "ask your pharmacist or doctor to check".
- Reply in plain text only: short paragraphs or lines starting with "-". No markdown symbols like ** or #.
- Keep answers under 220 words.
"""


def _explain(status: int, body: str) -> str:
    """Turn a Gemini HTTP error into something the user can act on."""
    try:
        msg = json.loads(body)["error"]["message"]
    except Exception:  # noqa: BLE001
        msg = body[:200]
    low = msg.lower()
    if status == 400 and ("api key" in low or "api_key" in low):
        return "Your Gemini API key is not valid. Create a new key at https://aistudio.google.com/apikey and paste it in backend/.env (GEMINI_API_KEY=...), then restart the backend."
    if status == 403:
        if "leaked" in low:
            return "Google disabled this Gemini key because it was exposed publicly. Create a new key at https://aistudio.google.com/apikey and put it in backend/.env."
        return f"Gemini refused the request (403): {msg}. Check the key is for Google AI Studio and the Generative Language API is allowed."
    if status == 429:
        return "Gemini free-tier limit reached (too many requests). Wait a minute and try again."
    if status == 404:
        return f"Model not found: {msg}"
    return f"Gemini error {status}: {msg}"


async def _call_gemini(payload: dict, timeout: float = 30, thinking_off: bool = True) -> str:
    """POST to Gemini, trying fallback models. Returns the response text or raises AIError."""
    key = _api_key()
    if not key:
        raise AIError("GEMINI_API_KEY is not set. Copy backend/.env.example to backend/.env, paste your key, and restart the backend.", 503)

    last = AIError("Gemini did not respond.")
    tried: List[str] = []  # one line per failed model, so the final error shows EVERY reason
    for model in _models():
        body = json.loads(json.dumps(payload))  # deep copy per attempt
        cfg = body.setdefault("generationConfig", {})
        # Gemini 2.5 "thinks" by default and thinking tokens eat maxOutputTokens, which used to
        # produce EMPTY answers. Turn it off for these short tasks (only 2.5 models accept the field).
        if thinking_off and "2.5" in model:
            cfg["thinkingConfig"] = {"thinkingBudget": 0}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    f"{GEMINI_BASE}/{model}:generateContent", json=body, headers={"x-goog-api-key": key}
                )
        except httpx.HTTPError as exc:
            last = AIError(f"Could not reach Gemini ({exc.__class__.__name__}). Check the server's internet connection.")
            tried.append(f"{model}: network error {exc.__class__.__name__}")
            continue

        if res.status_code != 200:
            last = AIError(_explain(res.status_code, res.text), 502 if res.status_code != 429 else 429)
            tried.append(f"{model}: HTTP {res.status_code}")
            print(f"[gemini] {model} failed: {res.status_code} {res.text[:300]}")
            if res.status_code in (400, 401, 403):  # bad key: other models won't help
                if "api key" in res.text.lower() or res.status_code in (401, 403):
                    raise last
            continue

        try:
            data = res.json()
        except ValueError:
            last = AIError("Gemini returned an unreadable response.")
            continue
        cands = data.get("candidates") or []
        if not cands:
            reason = (data.get("promptFeedback") or {}).get("blockReason")
            last = AIError(f"Gemini blocked this request ({reason})." if reason else "Gemini returned no answer.")
            continue
        parts = (cands[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if text:
            return text
        last = AIError("Gemini returned an empty answer. Please rephrase and try again.")
        tried.append(f"{model}: empty answer")
    if len(tried) > 1:
        last = AIError(f"{last.message} (tried: {'; '.join(tried)})", last.status_code)
    raise last


async def gemini_status() -> dict:
    """Diagnostic used by GET /ai/status so you can see exactly why the AI is not working."""
    key = _api_key()
    out = {"key_set": bool(key), "key_hint": (key[:4] + "…" + key[-3:]) if len(key) > 8 else None, "models": _models(), "ok": False}
    if not key:
        out["error"] = "GEMINI_API_KEY is not set in backend/.env"
        return out
    try:
        text = await _call_gemini(
            {"contents": [{"role": "user", "parts": [{"text": "Reply with the single word: ok"}]}],
             "generationConfig": {"maxOutputTokens": 20, "temperature": 0}},
            timeout=20,
        )
        out.update(ok=True, reply=text[:40])
    except AIError as err:
        out["error"] = err.message
    return out


LANG_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "es": "Spanish"}


async def ask_gemini(
    question: str, history: List[dict], medicines: List[dict], language: str = "en", mode: str = "medicine"
) -> str:
    context = ""
    if medicines:
        lines = [f"- {m['name']} ({m['dosage']}) at {m['time']}" for m in medicines[:30]]
        context = "\n\nThe user's current medicine list:\n" + "\n".join(lines)

    if language != "en" and language in LANG_NAMES:
        context += f"\n\nAlways reply in {LANG_NAMES[language]}, using simple everyday words."

    contents = [
        {"role": "user" if t["role"] == "user" else "model", "parts": [{"text": t["text"]}]}
        for t in history[-6:]
    ]
    # Gemini requires the first turn to be from the user.
    while contents and contents[0]["role"] != "user":
        contents.pop(0)
    contents.append({"role": "user", "parts": [{"text": question}]})

    payload = {
        "systemInstruction": {"parts": [{"text": (DOCTOR_PROMPT if mode == "doctor" else SYSTEM_PROMPT) + context}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1500},
    }
    return await _call_gemini(payload, timeout=30)


# --------------------------------------------------------- prescription scan
SCAN_PROMPT = """You read photos of medical prescriptions for a medicine-reminder app.
Return ONLY a JSON object, no markdown:
{"medicines":[{"name":string,"dosage":string,"times":["HH:MM"],"notes":string|null,"uncertain":boolean}]}
Rules:
- Include only medicines you can actually read. NEVER guess or invent a medicine, strength or dose.
- "name": the medicine name as written (brand or generic). "dosage": strength and amount, e.g. "500 mg, 1 tablet".
- "times": 24-hour clock times the dose should be taken each day, from the frequency:
  once daily / OD -> ["08:00"]; twice daily / BD / BID -> ["08:00","20:00"];
  three times / TDS / TID -> ["08:00","14:00","21:00"]; four times / QID -> ["08:00","12:00","16:00","20:00"];
  at night / HS -> ["21:00"]; morning only -> ["08:00"]. If a time is written explicitly, use it.
  If the frequency is unreadable, use [] .
- "notes": short instructions such as "after food" or "for 5 days", else null.
- "uncertain": true if the name, dose or frequency was hard to read or you were unsure.
- If the image is not a prescription or nothing is readable, return {"medicines":[]}.
- Ignore doctor, patient and clinic details."""

_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
_DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$")


def _clean_scan(raw) -> List[dict]:
    items = raw.get("medicines") if isinstance(raw, dict) else raw
    out = []
    for it in (items or [])[:20]:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name") or "").strip()[:120]
        if not name:
            continue
        times = []
        for t in it.get("times") or []:
            m = _TIME_RE.match(str(t).strip())
            if m:
                times.append(f"{int(m.group(1)):02d}:{m.group(2)}")
        times = sorted(set(times))[:6]
        notes = str(it.get("notes") or "").strip()[:300] or None
        out.append(
            {
                "name": name,
                "dosage": str(it.get("dosage") or "").strip()[:120],
                "times": times or ["08:00"],
                "notes": notes,
                "uncertain": bool(it.get("uncertain")) or not times,
            }
        )
    return out


async def scan_prescription(data_url: str) -> List[dict]:
    m = _DATA_URL_RE.match(data_url.strip())
    if not m:
        raise AIError("Please upload a JPEG, PNG or WebP image.", 400)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": SCAN_PROMPT},
                    {"inlineData": {"mimeType": m.group(1), "data": re.sub(r"\s", "", m.group(2))}},
                ],
            }
        ],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096, "responseMimeType": "application/json"},
    }
    text = await _call_gemini(payload, timeout=60)
    try:
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
        return _clean_scan(json.loads(text))
    except ValueError:
        raise AIError("Could not read that prescription. Try a clearer, well-lit photo.")
