import { useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;
  const Icon = toast.type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <Icon size={18} aria-hidden="true" /> {toast.message}
    </div>
  );
}
