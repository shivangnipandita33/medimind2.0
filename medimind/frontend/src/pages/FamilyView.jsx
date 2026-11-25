import { useCallback, useEffect, useState } from "react";
import { HeartPulse, LogOut } from "lucide-react";
import { api } from "../api";
import FamilyOverview from "../components/FamilyOverview";
import LanguageSelect from "../components/LanguageSelect";
import { useI18n } from "../i18n/I18nProvider";

/** What a family member sees when they open their private link (…/?family=CODE). Read-only. */
export default function FamilyView({ code, onLogout }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api.familyView(code));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [code]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="fv">
      <header className="fv-head">
        <span className="brand-logo" aria-hidden="true"><HeartPulse size={22} /></span>
        <div className="fv-title">
          <strong>MediMind</strong>
          <span className="muted">{t("family.view_only")}</span>
        </div>
        <LanguageSelect />
        {onLogout && (
          <button className="btn btn-sm btn-ghost" onClick={onLogout}>
            <LogOut size={15} aria-hidden="true" /> {t("login.logout")}
          </button>
        )}
      </header>
      <main className="fv-main">
        {data ? (
          <FamilyOverview data={data} />
        ) : error ? (
          <div className="card empty error-state" role="alert">
            <p>{error.includes("Invalid") ? t("family.bad_link") : error}</p>
            {onLogout && <button className="btn btn-primary" onClick={onLogout}>{t("login.again")}</button>}
          </div>
        ) : (
          <div className="skeleton" style={{ height: 320 }} />
        )}
      </main>
    </div>
  );
}
