# MediMind 💊

AI-powered medicine reminder & management app.
**React (Vite) + FastAPI + SQLite + Google Gemini 2.5 Flash**

## Run it

### 1. Backend (terminal 1)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows   (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # macOS/Linux: cp .env.example .env  -> then paste your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 2. Frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

To point the frontend at another backend, create `frontend/.env` with `VITE_API_URL=http://your-host:8000`.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/add_medicine` | add (name, dosage, time, optional image_url, notes) |
| GET | `/all_medicines` | list |
| PUT | `/update_medicine/{id}` | edit |
| DELETE | `/delete_medicine/{id}` | delete |
| GET | `/search_medicine/{name}` | search |
| PATCH | `/medicine_status/{id}` | `{status: Taken/Snoozed/Missed/Pending, snooze_minutes}` |
| GET | `/stats` | dashboard counts + adherence % |
| POST | `/ai/ask` | Gemini assistant `{question, history, language, mode: medicine\|doctor}` |
| GET | `/ai/status` | tests the Gemini key/model and says what is wrong |
| POST | `/family/login` | `{patient_id, pin}` -> family portal session |
| POST | `/scan_prescription` | Gemini reads a prescription photo `{image: dataURL}` -> *suggested* medicines (nothing saved) |
| GET/POST/PUT/DELETE | `/family`, `/family/{id}` | family members (name, relation, phone, language) |
| POST | `/family/{id}/new_link` | new private link; the old one stops working |
| GET | `/family/overview` | what the family sees (used in the app) |
| GET | `/family/view/{code}` | the same, read-only, for a family member's private link |
| POST | `/sos` | save an SOS alert (+ optional location), returns family contacts |
| GET / PATCH | `/sos`, `/sos/{id}/resolve` | list / resolve alerts |
| GET / PUT | `/settings` | patient name, language, emergency number, profile fields, Patient ID (read-only) |

An existing `medicine.db` is upgraded automatically on startup. Statuses reset to Pending each new day.

## Reminders
- The app checks every 15 s. When a medicine is due (or a snooze ends) a popup appears with the image, name, dosage, time and **Take / Snooze 5m / Snooze 10m / Missed** buttons; each saves to the database immediately.
- Click **Enable** on the dashboard to also get browser notifications. Reminders only fire while a MediMind tab is open.

## New in v3

- **Family dashboard** (sidebar -> Family). Add family members; each gets a private read-only link
  (`https://your-site/?family=CODE`) showing today's medicines with photos, adherence, recent
  activity and SOS alerts, refreshed every 30 s. "New link" revokes the old one.
- **SOS button** (red button, always visible). 5-second cancellable countdown -> alert saved (family
  dashboard shows it at once, with location if allowed) -> one-tap **Call / SMS / WhatsApp** for each
  family member (message is written in *their* language) and a call button for the emergency number
  (set it in Settings, default 112).
- **Scan Rx** (sidebar -> Scan Rx). Photo -> Gemini vision -> editable review list (name, dose, times,
  notes; uncertain reads are highlighted) -> one reminder per time of day on confirm.
- **Notifications with the medicine photo** + **Taken / Snooze 10m** buttons, in the user's language
  (via `frontend/public/sw.js`).
- **Multilingual**: English, Hindi (full UI); Bengali, Tamil, Spanish (reminders, notifications, SOS, status
  names, main navigation - rest falls back to English). Add a language in
  `frontend/src/i18n/translations.js` + `Language` in `backend/schemas.py`. The AI assistant answers in the
  selected language.

## New in v4

- **Gemini AI fixed.** Causes found and fixed: (1) the chat request let Gemini 2.5 "think", and those hidden
  tokens used up the answer budget so replies came back empty/failed - thinking is now off for these short
  tasks and the budget is bigger; (2) the model/key were read once at import time - now read on every call and
  `.env` is loaded from `backend/.env` whatever folder you start uvicorn in; (3) errors were vague - they now say
  exactly what is wrong (bad key, leaked key, quota, model missing) and the app auto-tries fallback models.
  **Check it:** open http://localhost:8000/ai/status, or Settings -> "Test AI connection".
- **Patient profile** (sidebar -> Profile, or the person icon on phones): name, age (from date of birth),
  gender, blood group, conditions, allergies, doctor, address - plus an auto-generated **Patient ID** (e.g. `MM-7K2P9Q`).
- **Family login.** Each family member gets a private 6-digit **PIN** (Family page). They open
  `https://your-site/?portal=family`, enter Patient ID + PIN, and see the profile, medicines, activity and SOS
  alerts (read-only). Failed logins are rate-limited. The old private link (`?family=CODE`) still works.
  "New link" now also changes the PIN.
- **Voice reminders.** When a reminder pops up the app says "It's time for your medicine, please take X" out
  loud, repeating up to 2 more times until you tap Take/Snooze/Missed. 16 languages (Settings -> Voice
  reminders): English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu,
  Spanish, French, German, Portuguese, Arabic. If the device has no voice for that language it speaks English.
- **Voice assistant.** Mic button in the AI Assistant: speak your question, get the answer read back. Speaker
  button on any answer reads it aloud.
- **Doctor assistant** (AI Assistant -> "Doctor assistant"): explains symptoms in general terms, home care, and
  ends every answer with an urgency level. It never diagnoses or prescribes.
- **Nearby** (sidebar): pharmacies, hospitals and clinics near you with distance, directions and call
  (OpenStreetMap data, no API key). Coverage varies by area - always call ahead.

## Things to know before real use

- **The patient's own app has no login.** Family login protects the family portal, but the main app (and
  the API that lists family PINs) is open to anyone who can reach the backend. Add auth before deploying
  publicly. Treat links, Patient ID and PINs as passwords.
- **Family links need a deployed site.** `localhost` links only work on your own computer. Deploy the
  frontend + backend, set `VITE_API_URL` (frontend) and `ALLOWED_ORIGINS` (backend `.env`).
- **Reminders only fire while a MediMind tab/PWA is open** (browser timers). True background push needs
  Web Push (VAPID) or FCM from the backend - the next step if you need it.
- **SOS does not send SMS by itself.** It saves the alert and opens ready-to-send SMS / WhatsApp / call
  links. To auto-notify, set `SOS_WEBHOOK_URL` in `backend/.env`; every alert is POSTed there as JSON
  (Twilio Function, Zapier, n8n, ...).
- **Prescription reading can be wrong.** The review screen is mandatory by design. Do not rely on it
  without checking against the paper prescription.
- Translations other than English were written by an AI and should be reviewed by a native speaker
  before use, especially medical wording.

## Project structure
```
backend/   main.py  models.py  schemas.py  database.py  ai.py
frontend/src/
  api.js  App.jsx  styles.css
  components/  Sidebar MedicineCard MedicineForm ReminderPopup AIAssistant SOSButton FamilyOverview ...
  pages/       Dashboard Medicines ScanRx Family FamilyView Settings
  hooks/       useReminders
  i18n/        translations.js I18nProvider.jsx
  utils/       time image notify
frontend/public/sw.js   service worker (photo notifications + action buttons)
```

## Roadmap
Authentication for the main app, Web Push (so voice/notifications work with the tab closed), automatic SOS SMS/calls, refill reminders, more UI languages.
