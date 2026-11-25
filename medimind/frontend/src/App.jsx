import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Plus, Search, Settings as SettingsIcon, UserRound } from "lucide-react";
import { api } from "./api";
import { BottomNav, Sidebar } from "./components/Sidebar";
import LanguageSelect from "./components/LanguageSelect";
import MedicineForm from "./components/MedicineForm";
import ReminderPopup from "./components/ReminderPopup";
import SOSButton from "./components/SOSButton";
import Toast from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import Family from "./pages/Family";
import Medicines from "./pages/Medicines";
import Nearby from "./pages/Nearby";
import Profile from "./pages/Profile";
import ScanRx from "./pages/ScanRx";
import Settings from "./pages/Settings";
import { useReminders } from "./hooks/useReminders";
import { useI18n } from "./i18n/I18nProvider";

// The assistant is only needed on its own tab, so it loads on demand.
const AIAssistant = lazy(() => import("./components/AIAssistant"));

export default function App() {
  const { t } = useI18n();
  const [view, setView] = useState("dashboard");
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // null | { medicine: obj|null }
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = "success") => setToast({ message, type }), []);

  const load = useCallback(async () => {
    try {
      setMedicines(await api.list());
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // keeps statuses fresh (and resets at midnight)
    return () => clearInterval(id);
  }, [load]);

  const reminders = useReminders(medicines);

  // The notification's Taken / Snooze buttons update the server from the service worker;
  // it then pings open tabs so the list refreshes straight away.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e) => e.data?.type === "medimind-refresh" && load();
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [load]);

  // ---- actions (every one hits the API, then updates the UI) ----
  const handleStatus = useCallback(
    async (id, status, snoozeMinutes) => {
      try {
        const res = await api.setStatus(id, status, snoozeMinutes);
        setMedicines((list) => list.map((m) => (m.id === id ? res.medicine : m)));
        notify(
          status === "Snoozed"
            ? t("toast.snoozed", { n: snoozeMinutes })
            : t("toast.marked", { status: t(`status.${status}`) })
        );
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [notify, t]
  );

  const handleSave = async (data) => {
    if (form.medicine) {
      const res = await api.update(form.medicine.id, data);
      setMedicines((list) => list.map((m) => (m.id === form.medicine.id ? res.medicine : m)));
      notify(t("toast.updated"));
    } else {
      const res = await api.add(data);
      setMedicines((list) => [...list, res.medicine]);
      notify(t("toast.added"));
    }
    setForm(null);
  };

  const handleDelete = useCallback(
    async (m) => {
      if (!window.confirm(t("confirm.delete", { name: m.name }))) return;
      try {
        await api.remove(m.id);
        setMedicines((list) => list.filter((x) => x.id !== m.id));
        notify(t("toast.deleted"));
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [notify, t]
  );

  const openAdd = useCallback(() => setForm({ medicine: null }), []);
  const openEdit = useCallback((medicine) => setForm({ medicine }), []);
  const closeForm = useCallback(() => setForm(null), []);

  const changeView = (v) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const showSearch = view === "dashboard" || view === "medicines";

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar view={view} onChange={changeView} />

      <div className="content">
        <header className="topbar">
          {showSearch ? (
            <div className="search">
              <Search size={18} aria-hidden="true" />
              <label htmlFor="search" className="sr-only">{t("search.placeholder")}</label>
              <input
                id="search"
                type="search"
                placeholder={t("search.placeholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (view === "dashboard" && e.target.value) setView("medicines");
                }}
              />
            </div>
          ) : (
            view === "assistant" ? <h1 className="topbar-title">{t("ai.title")}</h1> : <div className="topbar-title" />
          )}
          <div className="topbar-actions">
            <LanguageSelect />
            <button
              className={`icon-btn hide-desktop ${view === "profile" ? "active" : ""}`}
              onClick={() => changeView("profile")}
              aria-label={t("nav.profile")}
              title={t("nav.profile")}
            >
              <UserRound size={19} />
            </button>
            <button
              className={`icon-btn ${view === "settings" ? "active" : ""}`}
              onClick={() => changeView("settings")}
              aria-label={t("nav.settings")}
              title={t("nav.settings")}
            >
              <SettingsIcon size={19} />
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={18} aria-hidden="true" /> <span className="hide-sm">{t("common.add_medicine")}</span>
              <span className="sr-only show-sm">{t("common.add_medicine")}</span>
            </button>
          </div>
        </header>

        <main id="main" className="main">
          {loading ? (
            <div className="skeleton-grid" aria-busy="true" aria-label="Loading">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
            </div>
          ) : loadError ? (
            <div className="card empty error-state" role="alert">
              <p>{loadError}</p>
              <button className="btn btn-primary" onClick={load}>{t("common.try_again")}</button>
            </div>
          ) : view === "dashboard" ? (
            <Dashboard
              medicines={medicines}
              notifPermission={reminders.permission}
              onEnableNotifs={reminders.requestPermission}
              onStatus={handleStatus}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAdd={openAdd}
            />
          ) : view === "medicines" ? (
            <Medicines
              medicines={medicines}
              query={query}
              onStatus={handleStatus}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAdd={openAdd}
            />
          ) : view === "scan" ? (
            <ScanRx notify={notify} onAdded={load} onDone={() => changeView("medicines")} />
          ) : view === "nearby" ? (
            <Nearby />
          ) : view === "profile" ? (
            <Profile notify={notify} />
          ) : view === "family" ? (
            <Family notify={notify} />
          ) : view === "settings" ? (
            <Settings notify={notify} />
          ) : (
            <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
              <AIAssistant />
            </Suspense>
          )}
        </main>
      </div>

      <BottomNav view={view} onChange={changeView} />
      <SOSButton />

      <ReminderPopup
        medicine={reminders.current}
        remaining={reminders.pending}
        onStatus={handleStatus}
        onDismiss={reminders.dismiss}
      />

      {form && <MedicineForm medicine={form.medicine} onSave={handleSave} onClose={closeForm} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
