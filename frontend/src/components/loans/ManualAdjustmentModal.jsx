import React from "react";
import { X } from "lucide-react";
import { Input, Select, TextArea } from "../forms/FormComponents";

export default function ManualAdjustmentModal({
    show,
    amount,
    type,
    reason,
    onAmountChange,
    onTypeChange,
    onReasonChange,
    onClose,
    onSubmit,
    submitting,
}) {
    if (!show) return null;

    const typeOptions = [
        { value: "overpaid", label: "Credit (overpaid)" },
        { value: "underpaid", label: "Deficit (underpaid)" },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-800">Manual adjustment</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <Input
                        label="Adjustment amount (₹)"
                        name="manualAdjustmentAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        handleChange={(e) => onAmountChange(e.target.value)}
                        required
                    />
                    <Select
                        label="Type"
                        name="manualAdjustmentType"
                        value={type}
                        options={typeOptions}
                        handleChange={(e) => onTypeChange(e.target.value)}
                        required
                    />
                    <TextArea
                        label="Reason"
                        name="manualAdjustmentReason"
                        value={reason}
                        handleChange={(e) => onReasonChange(e.target.value)}
                        rows={3}
                        placeholder="e.g. Partial waiver as per committee"
                    />
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting || !amount || !type}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                    >
                        {submitting ? "Applying…" : "Apply"}
                    </button>
                </div>
            </div>
        </div>
    );
}
