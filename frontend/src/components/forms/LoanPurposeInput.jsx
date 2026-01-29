import React, { useState, useRef, useEffect } from "react";
import { LOAN_PURPOSES } from "../../constants/loanPurposes";

/**
 * Searchable loan purpose input: shows ALL purposes; filter by keyword when typing (matching kept).
 * User can select a suggestion or type custom purpose.
 * Used in both admin and group panel loan taking.
 */
export function LoanPurposeInput({ label = "Purpose", name = "purpose", value, onChange, required = false, placeholder = "Search or type purpose of loan" }) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);

  const keyword = (value || "").trim().toLowerCase();
  // Show all purposes when empty; when typing, show all that match (no limit)
  const suggestions = keyword
    ? LOAN_PURPOSES.filter((p) => p.toLowerCase().includes(keyword))
    : LOAN_PURPOSES;

  const handleChange = (e) => {
    onChange(e);
    setOpen(true);
    setHighlightIndex(-1);
  };

  const handleSelect = (option) => {
    onChange({ target: { name, value: option } });
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
      return;
    }
    if (e.key === "Enter" && highlightIndex >= 0 && suggestions[highlightIndex]) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
      return;
    }
  };

  useEffect(() => {
    const handleClickOutside = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col relative" ref={containerRef}>
      <label className="font-semibold mb-1.5 text-gray-700 text-sm">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        name={name}
        value={value || ""}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto text-sm"
          role="listbox"
        >
          {suggestions.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={highlightIndex === i}
              className={`px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-b-0 ${highlightIndex === i ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"
                }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(option);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
