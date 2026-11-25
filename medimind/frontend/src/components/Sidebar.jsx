import { Bot, HeartPulse, LayoutDashboard, MapPin, Pill, ScanLine, UserRound, Users } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export const NAV = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "medicines", icon: Pill },
  { id: "scan", icon: ScanLine },
  { id: "nearby", icon: MapPin },
  { id: "family", icon: Users },
  { id: "assistant", icon: Bot },
  { id: "profile", icon: UserRound },
];

export function Sidebar({ view, onChange }) {
  const { t } = useI18n();
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <span className="brand-logo" aria-hidden="true">
          <HeartPulse size={22} />
        </span>
        <span className="brand-name">MediMind</span>
      </div>

      <nav>
        {NAV.map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? "active" : ""}`}
            onClick={() => onChange(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={19} aria-hidden="true" /> {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav({ view, onChange }) {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV.filter((n) => n.id !== "profile").map(({ id, icon: Icon }) => (
        <button
          key={id}
          className={`bottom-item ${view === id ? "active" : ""}`}
          onClick={() => onChange(id)}
          aria-current={view === id ? "page" : undefined}
        >
          <Icon size={22} aria-hidden="true" />
          <span>{t(`nav.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
