from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["Pending", "Taken", "Snoozed", "Missed"]


class MedicineCreate(BaseModel):
    """Original three fields are still required; the rest are optional."""

    name: str = Field(min_length=1, max_length=120)
    dosage: str = Field(max_length=120)
    time: str = Field(max_length=20)
    image_url: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class MedicineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    dosage: Optional[str] = Field(default=None, max_length=120)
    time: Optional[str] = Field(default=None, max_length=20)
    image_url: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class StatusUpdate(BaseModel):
    status: Status
    snooze_minutes: Optional[int] = Field(default=None, ge=1, le=240)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: List[ChatTurn] = []
    language: Literal["en", "hi", "bn", "ta", "es"] = "en"
    mode: Literal["medicine", "doctor"] = "medicine"


# ------------------------------------------------------------ v3 additions
Language = Literal["en", "hi", "bn", "ta", "es"]


class FamilyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    relation: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[0-9 ()\-]{5,24}$")
    language: Language = "en"
    photo: Optional[str] = Field(default=None, max_length=300_000)


class FamilyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    relation: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[0-9 ()\-]{5,24}$")
    language: Optional[Language] = None
    photo: Optional[str] = Field(default=None, max_length=300_000)


class SettingsUpdate(BaseModel):
    patient_name: Optional[str] = Field(default=None, max_length=80)
    language: Optional[Language] = None
    emergency_number: Optional[str] = Field(default=None, pattern=r"^\+?[0-9]{2,15}$")
    # --- patient profile (shown to logged-in family members) ---
    patient_dob: Optional[str] = Field(default=None, pattern=r"^(\d{4}-\d{2}-\d{2})?$")  # YYYY-MM-DD or ""
    patient_gender: Optional[str] = Field(default=None, max_length=20)
    blood_group: Optional[str] = Field(default=None, max_length=5)
    conditions: Optional[str] = Field(default=None, max_length=300)
    allergies: Optional[str] = Field(default=None, max_length=300)
    doctor_name: Optional[str] = Field(default=None, max_length=80)
    doctor_phone: Optional[str] = Field(default=None, pattern=r"^(\+?[0-9 ()\-]{5,24})?$")
    address: Optional[str] = Field(default=None, max_length=200)


class FamilyLogin(BaseModel):
    patient_id: str = Field(min_length=3, max_length=20)
    pin: str = Field(min_length=4, max_length=12)


class SOSCreate(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    message: Optional[str] = Field(default=None, max_length=300)


class ScanRequest(BaseModel):
    image: str = Field(min_length=20, max_length=8_000_000)  # data:image/...;base64,...
