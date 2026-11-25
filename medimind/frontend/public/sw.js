/* MediMind service worker: shows medicine-photo notifications and handles their action buttons. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { id, api } = n.data || {};
  n.close();

  event.waitUntil(
    (async () => {
      if ((event.action === "taken" || event.action === "snooze") && id && api) {
        const body = event.action === "taken" ? { status: "Taken" } : { status: "Snoozed", snooze_minutes: 10 };
        try {
          await fetch(`${api}/medicine_status/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {
          /* offline: the in-app popup will still be there */
        }
      }
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((w) => w.postMessage({ type: "medimind-refresh" }));
      if (!event.action) {
        if (windows[0]) await windows[0].focus();
        else await self.clients.openWindow("/");
      }
    })()
  );
});
