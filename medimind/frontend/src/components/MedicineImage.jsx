import { useState } from "react";
import { Pill } from "lucide-react";

// Shows the medicine photo, or a default pill icon if missing / broken.
export default function MedicineImage({ src, name, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <div className="med-img med-img-default" style={style} aria-hidden="true">
        <Pill size={Math.round(size * 0.5)} />
      </div>
    );
  }
  return (
    <img
      className="med-img"
      style={style}
      src={src}
      alt={`${name} medicine`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
