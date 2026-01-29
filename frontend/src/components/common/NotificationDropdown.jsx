import React, { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Reusable notification bell with badge and dropdown.
 * Used in both Admin and Group navbars for approval notifications.
 * @param {number} count - Badge count (hidden when 0)
 * @param {Array<{ id: string, type: string, title: string, status: string, time: string|number, link?: string }>} items - Recent items for dropdown
 * @param {string} viewAllPath - Route for "View all" link
 * @param {string} emptyMessage - Message when no items
 * @param {boolean} loading - Show loading state in dropdown
 * @param {string} badgeColor - Optional Tailwind class for badge (default red)
 */
export default function NotificationDropdown({
  count = 0,
  items = [],
  viewAllPath = "#",
  emptyMessage = "No notifications",
  loading = false,
  badgeColor = "bg-red-500",
}) {
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

  const displayCount = Math.min(99, Math.max(0, count));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative cursor-pointer p-2 hover:bg-gray-100 rounded-md transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-700" />
        {displayCount > 0 && (
          <span
            className={`absolute top-0 right-0 ${badgeColor} text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}
          >
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100 font-semibold text-sm text-gray-800">
            Notifications
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">{emptyMessage}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        to={item.link}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-800 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                        {item.status && (
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${item.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : item.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <div className="px-3 py-2.5 text-sm">
                        <p className="font-medium text-gray-800 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                        {item.status && (
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${item.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : item.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {items.length > 0 && viewAllPath && (
            <div className="p-2 border-t border-gray-100">
              <Link
                to={viewAllPath}
                onClick={() => setOpen(false)}
                className="block text-center py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                View all
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
