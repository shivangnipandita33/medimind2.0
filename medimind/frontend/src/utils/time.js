// Accepts "08:00", "8:00", "8:00 AM", "08:30 pm" -> minutes since midnight (or null).
export function parseTime(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toLowerCase();
  if (min > 59 || h > 23) return null;
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h * 60 + min;
}

// -> "8:00 AM"
export function formatTime(str) {
  const t = parseTime(str);
  if (t === null) return str || "--";
  const h24 = Math.floor(t / 60);
  const min = String(t % 60).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${h24 >= 12 ? "PM" : "AM"}`;
}

// -> "08:00" for <input type="time">
export function toInputValue(str) {
  const t = parseTime(str);
  if (t === null) return "";
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Sort helper: earliest time first, unparseable last.
export function byTime(a, b) {
  return (parseTime(a.time) ?? 9999) - (parseTime(b.time) ?? 9999);
}

// Translation key for the time-of-day greeting.
export function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greet.morning";
  if (h < 17) return "greet.afternoon";
  return "greet.evening";
}
