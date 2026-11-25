// All backend calls live here, so the UI never builds URLs itself.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the MediMind server. Is the backend running on port 8000?");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const detail = data?.detail;
    if (Array.isArray(detail) && detail.length) {
      // FastAPI validation errors: [{loc: ["body","phone"], msg: "..."}]
      const first = detail[0];
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      throw new Error(field ? `${field}: ${first.msg}` : first.msg);
    }
    throw new Error(typeof detail === "string" ? detail : "Something went wrong. Please try again.");
  }
  return data;
}

export const api = {
  list: () => request("/all_medicines"),
  add: (body) => request("/add_medicine", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => request(`/update_medicine/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/delete_medicine/${id}`, { method: "DELETE" }),
  search: (name) => request(`/search_medicine/${encodeURIComponent(name)}`),
  setStatus: (id, status, snooze_minutes) =>
    request(`/medicine_status/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, snooze_minutes }),
    }),
  ask: (question, history, language = "en", mode = "medicine") =>
    request("/ai/ask", { method: "POST", body: JSON.stringify({ question, history, language, mode }) }),
  aiStatus: () => request("/ai/status"),

  // --- family dashboard ---
  family: () => request("/family"),
  addFamily: (body) => request("/family", { method: "POST", body: JSON.stringify(body) }),
  updateFamily: (id, body) => request(`/family/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  removeFamily: (id) => request(`/family/${id}`, { method: "DELETE" }),
  newFamilyLink: (id) => request(`/family/${id}/new_link`, { method: "POST" }),
  familyOverview: () => request("/family/overview"),
  familyView: (code) => request(`/family/view/${encodeURIComponent(code)}`),
  familyLogin: (patient_id, pin) =>
    request("/family/login", { method: "POST", body: JSON.stringify({ patient_id, pin }) }),

  // --- SOS ---
  sos: (body) => request("/sos", { method: "POST", body: JSON.stringify(body) }),
  resolveSos: (id) => request(`/sos/${id}/resolve`, { method: "PATCH" }),

  // --- prescription scanner ---
  scan: (image) => request("/scan_prescription", { method: "POST", body: JSON.stringify({ image }) }),

  // --- settings ---
  getSettings: () => request("/settings"),
  saveSettings: (body) => request("/settings", { method: "PUT", body: JSON.stringify(body) }),
};
