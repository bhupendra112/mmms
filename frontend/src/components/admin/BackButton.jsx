import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Reusable Back button for admin/group panels.
 * Uses browser history when available, otherwise navigates to fallback route.
 *
 * @param {string} [fallback] - Route to go to when history is empty (e.g. direct URL visit)
 * @param {string} [label="Back"] - Button text
 * @param {string} [className] - Additional CSS classes for the wrapper
 */
export default function BackButton({ fallback = "/admin/dashboard", label = "Back", className = "" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium text-sm transition-colors ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={18} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}
