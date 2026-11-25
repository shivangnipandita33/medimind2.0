import { useEffect, useRef } from "react";
import { AlarmClock, BellRing, Check, Volume2, X } from "lucide-react";
import MedicineImage from "./MedicineImage";
import { formatTime } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";
import { speakReminder } from "../utils/voice";

/**
 * Reminder popup shown when a medicine is due.
 * Every button updates the database right away (via onStatus).
 */
export default function ReminderPopup({ medicine: m, remaining, onStatus, onDismiss }) {
  const { t, lang } = useI18n();
  const takeBtn = useRef(null);

  useEffect(() => {
    takeBtn.current?.focus();
  }, [m?.id]);

  if (!m) return null;

  return (
    <div className="reminder" role="alertdialog" aria-labelledby="rem-title" aria-describedby="rem-desc" aria-live="assertive">
      <div className="reminder-head">
        <span className="reminder-bell" aria-hidden="true">
          <BellRing size={16} />
        </span>
        <span>{t("reminder.title")}{remaining > 1 ? ` · ${t("reminder.more", { n: remaining - 1 })}` : ""}</span>
        <button className="icon-btn light" onClick={() => speakReminder(m, lang)} aria-label={t("voice.repeat")} title={t("voice.repeat")}>
          <Volume2 size={16} />
        </button>
        <button className="icon-btn light" onClick={() => onDismiss(m.id)} aria-label={t("reminder.dismiss")}>
          <X size={16} />
        </button>
      </div>

      <div className="reminder-body">
        <MedicineImage src={m.image_url} name={m.name} size={72} />
        <div>
          <h3 id="rem-title">{m.name}</h3>
          <p id="rem-desc" className="muted">
            {m.dosage} · {formatTime(m.time)}
          </p>
          <p className="reminder-hint">{t("reminder.hint")}</p>
        </div>
      </div>

      <div className="reminder-actions">
        <button ref={takeBtn} className="btn btn-success" onClick={() => onStatus(m.id, "Taken")}>
          <Check size={16} aria-hidden="true" /> {t("action.take")}
        </button>
        <button className="btn btn-warn" onClick={() => onStatus(m.id, "Snoozed", 5)}>
          <AlarmClock size={16} aria-hidden="true" /> {t("action.snooze5")}
        </button>
        <button className="btn btn-warn" onClick={() => onStatus(m.id, "Snoozed", 10)}>
          <AlarmClock size={16} aria-hidden="true" /> {t("action.snooze10")}
        </button>
        <button className="btn btn-danger-soft" onClick={() => onStatus(m.id, "Missed")}>
          <X size={16} aria-hidden="true" /> {t("action.missed")}
        </button>
      </div>
    </div>
  );
}
