import { useEffect, useState } from "react";
import { Check, Copy, Droplet, MapPin, Pencil, Phone, Stethoscope, UserRound } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n/I18nProvider";

const FIELDS = ["patient_name", "patient_dob", "patient_gender", "blood_group", "conditions", "allergies", "doctor_name", "doctor_phone", "address"];
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Read-only profile card. Used on the Profile page and on the family member's portal. */
export function ProfileCard({ profile, onCopy }) {
  const { t } = useI18n();
  const p = profile;
  const rows = [
    [Droplet, t("profile.blood"), p.blood_group],
    [UserRound, t("profile.gender"), p.patient_gender],
    [Stethoscope, t("profile.conditions"), p.conditions],
    [Stethoscope, t("profile.allergies"), p.allergies],
    [Stethoscope, t("profile.doctor"), [p.doctor_name, p.doctor_phone].filter(Boolean).join(" · ")],
    [Phone, t("settings.emergency"), p.emergency_number],
    [MapPin, t("profile.address"), p.address],
  ].filter(([, , v]) => v);

  return (
    <section className="card profile-card">
      <div className="profile-top">
        <span className="member-avatar big" aria-hidden="true">
          {(p.patient_name || "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="profile-id">
          <h2>{p.patient_name || t("family.patient")}</h2>
          <p className="muted">
            {p.age != null ? t("profile.years", { n: p.age }) : t("profile.age_unknown")}
            {p.patient_gender ? ` · ${p.patient_gender}` : ""}
          </p>
        </div>
        <div className="pid-chip" title={t("profile.pid")}>
          <span className="pid-label">{t("profile.pid")}</span>
          <strong className="pid-value">{p.patient_id}</strong>
          {onCopy && (
            <button className="icon-btn" onClick={() => onCopy(p.patient_id)} aria-label={t("profile.copy_id")}>
              <Copy size={15} />
            </button>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="profile-grid">
          {rows.map(([Icon, label, value]) => (
            <div key={label}>
              <dt><Icon size={14} aria-hidden="true" /> {label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default function Profile({ notify }) {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.getSettings().then(setProfile).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const startEdit = () => setForm(Object.fromEntries(FIELDS.map((k) => [k, profile[k] || ""])));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(t("profile.copied"));
    } catch {
      window.prompt(t("profile.pid"), text);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = Object.fromEntries(FIELDS.map((k) => [k, (form[k] || "").trim()]));
      setProfile(await api.saveSettings({ ...body, language: lang }));
      setForm(null);
      setError("");
      notify(t("settings.saved"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return error ? <div className="banner banner-warn" role="alert"><span>{error}</span></div> : <div className="skeleton" style={{ height: 240 }} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("profile.title")}</h1>
          <p className="muted page-sub">{t("profile.subtitle")}</p>
        </div>
        {!form && (
          <button className="btn btn-primary" onClick={startEdit}>
            <Pencil size={16} aria-hidden="true" /> {t("common.edit")}
          </button>
        )}
      </div>

      {error && <div className="banner banner-warn" role="alert"><span>{error}</span></div>}

      {!form ? (
        <>
          <ProfileCard profile={profile} onCopy={copy} />
          <div className="card profile-help">
            <h3>{t("profile.how_title")}</h3>
            <ol>
              <li>{t("profile.how1")}</li>
              <li>{t("profile.how2", { id: profile.patient_id })}</li>
              <li>{t("profile.how3")}</li>
            </ol>
          </div>
        </>
      ) : (
        <form className="card settings-card" onSubmit={save}>
          <label htmlFor="p-name">{t("settings.name")}</label>
          <input id="p-name" value={form.patient_name} onChange={set("patient_name")} maxLength={80} />

          <label htmlFor="p-dob">{t("profile.dob")}</label>
          <input id="p-dob" type="date" value={form.patient_dob} onChange={set("patient_dob")} max={new Date().toISOString().slice(0, 10)} />

          <label htmlFor="p-gender">{t("profile.gender")}</label>
          <select id="p-gender" className="select" value={form.patient_gender} onChange={set("patient_gender")}>
            {["", "Male", "Female", "Other"].map((g) => <option key={g} value={g}>{g || "—"}</option>)}
          </select>

          <label htmlFor="p-blood">{t("profile.blood")}</label>
          <select id="p-blood" className="select" value={form.blood_group} onChange={set("blood_group")}>
            {BLOOD.map((b) => <option key={b} value={b}>{b || "—"}</option>)}
          </select>

          <label htmlFor="p-cond">{t("profile.conditions")}</label>
          <input id="p-cond" value={form.conditions} onChange={set("conditions")} maxLength={300} placeholder={t("profile.conditions_ph")} />

          <label htmlFor="p-all">{t("profile.allergies")}</label>
          <input id="p-all" value={form.allergies} onChange={set("allergies")} maxLength={300} />

          <label htmlFor="p-doc">{t("profile.doctor")}</label>
          <input id="p-doc" value={form.doctor_name} onChange={set("doctor_name")} maxLength={80} />

          <label htmlFor="p-docp">{t("profile.doctor_phone")}</label>
          <input id="p-docp" type="tel" value={form.doctor_phone} onChange={set("doctor_phone")} maxLength={24} />

          <label htmlFor="p-addr">{t("profile.address")}</label>
          <input id="p-addr" value={form.address} onChange={set("address")} maxLength={200} />

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Check size={16} aria-hidden="true" /> {t("settings.save")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
