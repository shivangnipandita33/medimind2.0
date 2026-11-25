import { useState } from "react";
import { HeartPulse, LogIn } from "lucide-react";
import { api } from "../api";
import LanguageSelect from "../components/LanguageSelect";
import { useI18n } from "../i18n/I18nProvider";

/** Family members sign in here with the Patient ID + the 6-digit PIN the patient gave them. */
export default function FamilyLogin({ onLoggedIn }) {
  const { t } = useI18n();
  const [pid, setPid] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.familyLogin(pid, pin);
      onLoggedIn(res.access_code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fv">
      <header className="fv-head">
        <span className="brand-logo" aria-hidden="true"><HeartPulse size={22} /></span>
        <div className="fv-title">
          <strong>MediMind</strong>
          <span className="muted">{t("login.portal")}</span>
        </div>
        <LanguageSelect />
      </header>
      <main className="fv-main">
        <form className="card login-card" onSubmit={submit}>
          <h1>{t("login.title")}</h1>
          <p className="muted">{t("login.sub")}</p>

          <label htmlFor="l-pid">{t("profile.pid")}</label>
          <input id="l-pid" value={pid} onChange={(e) => setPid(e.target.value.toUpperCase())}
                 placeholder="MM-XXXXXX" autoCapitalize="characters" autoComplete="off" maxLength={14} required autoFocus />

          <label htmlFor="l-pin">{t("login.pin")}</label>
          <input id="l-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                 inputMode="numeric" placeholder="••••••" autoComplete="one-time-code" maxLength={8} required />

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy || !pid.trim() || pin.length < 4}>
            <LogIn size={17} aria-hidden="true" /> {t("login.button")}
          </button>
          <p className="muted login-help">{t("login.help")}</p>
        </form>
      </main>
    </div>
  );
}
