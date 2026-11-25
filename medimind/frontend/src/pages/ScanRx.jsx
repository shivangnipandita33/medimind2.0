import { useRef, useState } from "react";
import { Camera, ImagePlus, Plus, ScanLine, ShieldAlert, Trash2, TriangleAlert, X } from "lucide-react";
import { api } from "../api";
import { fileToSmallDataUrl } from "../utils/image";
import { useI18n } from "../i18n/I18nProvider";

let rowId = 0;

export default function ScanRx({ notify, onAdded, onDone }) {
  const { t } = useI18n();
  const [stage, setStage] = useState("idle"); // idle | reading | review | saving
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const camera = useRef(null);
  const gallery = useRef(null);

  const reset = () => {
    setStage("idle");
    setRows([]);
    setPreview("");
    setError("");
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows choosing the same photo again
    if (!file) return;
    setError("");
    setStage("reading");
    try {
      const dataUrl = await fileToSmallDataUrl(file, 1600, 0.85);
      setPreview(dataUrl);
      const res = await api.scan(dataUrl);
      setRows(res.medicines.map((m) => ({ ...m, key: ++rowId })));
      setStage("review");
    } catch (err) {
      setError(err.message);
      setStage("idle");
    }
  };

  const edit = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setTime = (key, i, v) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, times: r.times.map((x, j) => (j === i ? v : x)) } : r)));
  const addTime = (key) =>
    setRows((rs) => rs.map((r) => (r.key === key && r.times.length < 6 ? { ...r, times: [...r.times, "12:00"] } : r)));
  const removeTime = (key, i) =>
    setRows((rs) => rs.map((r) => (r.key === key && r.times.length > 1 ? { ...r, times: r.times.filter((_, j) => j !== i) } : r)));
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  const valid = rows.filter((r) => r.name.trim());
  const count = valid.reduce((n, r) => n + r.times.filter(Boolean).length, 0);

  const saveAll = async () => {
    setStage("saving");
    let added = 0;
    try {
      for (const r of valid) {
        for (const time of [...new Set(r.times.filter(Boolean))]) {
          await api.add({
            name: r.name.trim(),
            dosage: r.dosage.trim(),
            time,
            notes: r.notes?.trim() || null,
            image_url: null,
          });
          added += 1;
        }
      }
      notify(t("scan.added", { n: added }));
      await onAdded();
      onDone();
    } catch (err) {
      notify(err.message, "error");
      if (added) await onAdded();
      setStage("review");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("scan.title")}</h1>
          <p className="muted page-sub">{t("scan.subtitle")}</p>
        </div>
      </div>

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pick} />

      {(stage === "idle" || stage === "reading") && (
        <section className="card scan-drop">
          <div className="scan-icon" aria-hidden="true"><ScanLine size={34} /></div>
          {stage === "reading" ? (
            <>
              {preview && <img className="scan-preview" src={preview} alt="" />}
              <p role="status" aria-live="polite"><strong>{t("scan.reading")}</strong></p>
              <div className="scan-bar" aria-hidden="true"><span /></div>
            </>
          ) : (
            <>
              <p className="muted">{t("scan.tip")}</p>
              <div className="row-gap scan-buttons">
                <button className="btn btn-primary" onClick={() => camera.current.click()}>
                  <Camera size={18} aria-hidden="true" /> {t("scan.camera")}
                </button>
                <button className="btn btn-ghost" onClick={() => gallery.current.click()}>
                  <ImagePlus size={18} aria-hidden="true" /> {t("scan.gallery")}
                </button>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}
        </section>
      )}

      {(stage === "review" || stage === "saving") && (
        <>
          <div className="banner banner-warn">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{t("scan.warning")}</span>
          </div>

          <div className="scan-review">
            {preview && <img className="scan-preview scan-preview-side" src={preview} alt="" />}
            <div className="scan-rows">
              <h2 className="section-title">{t("scan.review")}</h2>

              {rows.length === 0 && (
                <div className="card empty"><p>{t("scan.none")}</p></div>
              )}

              {rows.map((r) => (
                <article key={r.key} className={`card scan-row ${r.uncertain ? "uncertain" : ""}`}>
                  {r.uncertain && (
                    <p className="scan-unsure"><TriangleAlert size={14} aria-hidden="true" /> {t("scan.unsure")}</p>
                  )}
                  <div className="two-col">
                    <div>
                      <label htmlFor={`n${r.key}`}>{t("form.name")}</label>
                      <input id={`n${r.key}`} value={r.name} maxLength={120} onChange={(e) => edit(r.key, { name: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`d${r.key}`}>{t("form.dosage")}</label>
                      <input id={`d${r.key}`} value={r.dosage} maxLength={120} onChange={(e) => edit(r.key, { dosage: e.target.value })} />
                    </div>
                  </div>
                  <label htmlFor={`o${r.key}`}>{t("form.notes")}</label>
                  <input id={`o${r.key}`} value={r.notes || ""} maxLength={300} onChange={(e) => edit(r.key, { notes: e.target.value })} />

                  <span className="scan-label">{t("scan.times")}</span>
                  <div className="row-gap scan-times">
                    {r.times.map((time, i) => (
                      <span key={i} className="time-chip">
                        <input type="time" aria-label={t("form.time")} value={time} onChange={(e) => setTime(r.key, i, e.target.value)} />
                        {r.times.length > 1 && (
                          <button type="button" className="icon-btn" onClick={() => removeTime(r.key, i)} aria-label={t("common.remove")}><X size={14} /></button>
                        )}
                      </span>
                    ))}
                    {r.times.length < 6 && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => addTime(r.key)}>
                        <Plus size={14} aria-hidden="true" /> {t("scan.add_time")}
                      </button>
                    )}
                    <span className="spacer" />
                    <button type="button" className="icon-btn danger" onClick={() => removeRow(r.key)} aria-label={t("common.remove")}><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}

              <div className="modal-actions scan-actions">
                <button className="btn btn-ghost" onClick={reset} disabled={stage === "saving"}>{t("scan.again")}</button>
                <button className="btn btn-primary" onClick={saveAll} disabled={stage === "saving" || count === 0}>
                  {stage === "saving" ? t("form.saving") : t("scan.add_all", { n: count })}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
