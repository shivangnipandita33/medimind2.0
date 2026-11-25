import { useCallback, useEffect, useRef, useState } from "react";
import { nowMinutes, parseTime } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";
import { showMedicineNotification } from "../utils/notify";
import { speakReminder, stopSpeaking } from "../utils/voice";

// How long after the scheduled time a Pending medicine still triggers a popup.
const GRACE_MINUTES = 180;

/**
 * Watches the medicine list and raises a reminder when a medicine is due:
 *  - Pending  -> when the scheduled time has arrived
 *  - Snoozed  -> when the snooze period ends
 * Shows an in-app popup (queue) and, if permitted, a system notification with the medicine photo
 * in the user's language.
 */
export function useReminders(medicines) {
  const [queue, setQueue] = useState([]);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const { t, lang } = useI18n();
  const tRef = useRef(t);
  tRef.current = t; // the 15s timer below always uses the current language
  const shown = useRef(new Set());
  const medsRef = useRef(medicines);
  medsRef.current = medicines;

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = nowMinutes();
      const due = [];
      for (const m of medsRef.current) {
        const t = parseTime(m.time);
        let key = null;
        if (m.status === "Pending" && t !== null && now >= t && now - t <= GRACE_MINUTES) {
          key = `${m.id}|pending|${new Date().toDateString()}`;
        } else if (m.status === "Snoozed" && m.snoozed_until && Date.now() >= Date.parse(m.snoozed_until)) {
          key = `${m.id}|snooze|${m.snoozed_until}`;
        }
        if (key && !shown.current.has(key)) {
          shown.current.add(key);
          due.push(m);
        }
      }
      if (!due.length) return;

      setQueue((q) => [...q, ...due.filter((d) => !q.some((x) => x.id === d.id))]);

      due.forEach((m) => showMedicineNotification(m, tRef.current));
    };

    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  // Drop reminders whose medicine was removed or already handled elsewhere.
  useEffect(() => {
    setQueue((q) =>
      q
        .map((r) => medicines.find((m) => m.id === r.id))
        .filter((m) => m && (m.status === "Pending" || m.status === "Snoozed"))
    );
  }, [medicines]);

  // Voice: say "it's time for your medicine ..." out loud when a reminder appears, then repeat
  // up to 2 more times (every 45s) until the person acts on it. Stops as soon as the popup closes.
  const currentId = queue[0]?.id;
  useEffect(() => {
    const m = medsRef.current.find((x) => x.id === currentId);
    if (!m) return undefined;
    let n = 0;
    speakReminder(m, lang);
    const id = setInterval(() => {
      if (++n >= 3) return clearInterval(id);
      speakReminder(m, lang);
    }, 45000);
    return () => {
      clearInterval(id);
      stopSpeaking();
    };
  }, [currentId, lang]);

  const dismiss = useCallback((id) => setQueue((q) => q.filter((m) => m.id !== id)), []);

  return { current: queue[0] || null, pending: queue.length, dismiss, permission, requestPermission };
}
