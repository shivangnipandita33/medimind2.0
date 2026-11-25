import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import MedicineImage from "./MedicineImage";
import { toInputValue } from "../utils/time";
import { fileToSmallDataUrl } from "../utils/image";
import { useI18n } from "../i18n/I18nProvider";

/** Modal for adding or editing a medicine. `medicine` = null means "add". */
export default function MedicineForm({ medicine, onSave, onClose }) {
  const { t } = useI18n();
  const editing = Boolean(medicine);
  const [form, setForm] = useState({
    name: medicine?.name || "",
    dosage: medicine?.dosage || "",
    time: toInputValue(medicine?.time) || "08:00",
    notes: medicine?.notes || "",
    image_url: medicine?.image_url || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file);
      setForm((f) => ({ ...f, image_url: url }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.dosage.trim() || !form.time) {
      setError(t("form.required"));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        time: form.time,
        notes: form.notes.trim() || null,
        image_url: form.image_url.trim() || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onSubmit={submit}
      >
        <div className="modal-head">
          <h2 id="form-title">{editing ? t("form.edit") : t("form.add")}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="image-row">
          <MedicineImage src={form.image_url} name={form.name || "Medicine"} size={72} />
          <div className="image-fields">
            <label htmlFor="image_url">{t("form.image_url")}</label>
            <input
              id="image_url"
              type="url"
              placeholder="https://…"
              value={form.image_url.startsWith("data:") ? "" : form.image_url}
              onChange={set("image_url")}
            />
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
            <div className="row-gap">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileInput.current.click()}>
                <ImagePlus size={15} aria-hidden="true" /> {t("form.upload")}
              </button>
              {form.image_url && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                  {t("common.remove")}
                </button>
              )}
            </div>
          </div>
        </div>

        <label htmlFor="name">{t("form.name")}</label>
        <input id="name" ref={firstField} value={form.name} onChange={set("name")} placeholder="e.g. Vitamin D" maxLength={120} required />

        <div className="two-col">
          <div>
            <label htmlFor="dosage">{t("form.dosage")}</label>
            <input id="dosage" value={form.dosage} onChange={set("dosage")} placeholder="e.g. 1 tablet / 500 mg" maxLength={120} required />
          </div>
          <div>
            <label htmlFor="time">{t("form.time")}</label>
            <input id="time" type="time" value={form.time} onChange={set("time")} required />
          </div>
        </div>

        <label htmlFor="notes">{t("form.notes")}</label>
        <input id="notes" value={form.notes} onChange={set("notes")} placeholder="e.g. after breakfast" maxLength={500} />

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t("form.saving") : editing ? t("form.save_changes") : t("form.add")}
          </button>
        </div>
      </form>
    </div>
  );
}
