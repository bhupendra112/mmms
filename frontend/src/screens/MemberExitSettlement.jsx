import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Wallet, CreditCard, CheckCircle } from "lucide-react";
import BackButton from "../components/admin/BackButton";
import { getMemberExitSummary, createMemberExitSettlement, voidMemberExitSettlement } from "../services/memberService";
import { getGroupBanks as getGroupBanksOnline } from "../services/groupService";
import { getGroupBanks as getGroupBanksOffline } from "../services/groupServiceOffline";
import { getCashAmount } from "../services/cashAmount";
import { formatCurrency } from "../utils/memberUtils";

const EXIT_DATE = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MemberExitSettlement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state?.exitState || null;

  const [loading, setLoading] = useState(!initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(initialState?.summary || null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const [payoutMode, setPayoutMode] = useState("Cash");
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");

  const [groupCashBalance, setGroupCashBalance] = useState(0);

  const [paymentReference, setPaymentReference] = useState(initialState?.paymentReference || "");
  const [notes, setNotes] = useState("");
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (summary || !id) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getMemberExitSummary(id);
        if (!res?.success) {
          throw new Error(res?.message || "Failed to load exit summary");
        }
        setSummary(res.data);
      } catch (e) {
        console.error("Failed to load exit summary:", e);
        setError(String(e?.message || e || "Failed to load exit summary"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, summary]);

  // Load current cash balance once summary (and groupId) is available
  useEffect(() => {
    const groupId = summary?.member?.groupId;
    if (!groupId) {
      setGroupCashBalance(0);
      return;
    }
    getCashAmount(groupId)
      .then((res) => {
        const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
        setGroupCashBalance(balance);
      })
      .catch((e) => {
        console.error("Failed to load group cash balance:", e);
        setGroupCashBalance(0);
      });
  }, [summary]);

  // Load banks when groupId is known (for both GROUP_PAYS and MEMBER_PAYS),
  // using the same online/offline strategy as PaymentManagement/LoanTaking
  useEffect(() => {
    const groupId = summary?.member?.groupId;
    if (!groupId) {
      setBanks([]);
      setSelectedBankId("");
      return;
    }

    const loadBanks = async () => {
      setBanksLoading(true);
      try {
        const useOnline = typeof navigator !== "undefined" && navigator.onLine;
        const res = useOnline
          ? await getGroupBanksOnline(groupId)
          : await getGroupBanksOffline(groupId);

        // Shape:
        // - Online: { success, data: banks } or sometimes { data: { data: banks } }
        // - Offline: { success, data: banks }
        const list = useOnline
          ? (res?.success && Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : [])
          : (res?.success && Array.isArray(res?.data) ? res.data : []);

        const mapped = list.map((b) => {
          const availableBalance =
            b.available_balance !== undefined
              ? b.available_balance
              : b.current_balance !== undefined
                ? b.current_balance
                : b.opening_balance || 0;
          return {
            id: b._id || b.id,
            name: b.bank_name,
            accountNo: b.account_no,
            available_balance: availableBalance,
            current_balance: b.current_balance,
            opening_balance: b.opening_balance,
            label: `${b.bank_name} - ${b.account_no}${b.short_name ? ` (${b.short_name})` : ""} [Available: ₹${availableBalance.toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}]`,
          };
        });

        setBanks(mapped);
      } catch (e) {
        console.error("Failed to load banks for group:", e);
        setBanks([]);
      } finally {
        setBanksLoading(false);
      }
    };

    loadBanks();
  }, [summary]);

  const handleConfirm = async () => {
    if (!summary || !id || !confirmChecked) return;

    try {
      setSaving(true);
      setError("");

      const payload = {
        memberId: id,
        confirmedNetAmount: summary.totals.netAmount,
        direction: summary.totals.direction,
        payoutPaymentMode: summary.totals.netAmount !== 0 ? payoutMode : undefined,
        bankId: payoutMode === "Bank" ? selectedBankId || undefined : undefined,
        paymentReference,
        paymentDate: new Date().toISOString(),
        notes,
      };

      let res = await createMemberExitSettlement(payload);
      if (!res?.success) {
        const msg = String(res?.message || "");
        if (msg.toLowerCase().includes("already been settled")) {
          const voidRes = await voidMemberExitSettlement(id);
          if (voidRes?.success) {
            res = await createMemberExitSettlement(payload);
            if (res?.success) {
              setSuccessModal(true);
              return;
            }
          }
        }
        throw new Error(res?.message || msg || "Failed to save exit settlement");
      }

      setSuccessModal(true);
    } catch (e) {
      const msg = String(e?.response?.data?.message || e?.message || e || "");
      if (msg.toLowerCase().includes("already been settled") && id && summary && confirmChecked) {
        try {
          const voidRes = await voidMemberExitSettlement(id);
          if (voidRes?.success) {
            const retryRes = await createMemberExitSettlement({
              memberId: id,
              confirmedNetAmount: summary.totals.netAmount,
              direction: summary.totals.direction,
              payoutPaymentMode: summary.totals.netAmount !== 0 ? payoutMode : undefined,
              bankId: payoutMode === "Bank" ? selectedBankId || undefined : undefined,
              paymentReference,
              paymentDate: new Date().toISOString(),
              notes,
            });
            if (retryRes?.success) {
              setSuccessModal(true);
              return;
            }
          }
        } catch (_) {}
      }
      console.error("Failed to save exit settlement:", e);
      setError(msg || "Failed to save exit settlement");
    } finally {
      setSaving(false);
    }
  };

  const handleVoidAndRetry = async () => {
    if (!id) return;
    try {
      setVoiding(true);
      setError("");
      const res = await voidMemberExitSettlement(id);
      if (!res?.success) throw new Error(res?.message || "Failed to void settlement");
      setSummary(null);
      setConfirmChecked(false);
    } catch (e) {
      console.error("Failed to void settlement:", e);
      setError(String(e?.message || e || "Failed to void settlement"));
    } finally {
      setVoiding(false);
    }
  };

  const isAlreadySettledError = error && String(error).toLowerCase().includes("already been settled");

  const paymentRequired = summary?.totals?.netAmount !== 0;
  const paymentModeValid = !paymentRequired || (payoutMode === "Cash") || (payoutMode === "Bank" && selectedBankId);
  const canConfirm = summary && !saving && !error && confirmChecked && paymentModeValid;

  if (!id) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Member ID is missing.
        </div>
      </div>
    );
  }

  return (
    <div className="member-exit-settlement-main w-full max-w-full overflow-x-hidden box-border">
      <div className="w-full max-w-full min-w-0 overflow-x-hidden px-2 sm:px-4">
        <div className="w-full max-w-[380px] sm:max-w-[720px] md:max-w-[920px] lg:max-w-[1200px] mr-auto mx-0 min-w-0 flex flex-col gap-4 py-4">
          <BackButton fallback={id ? (location.pathname.startsWith("/group") ? `/group/members/${id}` : `/admin/members/${id}`) : (location.pathname.startsWith("/group") ? "/group/members" : "/admin/members")} label="Back to member" className="mb-2" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                Member Exit – Demand &amp; Recovery
              </h1>
              {summary?.member && (
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {summary.member.name} ({summary.member.code}) – {summary.member.groupName}
                </p>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading exit summary…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col gap-2 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
              {isAlreadySettledError && (
                <button
                  type="button"
                  onClick={handleVoidAndRetry}
                  disabled={voiding}
                  className="self-start inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-60"
                >
                  {voiding ? "Voiding…" : "Void previous settlement and retry"}
                </button>
              )}
            </div>
          )}

          {!loading && summary && (
            <>
              {/* Section 1 — Member info card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Member info</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name</span>
                    <p className="font-medium text-gray-800">{summary.member?.name ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Group</span>
                    <p className="font-medium text-gray-800">{summary.member?.groupName ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Join date</span>
                    <p className="font-medium text-gray-800">{summary.member?.joinDate ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Exit date</span>
                    <p className="font-medium text-gray-800">{EXIT_DATE}</p>
                  </div>
                </div>
              </div>

              {/* Section 2 — Assets (group will pay member) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Assets (group will pay member)</h2>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Saving closing balance</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.saving?.closing ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">FD closing balance</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.fd?.closing ?? 0)}</td>
                    </tr>
                    <tr className="bg-green-50">
                      <td className="py-2 font-semibold text-gray-800">Total payable to member</td>
                      <td className="py-2 text-right font-bold text-green-700">{formatCurrency(summary.totals?.totalPayoutToMember ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 3 — Liabilities (member must pay group) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Liabilities (member must pay group)</h2>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Loan outstanding</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.loan?.unpaid ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Interest outstanding</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.interest?.unpaid ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Yogdan unpaid</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.yogdan?.unpaid ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Membership fees unpaid</td>
                      <td className="py-2 text-right font-medium">{formatCurrency((summary.heads?.membershipFee?.unpaid ?? 0) + (summary.heads?.groupFee?.unpaid ?? 0))}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">Other charges / penalty unpaid</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(summary.heads?.charges?.unpaid ?? 0)}</td>
                    </tr>
                    <tr className="bg-red-50">
                      <td className="py-2 font-semibold text-gray-800">Total dues from member</td>
                      <td className="py-2 text-right font-bold text-red-700">{formatCurrency(summary.totals?.totalDuesFromMember ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 4 — Final settlement result */}
              <div className="flex justify-center">
                <div
                  className={`rounded-xl border-2 p-6 text-center min-w-[280px] ${
                    summary.totals?.direction === "GROUP_PAYS"
                      ? "bg-green-50 border-green-200"
                      : summary.totals?.direction === "MEMBER_PAYS"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  {summary.totals?.direction === "GROUP_PAYS" && (
                    <p className="text-lg font-bold text-green-800">Group must pay member {formatCurrency(Math.abs(summary.totals?.netAmount ?? 0))}</p>
                  )}
                  {summary.totals?.direction === "MEMBER_PAYS" && (
                    <p className="text-lg font-bold text-red-800">Member must pay group {formatCurrency(summary.totals?.netAmount ?? 0)}</p>
                  )}
                  {summary.totals?.direction === "SETTLED" && (
                    <p className="text-lg font-bold text-gray-700">No payment required. Member fully settled.</p>
                  )}
                </div>
              </div>

              {/* Section 5 — Payment mode (only if money moves) */}
              {summary.totals?.netAmount !== 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-800 mb-3">Payment mode</h2>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="payoutMode"
                          checked={payoutMode === "Cash"}
                          onChange={() => { setPayoutMode("Cash"); setSelectedBankId(""); }}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm font-medium">Cash</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="payoutMode"
                          checked={payoutMode === "Bank"}
                          onChange={() => setPayoutMode("Bank")}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm font-medium">Bank</span>
                      </label>
                    </div>
                    {payoutMode === "Bank" && (
                      <div className="flex-1 max-w-xs">
                        <label className="block text-xs text-gray-600 mb-1">Group bank account</label>
                        <select
                          value={selectedBankId}
                          onChange={(e) => setSelectedBankId(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={banksLoading || banks.length === 0}
                        >
                          <option value="">Select bank</option>
                          {banks.map((b) => (
                            <option key={b.id} value={b.id}>{b.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {payoutMode === "Cash" && (
                    <p className="mt-2 text-xs text-gray-500">Available cash balance: {formatCurrency(groupCashBalance)}</p>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs text-gray-600 mb-1">Reference / Remarks</label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="Receipt no, bank txn id, etc."
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="Extra details…"
                    />
                  </div>
                </div>
              )}

              {/* Section 6 — Confirmation */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <label className="flex items-start gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-800">I confirm this settlement is correct and final</span>
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Saving…
                      </>
                    ) : (
                      "Confirm settlement"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Success modal */}
          {successModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
                <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-2">Settlement recorded</h3>
                <p className="text-sm text-gray-600 mb-6">Member exit settlement has been saved successfully.</p>
                <button
                  type="button"
                  onClick={() => { setSuccessModal(false); navigate(-1); }}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                >
                  Back to member
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
