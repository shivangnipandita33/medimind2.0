import { AlarmClock, CheckCircle2, Hourglass, XCircle } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

const MAP = {
  Pending: { icon: Hourglass, cls: "pending" },
  Taken: { icon: CheckCircle2, cls: "taken" },
  Snoozed: { icon: AlarmClock, cls: "snoozed" },
  Missed: { icon: XCircle, cls: "missed" },
};

export default function StatusBadge({ status }) {
  const { t } = useI18n();
  const { icon: Icon, cls } = MAP[status] || MAP.Pending;
  return (
    <span className={`badge badge-${cls}`}>
      <Icon size={14} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
