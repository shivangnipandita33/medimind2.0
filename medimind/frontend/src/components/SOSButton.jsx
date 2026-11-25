import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, MessageSquare, Phone, Siren, X } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { translate } from "../i18n/translations";

const COUNTDOWN = 5;

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  });
}

/** Message in the *family member's* language, with a Google Maps link when location is known. */
function messageFor(member, patientName, place) {
  const lang = member.language || "en";
  const name = patientName || translate(lang, "sos.someone");
  const where = place
    ? translate(lang, "sos.place", { link: `https://maps.google.com/?q=${place.lat},${place.lng}` })
    : translate(lang, "sos.no_place");
  return translate(lang, "sos.msg", { name, place: where });
}

/**
 * Always-visible SOS button. Tap -> 5 second cancellable countdown -> alert is saved (family
 * dashboard shows it instantly) and one-tap Call / SMS / WhatsApp buttons appear for every
 * family member, plus a call button for the emergency number.
 */
export default function SOSButton() {
  const { t } = useI18n();
  const [phase, setPhase] = useState("idle"); // idle | countdown | sending | sent | error
  const [count, setCount] = useState(COUNTDOWN);
  const [result, setResult] = useState(null);
  const [place, setPlace] = useState(null);
  const cancelRef = useRef(null);

  const send = useCallback(async () => {
    setPhase("sending");
    const loc = await getLocation();
    setPlace(loc);
    try {
      const res = await api.sos({ latitude: loc?.lat ?? null, longitude: loc?.lng ?? null });
      setResult(res);
      setPhase("sent");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      send();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count, send]);

  const open = () => {
    setCount(COUNTDOWN);
    setResult(null);
    setPhase("countdown");
  };
  const close = useCallback(() => setPhase("idle"), []);

  useEffect(() => {
    if (phase === "idle") return;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && phase !== "sending" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  return (
    <>
      <button className="sos-fab" onClick={open} aria-label={t("sos.title")}>
        <Siren size={22} aria-hidden="true" /> {t("sos.button")}
      </button>

      {phase !== "idle" && (
        <div className="overlay sos-overlay">
          <div className="modal sos-modal" role="alertdialog" aria-modal="true" aria-labelledby="sos-title">
            <div className="modal-head">
              <h2 id="sos-title"><Siren size={20} aria-hidden="true" /> {t("sos.title")}</h2>
              {phase !== "sending" && (
                <button className="icon-btn" onClick={close} aria-label={t("common.close")}><X size={18} /></button>
              )}
            </div>

            {phase === "countdown" && (
              <>
                <div className="sos-count" aria-live="assertive">{count}</div>
                <p className="sos-text">{t("sos.countdown", { n: count })}</p>
                <div className="modal-actions sos-actions">
                  <button ref={cancelRef} className="btn btn-ghost" onClick={close}>{t("sos.cancel")}</button>
                  <button className="btn btn-sos" onClick={send}>{t("sos.send_now")}</button>
                </div>
              </>
            )}

            {phase === "sending" && <p className="sos-text" aria-live="polite">{t("sos.sending")}</p>}

            {phase === "error" && (
              <>
                <p className="form-error" role="alert">{t("sos.error")}</p>
                <div className="modal-actions sos-actions">
                  <button ref={cancelRef} className="btn btn-ghost" onClick={close}>{t("common.close")}</button>
                  <button className="btn btn-sos" onClick={send}>{t("common.try_again")}</button>
                </div>
              </>
            )}

            {phase === "sent" && result && (
              <>
                <p className="sos-text"><strong>{t("sos.sent")}</strong><br />{t("sos.sent_sub")}</p>
                <a className="btn btn-sos sos-call" href={`tel:${result.emergency_number}`}>
                  <Phone size={18} aria-hidden="true" /> {t("sos.call", { number: result.emergency_number })}
                </a>

                <h3 className="sos-sub">{t("sos.family")}</h3>
                {result.family.length === 0 ? (
                  <p className="muted">{t("sos.no_family")}</p>
                ) : (
                  <ul className="sos-family">
                    {result.family.map((m) => {
                      const msg = encodeURIComponent(messageFor(m, result.patient_name, place));
                      const digits = (m.phone || "").replace(/\D/g, "");
                      return (
                        <li key={m.id}>
                          <span className="sos-who">
                            <strong>{m.name}</strong>
                            {m.relation && <span className="muted"> · {m.relation}</span>}
                          </span>
                          {m.phone ? (
                            <span className="row-gap">
                              <a className="btn btn-sm btn-success" href={`tel:${m.phone}`}>
                                <Phone size={14} aria-hidden="true" /> {t("sos.call_person")}
                              </a>
                              <a className="btn btn-sm btn-warn" href={`sms:${m.phone}?body=${msg}`}>
                                <MessageSquare size={14} aria-hidden="true" /> {t("sos.sms")}
                              </a>
                              <a className="btn btn-sm btn-ghost" href={`https://wa.me/${digits}?text=${msg}`} target="_blank" rel="noreferrer">
                                <MessageCircle size={14} aria-hidden="true" /> {t("sos.whatsapp")}
                              </a>
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="modal-actions">
                  <button ref={cancelRef} className="btn btn-ghost" onClick={close}>{t("sos.done")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
