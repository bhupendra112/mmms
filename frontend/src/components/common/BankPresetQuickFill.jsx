import { useState, useEffect } from "react";
import { DEFAULT_BANK_PRESETS } from "../../constants/defaultBankPresets";

/**
 * @param {"group"|"member"} variant — field names: group uses bank_name/branch_name/ifsc; member uses Bank_Name/Br_Name/Ifsc_No
 * @param {(patch: Record<string, string>) => void} onApply — merge returned fields into your form state
 * @param {string} [resetKey] — change when parent form resets to clear the dropdown selection
 */
export default function BankPresetQuickFill({ variant = "group", onApply, resetKey = "", className = "" }) {
  const [selected, setSelected] = useState("");

  useEffect(() => {
    setSelected("");
  }, [resetKey]);

  const handleChange = (e) => {
    const v = e.target.value;
    setSelected(v);

    if (!v || v === "__custom__") {
      return;
    }

    const preset = DEFAULT_BANK_PRESETS.find((p) => p.id === v);
    if (!preset || !onApply) return;

    if (variant === "member") {
      onApply({
        Bank_Name: preset.bankName,
        Br_Name: preset.branchName,
        Ifsc_No: preset.ifsc,
      });
    } else {
      onApply({
        bank_name: preset.bankName,
        branch_name: preset.branchName,
        ifsc: preset.ifsc,
      });
    }
  };

  return (
    <div
      className={`rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 sm:p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-gray-800 mb-1">Quick fill — common banks</p>
      <p className="text-xs text-gray-600 mb-2">
        Fills bank name, branch, and IFSC. You can still edit the fields or enter a different bank manually.
      </p>
      <select
        value={selected}
        onChange={handleChange}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      >
        <option value="">— Select a bank to auto-fill name, branch &amp; IFSC —</option>
        {DEFAULT_BANK_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.bankName} — {p.branchName} ({p.ifsc})
          </option>
        ))}
        <option value="__custom__">Other — type bank details manually below</option>
      </select>
    </div>
  );
}
