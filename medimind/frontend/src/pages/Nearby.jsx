import { useCallback, useState } from "react";
import { Clock, ExternalLink, MapPin, Navigation, Phone, RefreshCw, Search } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

// Free data from OpenStreetMap via the Overpass API - no API key needed.
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const KINDS = {
  pharmacy: { amenity: "pharmacy", search: "pharmacy" },
  hospital: { amenity: "hospital", search: "hospital" },
  clinic: { amenity: "clinic|doctors", search: "doctor clinic" },
};

function km(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function overpass(query) {
  let lastErr;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).elements || [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default function Nearby() {
  const { t } = useI18n();
  const [kind, setKind] = useState("pharmacy");
  const [radius, setRadius] = useState(3000);
  const [pos, setPos] = useState(null);
  const [places, setPlaces] = useState(null);
  const [state, setState] = useState("idle"); // idle | locating | loading | error
  const [error, setError] = useState("");

  const run = useCallback(
    async (k = kind, r = radius, where = pos) => {
      setError("");
      let here = where;
      if (!here) {
        if (!navigator.geolocation) {
          setState("error");
          return setError(t("near.no_geo"));
        }
        setState("locating");
        try {
          const p = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
          );
          here = { lat: p.coords.latitude, lon: p.coords.longitude };
          setPos(here);
        } catch (e) {
          setState("error");
          return setError(e.code === 1 ? t("near.denied") : t("near.geo_failed"));
        }
      }
      setState("loading");
      const am = KINDS[k].amenity;
      const filter = am.includes("|") ? `["amenity"~"^(${am})$"]` : `["amenity"="${am}"]`;
      const q = `[out:json][timeout:25];(node${filter}(around:${r},${here.lat},${here.lon});way${filter}(around:${r},${here.lat},${here.lon}););out center 60;`;
      try {
        const els = await overpass(q);
        const list = els
          .map((e) => {
            const lat = e.lat ?? e.center?.lat;
            const lon = e.lon ?? e.center?.lon;
            if (lat == null) return null;
            const tg = e.tags || {};
            return {
              id: `${e.type}${e.id}`,
              name: tg.name || tg["name:en"] || t(`near.unnamed_${k}`),
              lat, lon,
              dist: km(here, { lat, lon }),
              hours: tg.opening_hours,
              phone: tg.phone || tg["contact:phone"],
              addr: [tg["addr:housenumber"], tg["addr:street"], tg["addr:city"]].filter(Boolean).join(", "),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 25);
        setPlaces(list);
        setState("idle");
      } catch {
        setState("error");
        setError(t("near.failed"));
      }
    },
    [kind, radius, pos, t]
  );

  const pick = (k) => {
    setKind(k);
    if (pos) run(k, radius, pos);
  };

  const mapsSearch = pos
    ? `https://www.google.com/maps/search/${encodeURIComponent(KINDS[kind].search)}/@${pos.lat},${pos.lon},15z`
    : `https://www.google.com/maps/search/${encodeURIComponent(KINDS[kind].search + " near me")}`;

  const busy = state === "locating" || state === "loading";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("near.title")}</h1>
          <p className="muted page-sub">{t("near.sub")}</p>
        </div>
      </div>

      <div className="card near-controls">
        <div className="seg" role="tablist" aria-label={t("near.title")}>
          {Object.keys(KINDS).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={`seg-btn ${kind === k ? "active" : ""}`} onClick={() => pick(k)}>
              {t(`near.${k}`)}
            </button>
          ))}
        </div>
        <label className="near-radius">
          <span className="muted">{t("near.radius")}</span>
          <select className="select" value={radius} onChange={(e) => { const r = Number(e.target.value); setRadius(r); if (pos) run(kind, r, pos); }}>
            {[1000, 3000, 5000, 10000].map((r) => <option key={r} value={r}>{r / 1000} km</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={() => run()} disabled={busy}>
          {pos ? <RefreshCw size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{" "}
          {busy ? t("near.searching") : pos ? t("near.refresh") : t("near.find")}
        </button>
      </div>

      {error && (
        <div className="banner banner-warn" role="alert">
          <span>{error}</span>
          <a className="btn btn-sm btn-ghost" href={mapsSearch} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> {t("near.open_maps")}
          </a>
        </div>
      )}

      {places && places.length === 0 && state === "idle" && (
        <div className="card empty">
          <MapPin size={34} aria-hidden="true" />
          <p>{t("near.none")}</p>
          <a className="btn btn-ghost" href={mapsSearch} target="_blank" rel="noreferrer">{t("near.open_maps")}</a>
        </div>
      )}

      {places && places.length > 0 && (
        <ul className="near-list">
          {places.map((p) => (
            <li key={p.id} className="card near-item">
              <div className="near-main">
                <h3>{p.name}</h3>
                <p className="muted">{p.dist < 1 ? `${Math.round(p.dist * 1000)} m` : `${p.dist.toFixed(1)} km`}{p.addr ? ` · ${p.addr}` : ""}</p>
                {p.hours && <p className="muted"><Clock size={13} aria-hidden="true" /> {p.hours}</p>}
              </div>
              <div className="near-actions">
                <a className="btn btn-sm btn-primary" target="_blank" rel="noreferrer"
                   href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}>
                  <Navigation size={14} aria-hidden="true" /> {t("near.directions")}
                </a>
                {p.phone && (
                  <a className="btn btn-sm btn-ghost" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone size={14} aria-hidden="true" /> {t("near.call")}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {places && <p className="muted near-note">{t("near.note")}</p>}
    </>
  );
}
