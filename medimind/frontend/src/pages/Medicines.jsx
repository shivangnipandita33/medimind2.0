import { useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import MedicineCard from "../components/MedicineCard";
import { byTime } from "../utils/time";
import { useI18n } from "../i18n/I18nProvider";

const FILTERS = ["All", "Pending", "Taken", "Snoozed", "Missed"];

export default function Medicines({ medicines, query, onStatus, onEdit, onDelete, onAdd }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("All");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return medicines
      .filter((m) => filter === "All" || m.status === filter)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.dosage || "").toLowerCase().includes(q))
      .sort(byTime);
  }, [medicines, query, filter]);

  return (
    <>
      <div className="page-head">
        <h1>{t("meds.title")}</h1>
        <button className="btn btn-primary" onClick={onAdd}>+ {t("common.add_medicine")}</button>
      </div>

      <div className="filters" role="tablist" aria-label={t("nav.medicines")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`pill ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "All" ? t("meds.all") : t(`status.${f}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          <PackageOpen size={36} aria-hidden="true" />
          <p>{query || filter !== "All" ? t("meds.no_match") : t("meds.none")}</p>
          {!query && filter === "All" && <button className="btn btn-primary" onClick={onAdd}>{t("meds.add_first")}</button>}
        </div>
      ) : (
        <div className="grid">
          {visible.map((m) => (
            <MedicineCard key={m.id} medicine={m} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </>
  );
}
