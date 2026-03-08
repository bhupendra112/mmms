import React, { useState, useEffect, useCallback } from "react";
import { X, Calculator, Loader2, AlertCircle } from "lucide-react";
import { Input } from "../forms/FormComponents";
import { previewLoanEdit, updateLoan } from "../../services/loanService";
import ManualAdjustmentModal from "./ManualAdjustmentModal";

const formatDateForInput = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export default function EditLoanModal({
    show,
    loan,
    onClose,
    onSuccess,
}) {
    const [form, setForm] = useState({
        date: "",
        time_period: "",
        loan_rate_snapshot: "",
        amount: "",
    });
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [actionTaken, setActionTaken] = useState(null);
    const [manualOverride, setManualOverride] = useState(null);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualAmount, setManualAmount] = useState("");
    const [manualType, setManualType] = useState("overpaid");
    const [manualReason, setManualReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const loanId = loan?._id || loan?.id;
    const isApproved = loan?.status === "approved";

    const buildPreviewBody = useCallback(() => {
        const body = {};
        if (form.date) body.date = form.date;
        if (form.amount !== "" && form.amount != null) body.amount = parseFloat(form.amount);
        if (form.time_period !== "" && form.time_period != null) body.time_period = parseFloat(form.time_period);
        if (form.loan_rate_snapshot !== "" && form.loan_rate_snapshot != null) body.loan_rate_snapshot = parseFloat(form.loan_rate_snapshot);
        return body;
    }, [form]);

    const hasFormChanges = useCallback(() => {
        if (!loan) return false;
        const d = formatDateForInput(loan.date);
        const tp = loan.time_period != null ? (loan.time_period / 12).toFixed(1) : "";
        const rate = loan.loan_rate_snapshot ?? "";
        const amt = loan.amount ?? "";
        return form.date !== d || String(form.time_period) !== String(tp) || String(form.loan_rate_snapshot) !== String(rate) || String(form.amount) !== String(amt);
    }, [loan, form]);

    const fetchPreview = useCallback(async () => {
        if (!loanId || !isApproved) return;
        const body = buildPreviewBody();
        if (Object.keys(body).length === 0) {
            setPreview(null);
            return;
        }
        setPreviewError(null);
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const res = await previewLoanEdit(loanId, body);
            const data = res?.data ?? res;
            setPreview(data);
        } catch (err) {
            setPreviewError(err?.response?.data?.message || err?.message || "Preview failed");
            setPreview(null);
        } finally {
            setPreviewLoading(false);
        }
    }, [loanId, isApproved, buildPreviewBody]);

    useEffect(() => {
        if (!show || !loan) return;
        setForm({
            date: formatDateForInput(loan.date),
            time_period: loan.time_period != null ? (loan.time_period / 12).toFixed(1) : "",
            loan_rate_snapshot: loan.loan_rate_snapshot ?? "",
            amount: loan.amount ?? "",
        });
        setPreview(null);
        setPreviewError(null);
        setActionTaken(null);
        setManualOverride(null);
        setShowManualModal(false);
        setManualAmount("");
        setManualType("overpaid");
        setManualReason("");
        setShowConfirm(false);
    }, [show, loan]);

    useEffect(() => {
        if (!show || !loanId || !isApproved) return;
        const body = buildPreviewBody();
        if (Object.keys(body).length === 0) return;
        const t = setTimeout(fetchPreview, 400);
        return () => clearTimeout(t);
    }, [show, loanId, isApproved, form.date, form.amount, form.time_period, form.loan_rate_snapshot, fetchPreview, buildPreviewBody]);

    const handleChange = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setActionTaken(null);
        setManualOverride(null);
    };

    const handleManualApply = () => {
        const amount = parseFloat(manualAmount);
        if (isNaN(amount) || amount < 0) return;
        setManualOverride({
            amount: amount,
            type: manualType,
            reason: manualReason,
        });
        setActionTaken("manual");
        setShowManualModal(false);
    };

    const handleSaveClick = () => {
        if (previewLoading || !preview) return;
        const status = preview.status;
        if (status === "overpaid" && !actionTaken) return;
        if (status === "underpaid" && !actionTaken) return;
        setShowConfirm(true);
    };

    const handleConfirmSave = async () => {
        if (!loanId) return;
        setSubmitting(true);
        try {
            const payload = {
                date: form.date || undefined,
                amount: form.amount !== "" ? parseFloat(form.amount) : undefined,
                time_period: form.time_period !== "" ? Math.round(parseFloat(form.time_period)) : undefined,
                loan_rate_snapshot: form.loan_rate_snapshot !== "" ? parseFloat(form.loan_rate_snapshot) : undefined,
                interestRate: form.loan_rate_snapshot !== "" ? parseFloat(form.loan_rate_snapshot) : undefined,
            };

            if (actionTaken) payload.actionTaken = actionTaken;
            if (manualOverride) {
                payload.manualOverrideAmount = manualOverride.amount;
                payload.manualAdjustmentType = manualOverride.type;
                payload.manualAdjustmentReason = manualOverride.reason || "";
            }

            await updateLoan(loanId, payload);
            setShowConfirm(false);
            onSuccess?.();
            onClose?.();
        } catch (err) {
            console.error("Update loan failed:", err);
            setPreviewError(err?.response?.data?.message || err?.message || "Update failed");
        } finally {
            setSubmitting(false);
        }
    };

    if (!show || !loan) return null;

    const status = preview?.status;
    const overpaidAmount = preview?.overpaidAmount ?? preview?.newState?.overpayment ?? 0;
    const underpaidAmount = preview?.underpaidAmount ?? preview?.newState?.underpayment ?? 0;
    const hasOverpaid = status === "overpaid" && (overpaidAmount > 0 || preview?.newState?.overpayment > 0);
    const hasUnderpaid = status === "underpaid" && (underpaidAmount > 0 || preview?.newState?.underpayment > 0);
    const needsAction = hasOverpaid || hasUnderpaid;
    const canSave = preview && (!needsAction || actionTaken) && !previewLoading && hasFormChanges();

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-4">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                        <h2 className="text-lg font-semibold text-gray-800">Edit loan</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                            aria-label="Close"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="p-4 sm:p-6 space-y-6">
                        {/* Form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => handleChange("date", e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <Input
                                    label="Tenure (years)"
                                    name="time_period"
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    placeholder="e.g. 2"
                                    value={form.time_period}
                                    handleChange={(e) => handleChange("time_period", e.target.value)}
                                />
                            </div>
                            <div>
                                <Input
                                    label="Interest rate (%)"
                                    name="loan_rate_snapshot"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.loan_rate_snapshot}
                                    handleChange={(e) => handleChange("loan_rate_snapshot", e.target.value)}
                                />
                            </div>
                            <div>
                                <Input
                                    label="Loan amount (₹)"
                                    name="amount"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={form.amount}
                                    handleChange={(e) => handleChange("amount", e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Recalculation preview */}
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Calculator size={18} className="text-blue-600" />
                                Recalculation preview
                            </h3>
                            {previewError && (
                                <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
                                    <AlertCircle size={16} />
                                    {previewError}
                                </div>
                            )}
                            {previewLoading && (
                                <div className="flex items-center gap-2 text-gray-600 text-sm py-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    Recalculating…
                                </div>
                            )}
                            {!previewLoading && preview && (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                        <div>
                                            <p className="text-gray-500">Old total payable</p>
                                            <p className="font-semibold text-gray-800">₹{(preview.oldTotalPayable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">New total payable</p>
                                            <p className="font-semibold text-gray-800">₹{(preview.newTotalPayable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Difference</p>
                                            <p className="font-semibold text-gray-800">₹{(preview.difference ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Status</p>
                                            <span
                                                className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                                    status === "overpaid"
                                                        ? "bg-green-100 text-green-800 border border-green-200"
                                                        : status === "underpaid"
                                                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                            : "bg-gray-100 text-gray-700 border border-gray-200"
                                                }`}
                                            >
                                                {status === "overpaid" ? "Overpaid" : status === "underpaid" ? "Underpaid" : "No change"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Adjustment decision */}
                                    {hasOverpaid && (
                                        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                                            <p className="text-sm text-green-800 font-medium">
                                                Member has overpaid ₹{(preview.overpaidAmount ?? preview.newState?.overpayment ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} due to loan change.
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setActionTaken("advance")}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${actionTaken === "advance" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                                >
                                                    Keep as advance
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActionTaken("refund")}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${actionTaken === "refund" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                                >
                                                    Refund to member
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowManualModal(true)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${actionTaken === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                                >
                                                    Manual adjustment
                                                </button>
                                            </div>
                                            {actionTaken === "manual" && manualOverride && (
                                                <p className="text-xs text-gray-600 mt-2">
                                                    Manual: ₹{manualOverride.amount} ({manualOverride.type}) {manualOverride.reason && `— ${manualOverride.reason}`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {hasUnderpaid && (
                                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                            <p className="text-sm text-amber-800 font-medium">
                                                Member will owe ₹{(preview.underpaidAmount ?? preview.newState?.underpayment ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} more.
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setActionTaken("deficit")}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${actionTaken === "deficit" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                                >
                                                    Add to future demand
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowManualModal(true)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${actionTaken === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                                >
                                                    Manual adjustment
                                                </button>
                                            </div>
                                            {actionTaken === "manual" && manualOverride && (
                                                <p className="text-xs text-gray-600 mt-2">
                                                    Manual: ₹{manualOverride.amount} ({manualOverride.type}) {manualOverride.reason && `— ${manualOverride.reason}`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={!canSave || submitting}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm inline-flex items-center gap-2"
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                            Save
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation dialog */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <p className="text-gray-800 font-medium mb-4">Save loan changes and apply the selected adjustment?</p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSave}
                                disabled={submitting}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                            >
                                {submitting ? "Saving…" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ManualAdjustmentModal
                show={showManualModal}
                amount={manualAmount}
                type={manualType}
                reason={manualReason}
                onAmountChange={setManualAmount}
                onTypeChange={setManualType}
                onReasonChange={setManualReason}
                onClose={() => setShowManualModal(false)}
                onSubmit={handleManualApply}
                submitting={false}
            />
        </>
    );
}
