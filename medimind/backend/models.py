from sqlalchemy import Column, Integer, String, Text

from database import Base


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    dosage = Column(String)
    time = Column(String)  # "08:00" or "8:00 AM" (both are understood)

    # --- added in v2 (auto-migrated) ---
    status = Column(String, default="Pending")  # Pending | Taken | Snoozed | Missed
    status_date = Column(String)  # YYYY-MM-DD the status applies to (resets daily)
    snoozed_until = Column(String)  # ISO datetime (UTC) when a snooze ends
    image_url = Column(Text)  # http(s) URL or small data: URL
    notes = Column(String)


# --- added in v3: family dashboard, SOS, activity log, settings ---
from sqlalchemy import Float  # noqa: E402


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    relation = Column(String)
    phone = Column(String)
    language = Column(String, default="en")  # language of the SOS message sent to them
    access_code = Column(String, unique=True, index=True)  # private read-only dashboard link
    pin = Column(String)  # 6-digit PIN: family logs in with Patient ID + this PIN
    photo = Column(Text)  # small data: URL
    created_at = Column(String)


class DoseLog(Base):
    """One row each time a medicine is marked Taken / Snoozed / Missed."""

    __tablename__ = "dose_logs"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, index=True)
    medicine_name = Column(String)
    status = Column(String)
    at = Column(String)  # ISO datetime (UTC)


class SOSEvent(Base):
    __tablename__ = "sos_events"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(String)
    status = Column(String, default="Active")  # Active | Resolved
    latitude = Column(Float)
    longitude = Column(Float)
    message = Column(String)
    resolved_at = Column(String)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String)
