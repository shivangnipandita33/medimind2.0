import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, KeyRound, Link2, Pencil, Phone, Plus, Trash2, UserRound, X } from "lucide-react";
import { api } from "../api";
import FamilyOverview from "../components/FamilyOverview";
import { fileToSmallDataUrl } from "../utils/image";
import { LANGUAGES } from "../i18n/translations";
import { useI18n } from "../i18n/I18nProvider";

const linkFor = (m) => `${window.location.origin}/?family=${m.access_code}`;
const portalUrl = () => `${window.location.origin}/?portal=family`;

function MemberForm({ member, onSave, onClose }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    name: member?.name || "",
    relation: member?.relation || "",
    phone: member?.phone || "",
    language: member?.language || lang,
    photo: member?.photo || "",
  });
  const fileInput = useRef(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setForm((f) => ({ ...f, photo: "" }));
      const url = await fileToSmallDataUrl(file, 200, 0.85);
      setForm((f) => ({ ...f, photo: url }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        relation: form.relation.trim() || null,
        phone: form.phone.trim() || null,
        language: form.language,
        photo: form.photo || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="fm-title" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="fm-title">{member ? t("family.edit") : t("family.add")}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}><X size={18} /></button>
        </div>
        <div className="avatar-row">
          <span className="member-avatar big" aria-hidden="true">
            {form.photo ? <img src={form.photo} alt="" /> : (form.name.trim().slice(0, 1).toUpperCase() || <UserRound size={22} />)}
          </span>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <div className="row-gap">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileInput.current.click()}>
              <ImagePlus size={15} aria-hidden="true" /> {t("form.upload")}
            </button>
            {form.photo && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm((f) => ({ ...f, photo: "" }))}>
                {t("common.remove")}
              </button>
            )}
          </div>
        </div>
        <label htmlFor="fm-name">{t("family.name")}</label>
        <input id="fm-name" value={form.name} onChange={set("name")} maxLength={80} required autoFocus />
        <label htmlFor="fm-rel">{t("family.relation")}</label>
        <input id="fm-rel" value={form.relation} onChange={set("relation")} maxLength={40} />
        <label htmlFor="fm-phone">{t("family.phone")}</label>
        <input id="fm-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" maxLength={24} />
        <label htmlFor="fm-lang">{t("family.language")}</label>
        <select id="fm-lang" className="select" value={form.language} onChange={set("language")}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>{t("form.save_changes")}</button>
        </div>
      </form>
    </div>
  );
}

export default function Family({ notify }) {
  const { t } = useI18n();
  const [members, setMembers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { member: obj|null }

  const load = useCallback(async () => {
    try {
      const [m, o] = await Promise.all([api.family(), api.familyOverview()]);
      setMembers(m);
      setOverview(o);
      setPatientId(o.profile?.patient_id || "");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const save = async (data) => {
    if (form.member) await api.updateFamily(form.member.id, data);
    else await api.addFamily(data);
    setForm(null);
    notify(t("family.saved"));
    load();
  };

  const remove = async (m) => {
    if (!window.confirm(t("family.confirm_remove", { name: m.name }))) return;
    try {
      await api.removeFamily(m.id);
      notify(t("family.removed"));
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const copyText = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(msg);
    } catch {
      window.prompt(msg, text);
    }
  };

  const copy = async (m) => {
    const url = linkFor(m);
    try {
      await navigator.clipboard.writeText(url);
      notify(t("family.link_copied"));
    } catch {
      window.prompt(t("family.copy_link"), url); // clipboard blocked: let them copy by hand
    }
  };

  const newLink = async (m) => {
    if (!window.confirm(t("family.confirm_new_link"))) return;
    try {
      await api.newFamilyLink(m.id);
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const resolve = async (id) => {
    try {
      await api.resolveSos(id);
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("family.title")}</h1>
          <p className="muted page-sub">{t("family.subtitle")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ member: null })}>
          <Plus size={18} aria-hidden="true" /> {t("family.add")}
        </button>
      </div>

      {error && <div className="banner banner-warn" role="alert"><span>{error}</span></div>}

      {patientId && (
        <div className="card login-info">
          <KeyRound size={20} aria-hidden="true" />
          <div className="login-info-text">
            <strong>{t("family.login_title")}</strong>
            <p className="muted">
              {t("family.login_body", { id: patientId })}{" "}
              <a href={portalUrl()} target="_blank" rel="noreferrer">{portalUrl()}</a>
            </p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => copyText(portalUrl(), t("family.link_copied"))}>
            <Copy size={14} aria-hidden="true" /> {t("family.copy_login")}
          </button>
        </div>
      )}

      {members.length === 0 && !error ? (
        <div className="card empty">
          <UserRound size={36} aria-hidden="true" />
          <p>{t("family.none")}</p>
        </div>
      ) : (
        <div className="grid">
          {members.map((m) => (
            <article key={m.id} className="card member-card">
              <div className="member-top">
                <span className="member-avatar" aria-hidden="true">
                  {m.photo ? <img src={m.photo} alt="" /> : m.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="member-info">
                  <h3>{m.name}</h3>
                  <p className="muted">
                    {[m.relation, LANGUAGES.find((l) => l.code === m.language)?.label].filter(Boolean).join(" · ")}
                  </p>
                  {m.phone && <p className="muted member-phone"><Phone size={13} aria-hidden="true" /> {m.phone}</p>}
                </div>
              </div>
              {m.pin && (
                <div className="member-pin">
                  <span className="muted">{t("family.pin")}</span>
                  <strong>{m.pin}</strong>
                  <button className="icon-btn" onClick={() => copyText(m.pin, t("family.pin_copied"))} aria-label={t("family.pin")}>
                    <Copy size={14} />
                  </button>
                </div>
              )}
              <div className="member-actions">
                <button className="btn btn-sm btn-success" onClick={() => copy(m)}>
                  <Copy size={14} aria-hidden="true" /> {t("family.copy_link")}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => newLink(m)}>
                  <Link2 size={14} aria-hidden="true" /> {t("family.new_link")}
                </button>
                <span className="spacer" />
                <button className="icon-btn" onClick={() => setForm({ member: m })} aria-label={`${t("common.edit")} ${m.name}`}><Pencil size={16} /></button>
                <button className="icon-btn danger" onClick={() => remove(m)} aria-label={`${t("common.delete")} ${m.name}`}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {overview && (
        <>
          <h2 className="section-title fam-preview">{t("family.overview")}</h2>
          <FamilyOverview data={overview} onResolve={resolve} />
        </>
      )}

      {form && <MemberForm member={form.member} onSave={save} onClose={() => setForm(null)} />}
    </>
  );
}
