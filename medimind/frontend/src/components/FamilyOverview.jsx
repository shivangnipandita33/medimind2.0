import { AlarmClock, CheckCircle2, Hourglass, MapPin, Siren, XCircle } from "lucide-react";
import { AdherenceRing } from "../pages/Dashboard";
import { ProfileCard } from "../pages/Profile";
import MedicineImage from "./MedicineImage";
import StatCard from "./StatCard";
import StatusBadge from "./StatusBadge";
import { byTime, formatTime } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
const mapsLink = (e) => `https://maps.google.com/?q=${e.latitude},${e.longitude}`;

/** Read-only picture of the patient's day. Used inside the app and on the family member's link. */
export default function FamilyOverview({ data, onResolve }) {
  const { t } = useI18n();
  const { stats, medicines, activity, sos } = data;
  const activeSos = sos.filter((e) => e.status === "Active");

  return (
    <div className="family-overview">
      {activeSos.map((e) => (
        <div key={e.id} className="banner banner-sos" role="alert">
          <Siren size={20} aria-hidden="true" />
          <span>
            <strong>{t("family.sos_alerts")} · {when(e.created_at)}</strong>
            {e.latitude != null && (
              <> · <a href={mapsLink(e)} target="_blank" rel="noreferrer"><MapPin size={13} aria-hidden="true" /> Maps</a></>
            )}
          </span>
          {onResolve && (
            <button className="btn btn-sm btn-light" onClick={() => onResolve(e.id)}>{t("family.resolve")}</button>
          )}
        </div>
      ))}

      {data.profile && <ProfileCard profile={data.profile} />}

      <section className="hero fo-hero">
        <div>
          <p className="hero-eyebrow">{data.patient_name || t("family.patient")}</p>
          <h1>{t("family.today")}</h1>
          <p className="hero-sub">{t("family.updated", { time: new Date(data.generated_at).toLocaleTimeString([], { timeStyle: "short" }) })}</p>
        </div>
        <AdherenceRing percent={stats.adherence} />
      </section>

      <section className="stats stats-4">
        <StatCard label={t("status.Pending")} value={stats.pending} icon={Hourglass} tone="pending" />
        <StatCard label={t("status.Taken")} value={stats.taken} icon={CheckCircle2} tone="taken" />
        <StatCard label={t("status.Snoozed")} value={stats.snoozed} icon={AlarmClock} tone="snoozed" />
        <StatCard label={t("status.Missed")} value={stats.missed} icon={XCircle} tone="missed" />
      </section>

      <section className="card fo-card">
        <h2>{t("nav.medicines")}</h2>
        {medicines.length === 0 ? (
          <p className="muted">{t("dash.no_meds")}</p>
        ) : (
          <ul className="fo-list">
            {[...medicines].sort(byTime).map((m) => (
              <li key={m.id}>
                <MedicineImage src={m.image_url} name={m.name} size={44} />
                <div className="fo-main">
                  <strong>{m.name}</strong>
                  <span className="muted">{m.dosage} · {formatTime(m.time)}</span>
                </div>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="fo-two">
        <section className="card fo-card">
          <h2>{t("family.activity")}</h2>
          {activity.length === 0 ? (
            <p className="muted">{t("family.no_activity")}</p>
          ) : (
            <ul className="fo-feed">
              {activity.map((a) => (
                <li key={a.id}>
                  <StatusBadge status={a.status} />
                  <span className="fo-main"><strong>{a.medicine}</strong></span>
                  <span className="muted">{when(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card fo-card">
          <h2>{t("family.sos_alerts")}</h2>
          {sos.length === 0 ? (
            <p className="muted">{t("family.no_sos")}</p>
          ) : (
            <ul className="fo-feed">
              {sos.map((e) => (
                <li key={e.id}>
                  <span className={`badge ${e.status === "Active" ? "badge-missed" : "badge-taken"}`}>
                    {e.status === "Active" ? t("family.active") : t("family.resolved")}
                  </span>
                  <span className="fo-main">{when(e.created_at)}</span>
                  {e.latitude != null && (
                    <a href={mapsLink(e)} target="_blank" rel="noreferrer"><MapPin size={14} aria-hidden="true" /> Maps</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
