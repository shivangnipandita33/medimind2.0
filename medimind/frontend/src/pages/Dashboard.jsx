import { useMemo } from "react";
import { AlarmClock, BellOff, CheckCircle2, Hourglass, Pill, XCircle } from "lucide-react";
import StatCard from "../components/StatCard";
import MedicineCard from "../components/MedicineCard";
import { byTime, greetingKey } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";

export function AdherenceRing({ percent }) {
  const { t } = useI18n();
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${percent}% ${t("dash.taken_today")}`}>
      <svg viewBox="0 0 120 120" width="140" height="140">
        <circle cx="60" cy="60" r={r} className="ring-bg" />
        <circle
          cx="60" cy="60" r={r}
          className="ring-fg"
          strokeDasharray={c}
          strokeDashoffset={c - (c * percent) / 100}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-text">
        <strong>{percent}%</strong>
        <span>{t("dash.taken_today")}</span>
      </div>
    </div>
  );
}

export default function Dashboard({
  medicines, notifPermission, onEnableNotifs, onStatus, onEdit, onDelete, onAdd,
}) {
  const { t } = useI18n();
  const counts = useMemo(() => {
    const c = { Pending: 0, Taken: 0, Snoozed: 0, Missed: 0 };
    medicines.forEach((m) => (c[m.status] += 1));
    return c;
  }, [medicines]);

  const total = medicines.length;
  const percent = total ? Math.round((counts.Taken / total) * 100) : 0;
  const upNext = useMemo(
    () => medicines.filter((m) => m.status === "Pending" || m.status === "Snoozed").sort(byTime).slice(0, 4),
    [medicines]
  );

  return (
    <>
      <section className="hero">
        <div>
          <p className="hero-eyebrow">{t(greetingKey())} 👋</p>
          <h1>
            {total === 0
              ? t("dash.setup")
              : counts.Pending + counts.Snoozed === 0
              ? t("dash.all_done")
              : counts.Pending + counts.Snoozed === 1
              ? t("dash.still_one")
              : t("dash.still_many", { n: counts.Pending + counts.Snoozed })}
          </h1>
          <p className="hero-sub">{t("dash.sub")}</p>
          <button className="btn btn-light" onClick={onAdd}>+ {t("common.add_medicine")}</button>
        </div>
        <AdherenceRing percent={percent} />
      </section>

      {notifPermission === "default" && (
        <div className="banner">
          <BellOff size={18} aria-hidden="true" />
          <span>{t("dash.notif_ask")}</span>
          <button className="btn btn-sm btn-primary" onClick={onEnableNotifs}>{t("dash.enable")}</button>
        </div>
      )}
      {notifPermission === "denied" && (
        <div className="banner banner-warn">
          <BellOff size={18} aria-hidden="true" />
          <span>{t("dash.notif_blocked")}</span>
        </div>
      )}

      <section className="stats" aria-label={t("nav.medicines")}>
        <StatCard label={t("status.total")} value={total} icon={Pill} tone="total" />
        <StatCard label={t("status.Pending")} value={counts.Pending} icon={Hourglass} tone="pending" />
        <StatCard label={t("status.Taken")} value={counts.Taken} icon={CheckCircle2} tone="taken" />
        <StatCard label={t("status.Snoozed")} value={counts.Snoozed} icon={AlarmClock} tone="snoozed" />
        <StatCard label={t("status.Missed")} value={counts.Missed} icon={XCircle} tone="missed" />
      </section>

      <section>
        <h2 className="section-title">{t("dash.up_next")}</h2>
        {upNext.length === 0 ? (
          <div className="card empty">
            <p>{total === 0 ? t("dash.no_meds") : t("dash.nothing_pending")}</p>
          </div>
        ) : (
          <div className="grid">
            {upNext.map((m) => (
              <MedicineCard key={m.id} medicine={m} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
