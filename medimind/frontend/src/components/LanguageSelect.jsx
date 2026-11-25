import { Languages } from "lucide-react";
import { LANGUAGES } from "../i18n/translations";
import { useI18n } from "../i18n/I18nProvider";

export default function LanguageSelect() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-select">
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">{t("settings.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
