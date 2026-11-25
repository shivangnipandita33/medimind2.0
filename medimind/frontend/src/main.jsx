import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import FamilyLogin from "./pages/FamilyLogin.jsx";
import FamilyView from "./pages/FamilyView.jsx";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { registerServiceWorker } from "./utils/notify";
import { primeVoice } from "./utils/voice";
import "./styles.css";

// Two ways in for family members:
//   1) a private link   https://your-site/?family=CODE          (no login needed)
//   2) the login page   https://your-site/?portal=family        (Patient ID + 6-digit PIN)
const params = new URLSearchParams(window.location.search);
const linkCode = params.get("family");
const wantsPortal = params.get("portal") === "family";
const SESSION_KEY = "medimind_family_code";

const readSession = () => {
  try { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || ""; } catch { return ""; }
};
const writeSession = (code) => {
  try {
    if (code) localStorage.setItem(SESSION_KEY, code);
    else { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }
  } catch { /* storage blocked */ }
};

function FamilyPortal() {
  const [code, setCode] = useState(readSession);
  if (!code) return <FamilyLogin onLoggedIn={(c) => { writeSession(c); setCode(c); }} />;
  return <FamilyView code={code} onLogout={() => { writeSession(""); setCode(""); }} />;
}

const isFamily = !!linkCode || wantsPortal;
if (!isFamily) {
  registerServiceWorker();
  primeVoice();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>{linkCode ? <FamilyView code={linkCode} /> : wantsPortal ? <FamilyPortal /> : <App />}</I18nProvider>
  </React.StrictMode>
);
