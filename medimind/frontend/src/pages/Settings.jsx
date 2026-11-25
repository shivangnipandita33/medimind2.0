import { useEffect, useState } from "react";
import { Activity, Volume2 } from "lucide-react";
import { api } from "../api";
import { VOICE_LANGS, findVoice, getVoicePrefs, resolveVoiceLang, setVoicePrefs, speak, ttsSupported } from "../utils/voice";
import { LANGUAGES } from "../i18n/translations";
import { useI18n } from "../i18n/I18nProvider";

export default function Settings({ notify }) {
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState({ patient_name: "", emergency_number: "112" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState(getVoicePrefs);
  const [hasVoice, setHasVoice] = useState(true);
  const [aiCheck, setAiCheck] = useState(null); // null | "checking" | status object

  const chosen = resolveVoiceLang(lang);
  useEffect(() => {
    findVoice(chosen.bcp).then((v) => setHasVoice(!!v));
  }, [chosen.bcp]);

  const changeVoice = (patch) => setVoice(setVoicePrefs(patch));
  const testVoice = () =>
    speak(chosen.say.replace("{name}", "Vitamin D").replace("{dose}", "1 tablet"), chosen.bcp);

  const checkAi = async () => {
    setAiCheck("checking");
    try {
      setAiCheck(await api.aiStatus());
    } catch (err) {
      setAiCheck({ ok: false, error: err.message });
    }
  };

  useEffect(() => {
    api.getSettings()
      .then((s) => setForm({ patient_name: s.patient_name, emergency_number: s.emergency_number }))
      .catch((err) => setError(err.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings({
        patient_name: form.patient_name.trim(),
        emergency_number: form.emergency_number.replace(/[\s()-]/g, ""),
        language: lang,
      });
      notify(t("settings.saved"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head"><h1>{t("settings.title")}</h1></div>
      <form className="card settings-card" onSubmit={submit}>
        <label htmlFor="s-name">{t("settings.name")}</label>
        <input id="s-name" value={form.patient_name} maxLength={80}
               onChange={(e) => setForm((f) => ({ ...f, patient_name: e.target.value }))} />

        <label htmlFor="s-lang">{t("settings.language")}</label>
        <select id="s-lang" className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <p className="muted">{t("settings.note")}</p>

        <label htmlFor="s-emg">{t("settings.emergency")}</label>
        <input id="s-emg" type="tel" inputMode="tel" value={form.emergency_number} maxLength={16}
               onChange={(e) => setForm((f) => ({ ...f, emergency_number: e.target.value }))} />
        <p className="muted">{t("settings.emergency_hint")}</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>{t("settings.save")}</button>
        </div>
      </form>

      <section className="card settings-card settings-section">
        <h2><Volume2 size={18} aria-hidden="true" /> {t("voice.title")}</h2>
        {!ttsSupported() ? (
          <p className="muted">{t("voice.unsupported")}</p>
        ) : (
          <>
            <label className="check-row">
              <input type="checkbox" checked={voice.enabled} onChange={(e) => changeVoice({ enabled: e.target.checked })} />
              <span>{t("voice.enable")}</span>
            </label>

            <label htmlFor="v-lang">{t("voice.language")}</label>
            <select id="v-lang" className="select" value={voice.lang} onChange={(e) => changeVoice({ lang: e.target.value })}>
              <option value="auto">{t("voice.auto")}</option>
              {VOICE_LANGS.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
            </select>
            {!hasVoice && <p className="form-error">{t("voice.no_voice", { lang: chosen.label })}</p>}

            <label htmlFor="v-rate">{t("voice.speed")}</label>
            <input id="v-rate" type="range" min="0.6" max="1.2" step="0.1" value={voice.rate}
                   onChange={(e) => changeVoice({ rate: Number(e.target.value) })} />

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={testVoice}>
                <Volume2 size={16} aria-hidden="true" /> {t("voice.test")}
              </button>
            </div>
            <p className="muted">{t("voice.note")}</p>
          </>
        )}
      </section>

      <section className="card settings-card settings-section">
        <h2><Activity size={18} aria-hidden="true" /> {t("ai.check_title")}</h2>
        <p className="muted">{t("ai.check_sub")}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={checkAi} disabled={aiCheck === "checking"}>
            {aiCheck === "checking" ? t("near.searching") : t("ai.check_btn")}
          </button>
        </div>
        {aiCheck && aiCheck !== "checking" && (
          <p className={aiCheck.ok ? "check-ok" : "form-error"} role="status">
            {aiCheck.ok ? t("ai.check_ok") : aiCheck.error}
          </p>
        )}
      </section>
    </>
  );
}
