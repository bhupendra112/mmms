import React, { useState, useRef, useEffect } from "react";
import { User, LogOut } from "lucide-react";

/**
 * Reusable user icon with dropdown containing Log out.
 * Used in Admin and Group navbars.
 * @param {() => void} onLogout - Called when user clicks Log out (after optional confirm)
 * @param {string} [confirmMessage] - If provided, show confirm dialog before calling onLogout
 */
export default function UserDropdown({ onLogout, confirmMessage }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLogoutClick = () => {
    setOpen(false);
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    onLogout?.();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer p-2 hover:bg-gray-100 rounded-md transition-colors"
        aria-label="User menu"
      >
        <User size={20} className="text-gray-700" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
