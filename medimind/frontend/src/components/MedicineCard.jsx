import { memo } from "react";
import { AlarmClock, Check, Clock, Pencil, Trash2, X } from "lucide-react";
import MedicineImage from "./MedicineImage";
import StatusBadge from "./StatusBadge";
import { formatTime } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";

function MedicineCard({ medicine: m, onStatus, onEdit, onDelete }) {
  const { t } = useI18n();
  return (
    <article className={`card med-card status-${m.status.toLowerCase()}`}>
      <div className="med-card-top">
        <MedicineImage src={m.image_url} name={m.name} />
        <div className="med-card-info">
          <h3>{m.name}</h3>
          <p className="muted">{m.dosage}</p>
        </div>
        <StatusBadge status={m.status} />
      </div>

      <div className="med-card-meta">
        <span className="chip">
          <Clock size={14} aria-hidden="true" /> {formatTime(m.time)}
        </span>
        {m.notes && <span className="note" title={m.notes}>{m.notes}</span>}
      </div>

      <div className="med-card-actions" role="group" aria-label={m.name}>
        <button className="btn btn-sm btn-success" onClick={() => onStatus(m.id, "Taken")}>
          <Check size={15} aria-hidden="true" /> {t("action.take")}
        </button>
        <button className="btn btn-sm btn-warn" onClick={() => onStatus(m.id, "Snoozed", 5)}>
          <AlarmClock size={15} aria-hidden="true" /> 5m
        </button>
        <button className="btn btn-sm btn-warn" onClick={() => onStatus(m.id, "Snoozed", 10)}>
          <AlarmClock size={15} aria-hidden="true" /> 10m
        </button>
        <button className="btn btn-sm btn-danger-soft" onClick={() => onStatus(m.id, "Missed")}>
          <X size={15} aria-hidden="true" /> {t("action.missed")}
        </button>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => onEdit(m)} aria-label={`${t("common.edit")} ${m.name}`}>
          <Pencil size={16} />
        </button>
        <button className="icon-btn danger" onClick={() => onDelete(m)} aria-label={`${t("common.delete")} ${m.name}`}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default memo(MedicineCard);
