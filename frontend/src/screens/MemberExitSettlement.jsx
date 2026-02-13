import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Wallet, CreditCard } from "lucide-react";
import { getMemberExitSummary, createMemberExitSettlement } from "../services/memberService";
import { getGroupBanks as getGroupBanksOnline } from "../services/groupService";
import { getGroupBanks as getGroupBanksOffline } from "../services/groupServiceOffline";
import { getCashAmount } from "../services/cashAmount";
import { formatCurrency } from "../utils/memberUtils";

export default function MemberExitSettlement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state?.exitState || null;

  const [loading, setLoading] = useState(!initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(initialState?.summary || null);

  const [payoutMode, setPayoutMode] = useState("Cash"); // Cash | Bank when GROUP_PAYS
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [memberPaymentModeNote, setMemberPaymentModeNote] = useState("OFFLINE"); // note only

  const [groupCashBalance, setGroupCashBalance] = useState(0);

  const [paymentReference, setPaymentReference] = useState(initialState?.paymentReference || "");
  const [notes, setNotes] = useState("");

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
    if (!summary || !id) return;

    try {
      setSaving(true);
      setError("");

      const direction = summary.totals.direction;

      const payload = {
        memberId: id,
        confirmedNetAmount: summary.totals.netAmount,
        direction,
        payoutPaymentMode: summary.totals.netAmount !== 0 ? payoutMode : undefined,
        bankId: payoutMode === "Bank" ? selectedBankId || undefined : undefined,
        paymentReference,
        notes,
      };

      const res = await createMemberExitSettlement(payload);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to save exit settlement");
      }

      navigate(-1);
    } catch (e) {
      console.error("Failed to save exit settlement:", e);
      setError(String(e?.message || e || "Failed to save exit settlement"));
    } finally {
      setSaving(false);
    }
  };

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
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gray-200 text-gray-800 text-xs sm:text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              Back to member
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading exit summary…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && summary && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">
                  Head-wise Summary
                </h2>
                <div className="w-full overflow-x-auto">
                  <table className="min-w-[800px] w-full text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-200 px-2 py-1.5 text-left">Category</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Opening</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Prev.</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Curr.</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Total</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Actual</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Unpaid</th>
                        <th className="border border-gray-200 px-2 py-1.5 text-right">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(summary.heads || {}).map((head) => (
                        <tr key={head.key}>
                          <td className="border border-gray-200 px-2 py-1.5 text-gray-800 font-medium">
                            {head.label}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.opening || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.prev || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.curr || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.total || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.actual || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.unpaid || 0)}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            {formatCurrency(head.closing || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4 flex flex-col gap-3 text-xs sm:text-sm text-blue-900">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Wallet size={18} className="text-blue-600" />
                  Exit Summary &amp; Balances
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Total payable to member (Saving + FD)
                    </p>
                    <p className="text-base font-semibold text-green-700">
                      {formatCurrency(summary.totals.totalPayoutToMember || 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Total receivable from member (Loan, Interest, Yogdan, Fees, Charges)
                    </p>
                    <p className="text-base font-semibold text-red-700">
                      {formatCurrency(summary.totals.totalDuesFromMember || 0)}
                    </p>
                  </div>
                  {/* Always show current cash balance for the group */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Cash Balance (Current)</span>
                      </div>
                      <span className="text-base font-bold text-green-600">
                        {formatCurrency(groupCashBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Show bank accounts summary if banks are loaded */}
                  {banks.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Bank Accounts (Current)</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {banks.length} account{banks.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {selectedBankId && (() => {
                        const selectedBank = banks.find((b) => b.id === selectedBankId);
                        if (!selectedBank) return null;
                        const balanceLabel = selectedBank.label?.split("(")[1]?.replace(")", "") || "";
                        return (
                          <div className="text-sm">
                            <span className="text-gray-600">{selectedBank.name || "Bank"}: </span>
                            <span className="font-bold text-blue-600">{balanceLabel}</span>
                          </div>
                        );
                      })()}
                      {!selectedBankId && (
                        <span className="text-xs text-gray-500">Select a bank below to see its current balance</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-between gap-2 items-center border-t border-blue-100 pt-2 mt-1">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold">
                      Net amount:{" "}
                      {summary.totals.netAmount >= 0
                        ? `${formatCurrency(summary.totals.netAmount)} (Member pays group)`
                        : `${formatCurrency(Math.abs(summary.totals.netAmount))} (Group pays member)`}
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold">
                      {summary.totals.direction === "MEMBER_PAYS"
                        ? "Member pays group"
                        : summary.totals.direction === "GROUP_PAYS"
                          ? "Group pays member"
                          : "Settled (no payment)"}
                    </span>
                  </div>
                </div>
              </div>

              {summary.totals.netAmount !== 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 flex flex-col gap-3">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-800">Payment details</h2>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs sm:text-sm text-gray-700 mb-1">
                        {summary.totals.direction === "GROUP_PAYS"
                          ? "Group payout mode"
                          : "Collection mode (member → group)"}
                      </label>
                      <select
                        value={payoutMode}
                        onChange={(e) => {
                          setPayoutMode(e.target.value);
                          if (e.target.value === "Cash") {
                            setSelectedBankId("");
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </div>
                    {payoutMode === "Bank" && (
                      <div className="flex-1">
                        <label className="block text-xs sm:text-sm text-gray-700 mb-1">
                          Bank
                        </label>
                        <select
                          value={selectedBankId}
                          onChange={(e) => setSelectedBankId(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={banksLoading || banks.length === 0}
                        >
                          <option value="">Select bank</option>
                          {banks.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                        {banksLoading && (
                          <p className="mt-1 text-[11px] text-gray-500">Loading banks…</p>
                        )}
                        {!banksLoading && selectedBankId && (
                          <p className="mt-1 text-[11px] text-gray-600">
                            Selected bank balance:&nbsp;
                            {(() => {
                              const selectedBank = banks.find((b) => b.id === selectedBankId);
                              if (!selectedBank) return "-";
                              const balanceLabel =
                                selectedBank.label?.split("(")[1]?.replace(")", "") || "";
                              return balanceLabel;
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {payoutMode === "Cash" && (
                    <div className="mt-1 text-[11px] text-gray-600">
                      Available cash balance:&nbsp;{formatCurrency(groupCashBalance)}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs sm:text-sm text-gray-700 mb-1">
                        Reference / Remarks
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Receipt no, bank txn id, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm text-gray-700 mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any extra details about this exit/settlement…"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                  onBlur={() => setError("")}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={saving || !!error || (summary.totals.direction === "GROUP_PAYS" && payoutMode === "Bank" && !selectedBankId)}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-green-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Saving…
                    </>
                  ) : (
                    "Confirm settlement"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
