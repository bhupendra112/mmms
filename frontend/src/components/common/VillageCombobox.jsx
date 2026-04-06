import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search } from "lucide-react";
import { STATIC_VILLAGES } from "../../constants/staticVillages";

/**
 * Searchable village field: pick from STATIC_VILLAGES or type any custom village.
 * Fires the same change shape as Input: `handleChange({ target: { name, value } })`.
 */
export default function VillageCombobox({
    label,
    name,
    value,
    handleChange,
    required = false,
    disabled = false,
    placeholder = "Search or type village name",
    villages = STATIC_VILLAGES,
    helperText = "Search the list or type a different village.",
    className = "",
}) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    const str = (value ?? "").toString();
    const filtered = useMemo(() => {
        const q = str.trim().toLowerCase();
        if (!q) return villages;
        return villages.filter((v) => v.toLowerCase().includes(q));
    }, [str, villages]);

    const commitValue = useCallback(
        (next) => {
            handleChange({
                target: { name, value: next },
            });
        },
        [handleChange, name]
    );

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
                setHighlight(-1);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const onInputChange = (e) => {
        commitValue(e.target.value);
        setOpen(true);
        setHighlight(-1);
    };

    const onPick = (v) => {
        commitValue(v);
        setOpen(false);
        setHighlight(-1);
        inputRef.current?.focus();
    };

    const onKeyDown = (e) => {
        if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            setHighlight(0);
            e.preventDefault();
            return;
        }
        if (!open) return;
        if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
            e.preventDefault();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter" && highlight >= 0 && filtered[highlight]) {
            e.preventDefault();
            onPick(filtered[highlight]);
        }
    };

    const inputId = `village-combobox-${name}`;

    return (
        <div className={`flex flex-col ${className}`} ref={wrapRef}>
            <label htmlFor={inputId} className="font-semibold mb-1.5 text-gray-700 text-sm">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-[1]"
                    size={16}
                    aria-hidden
                />
                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    name={name}
                    autoComplete="off"
                    value={str}
                    onChange={onInputChange}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    required={required}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                        disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""
                    }`}
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    aria-controls={`${inputId}-listbox`}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled}
                    onClick={() => {
                        if (disabled) return;
                        setOpen((o) => !o);
                        inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-700 rounded disabled:opacity-50"
                    aria-label="Toggle village list"
                >
                    <ChevronDown size={18} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                {open && !disabled && (
                    <ul
                        id={`${inputId}-listbox`}
                        role="listbox"
                        className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                    >
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-500">No matches in list — your typed text will still be saved.</li>
                        ) : (
                            filtered.map((v, i) => (
                                <li key={v}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={str === v}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                            i === highlight ? "bg-blue-50" : ""
                                        } ${str === v ? "font-semibold text-blue-800" : "text-gray-800"}`}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => onPick(v)}
                                    >
                                        {v}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
            {helperText && (
                <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            )}
        </div>
    );
}
