import { formatTime } from "./time";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    /* needs https or localhost */
  }
}

/**
 * Shows a system notification with the medicine photo, in the user's language.
 * Uses the service worker when available (large picture + Taken/Snooze buttons, works on mobile),
 * otherwise falls back to a plain notification.
 */
export async function showMedicineNotification(m, t) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const options = {
    body: t("notif.body", { dosage: m.dosage, time: formatTime(m.time) }),
    icon: m.image_url || "/pill.svg",
    image: m.image_url || undefined,
    badge: "/pill.svg",
    tag: `medimind-${m.id}`,
    renotify: true,
    requireInteraction: true,
    lang: document.documentElement.lang || "en",
    data: { id: m.id, api: API },
    actions: [
      { action: "taken", title: t("notif.taken") },
      { action: "snooze", title: t("notif.snooze") },
    ],
  };
  const title = `💊 ${t("notif.title", { name: m.name })}`;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.active) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    // eslint-disable-next-line no-unused-vars
    const { actions, ...plain } = options; // `actions` is only allowed with a service worker
    new Notification(title, plain);
  } catch {
    /* some mobile browsers only allow service-worker notifications */
  }
}
