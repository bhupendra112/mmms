import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { createJV, listJV, getJVDetail, getJVBalancePreview } from "../../services/journalService";
import { getMembersByGroup } from "../../services/memberService";
import { getGroups } from "../../services/groupService";
import { getDemandDetails } from "../../services/recoveryService";
import DemandSummaryTable from "../../components/recovery/DemandSummaryTable";
import { getDemandSummary } from "../../utils/recoveryUtils";

const ACCOUNT_HEAD_OPTIONS = [
    { value: "SAVINGS_LIABILITY", label: "Saving" },
    { value: "LOAN_RECEIVABLE", label: "Loan" },
    { value: "INTEREST_INCOME", label: "Interest on Loan" },
    { value: "FD_LIABILITY", label: "FD" },
];

const makeLine = (overrides = {}) => ({
    accountHead: "",
    debit: "",
    credit: "",
    memberId: "",
    notes: "",
    memberSearch: "",
    ...overrides,
});

const initialLines = () => [makeLine(), makeLine()];

export default function JVManagement() {
    const [groupId, setGroupId] = useState("");
    const [selectedGroupName, setSelectedGroupName] = useState("");
    const [groups, setGroups] = useState([]);
    const [groupSearch, setGroupSearch] = useState("");
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [voucherNumber, setVoucherNumber] = useState("");
    const [lines, setLines] = useState(() => initialLines());
    const [entries, setEntries] = useState([]);
    const [selected, setSelected] = useState(null);
    const [members, setMembers] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState("");
    const [selectedMemberSearch, setSelectedMemberSearch] = useState("");
    const [demandSummaries, setDemandSummaries] = useState({});
    const [demandLoading, setDemandLoading] = useState(false);
    const [groupLoading, setGroupLoading] = useState(false);
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [balancePreview, setBalancePreview] = useState(null);

    const totals = useMemo(() => {
        const debit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const credit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
        return {
            debit: Math.round(debit * 100) / 100,
            credit: Math.round(credit * 100) / 100,
            balanced: Math.round(debit * 100) / 100 === Math.round(credit * 100) / 100,
        };
    }, [lines]);
    const creditLineIndex = useMemo(
        () => lines.findIndex((line) => (parseFloat(line.credit) || 0) > 0),
        [lines]
    );

    const memberOptions = useMemo(
        () =>
            members.map((member) => ({
                id: member._id,
                name: member.Member_Nm || member.member_name || member.memberName || "Unknown Member",
                code: member.Member_Id || member.memberCode || "",
                group: member.Group_Name || member.group_name || member.groupName || "-",
                phone: member.cell_phone || member.phone || "-",
                raw: member,
            })),
        [members]
    );
    const selectedMember = useMemo(
        () => memberOptions.find((member) => member.id === selectedMemberId) || null,
        [memberOptions, selectedMemberId]
    );
    const selectedMemberSummary = useMemo(
        () => (selectedMemberId ? getDemandSummary(selectedMemberId, [], demandSummaries) : null),
        [selectedMemberId, demandSummaries]
    );
    const demandClosingCaps = useMemo(
        () => ({
            SAVINGS_LIABILITY: Math.max(0, Number(selectedMemberSummary?.saving?.closing || 0)),
            LOAN_RECEIVABLE: Math.max(0, Number(selectedMemberSummary?.loan?.closing || 0)),
            INTEREST_INCOME: Math.max(0, Number(selectedMemberSummary?.interest?.closing || 0)),
            FD_LIABILITY: Math.max(0, Number(selectedMemberSummary?.fd?.closing || 0)),
        }),
        [selectedMemberSummary]
    );
    const filteredMembers = useMemo(() => {
        const q = String(selectedMemberSearch || "").toLowerCase();
        if (!q) return memberOptions.slice(0, 30);
        return memberOptions
            .filter((member) =>
                `${member.name} ${member.group} ${member.phone}`
                    .toLowerCase()
                    .includes(q)
            )
            .slice(0, 30);
    }, [selectedMemberSearch, memberOptions]);

    const groupOptions = useMemo(
        () =>
            groups.map((group) => ({
                id: group._id,
                name: group.group_name || "Unnamed Group",
                code: group.group_code || "-",
                display: `${group.group_name || "Unnamed Group"} | ${group.group_code || "-"}`,
            })),
        [groups]
    );

    const filteredGroups = useMemo(() => {
        const q = String(groupSearch || "").toLowerCase();
        if (!q) return groupOptions.slice(0, 50);
        return groupOptions
            .filter(
                (group) =>
                    group.name.toLowerCase().includes(q) ||
                    String(group.code).toLowerCase().includes(q)
            )
            .slice(0, 50);
    }, [groupSearch, groupOptions]);

    const loadEntries = async () => {
        try {
            setLoading(true);
            const res = await listJV(groupId ? { groupId } : {});
            if (res.success) {
                setEntries(res.data?.entries || []);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load journal vouchers");
        } finally {
            setLoading(false);
        }
    };

    const loadDetail = async (entryId) => {
        try {
            const res = await getJVDetail(entryId);
            if (res.success) {
                setSelected(res.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load JV detail");
        }
    };

    const loadGroups = async () => {
        try {
            setGroupLoading(true);
            const res = await getGroups();
            if (res?.success) {
                setGroups(Array.isArray(res.data) ? res.data : []);
            } else {
                setGroups([]);
            }
        } catch {
            setGroups([]);
        } finally {
            setGroupLoading(false);
        }
    };

    const loadMembers = async (targetGroupId) => {
        if (!targetGroupId) {
            setMembers([]);
            return;
        }

        try {
            setMemberLoading(true);
            const res = await getMembersByGroup(targetGroupId);
            if (res?.success) {
                setMembers(Array.isArray(res.data) ? res.data : []);
            } else {
                setMembers([]);
            }
        } catch {
            setMembers([]);
        } finally {
            setMemberLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
        loadEntries();
    }, []);

    useEffect(() => {
        loadMembers(groupId);
        setSelectedMemberId("");
        setSelectedMemberSearch("");
        setDemandSummaries({});
    }, [groupId]);

    useEffect(() => {
        const loadDemandSummary = async () => {
            if (!groupId || !selectedMemberId) return;
            try {
                setDemandLoading(true);
                const today = new Date().toLocaleDateString("en-GB");
                const res = await getDemandDetails(groupId, selectedMemberId, today);
                if (res?.success && res?.data) {
                    const demandDetails = res.data.data || res.data;
                    setDemandSummaries((prev) => ({ ...prev, [selectedMemberId]: demandDetails }));
                }
            } catch {
                setDemandSummaries((prev) => ({ ...prev, [selectedMemberId]: null }));
            } finally {
                setDemandLoading(false);
            }
        };
        loadDemandSummary();
    }, [groupId, selectedMemberId]);

    useEffect(() => {
        const loadBalance = async () => {
            if (!groupId) {
                setBalancePreview(null);
                return;
            }
            try {
                const res = await getJVBalancePreview({
                    groupId,
                });
                if (res?.success) {
                    setBalancePreview(res.data);
                } else {
                    setBalancePreview(null);
                }
            } catch {
                setBalancePreview(null);
            }
        };
        loadBalance();
    }, [groupId]);

    const updateLine = (index, field, value) => {
        setLines((prev) =>
            prev.map((line, idx) => {
                if (idx !== index) return line;
                const next = { ...line, [field]: value };
                if (field === "debit" && (parseFloat(value) || 0) > 0) {
                    next.credit = "";
                }
                if (field === "credit" && (parseFloat(value) || 0) > 0) {
                    next.debit = "";
                }
                return next;
            })
        );
    };

    const addLine = () =>
        setLines((prev) => [
            ...prev,
            makeLine(
                selectedMember
                    ? {
                          memberId: selectedMember.id,
                          memberSearch: `${selectedMember.name} | ${selectedMember.group} | ${selectedMember.phone}`,
                      }
                    : {}
            ),
        ]);
    const removeLine = (index) => setLines((prev) => prev.filter((_, idx) => idx !== index));

    const onAccountHeadChange = (index, accountHead) => {
        setLines((prev) =>
            prev.map((line, idx) => (idx === index ? { ...line, accountHead } : line))
        );
    };

    const onSelectGroup = (group) => {
        setGroupId(group.id);
        setSelectedGroupName(group.name);
        setGroupSearch(group.display);
        setGroupDropdownOpen(false);
        setLines(initialLines());
    };

    const selectPrimaryMember = (member) => {
        setSelectedMemberId(member.id);
        setSelectedMemberSearch(`${member.name} | ${member.group} | ${member.phone}`);
        setMemberDropdownOpen(false);
        setLines((prev) =>
            prev.map((line) => ({
                ...line,
                memberId: member.id,
                memberSearch: `${member.name} | ${member.group} | ${member.phone}`,
            }))
        );
    };

    const validateLines = () => {
        if (lines.length < 2) return "At least two lines are required";
        const allowedHeads = new Set(ACCOUNT_HEAD_OPTIONS.map((head) => head.value));
        let creditLineCount = 0;
        let debitLineCount = 0;

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const debit = parseFloat(line.debit) || 0;
            const credit = parseFloat(line.credit) || 0;
            if (debit > 0) debitLineCount += 1;
            if (credit > 0) creditLineCount += 1;
            if (!line.accountHead) return `Account head is required at line ${i + 1}`;
            if (!allowedHeads.has(line.accountHead)) return `Invalid account head at line ${i + 1}`;
            if (debit < 0 || credit < 0) return `Negative values are not allowed at line ${i + 1}`;
            if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
                return `Line ${i + 1}: enter either debit or credit`;
            }
            const cap = Number(demandClosingCaps[line.accountHead] || 0);
            if (debit > cap) {
                return `Line ${i + 1}: debit cannot exceed closing balance (${cap.toFixed(2)})`;
            }
        }
        if (debitLineCount === 0 || creditLineCount === 0) {
            return "JV must have at least one debit line and one credit line";
        }
        if (creditLineCount !== 1) {
            return "Only one credit line is allowed (balancing line)";
        }

        if (!totals.balanced) return "Debit and credit totals must be equal";
        return "";
    };

    const setAsBalancingCreditLine = (index) => {
        const nextLines = lines.map((line, idx) => {
            if (idx === index) return { ...line, debit: "", credit: "0.00" };
            if ((parseFloat(line.credit) || 0) > 0) return { ...line, credit: "" };
            return line;
        });

        const debitTotal = nextLines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const nonBalancingCreditTotal = nextLines.reduce(
            (sum, line, idx) => (idx === index ? sum : sum + (parseFloat(line.credit) || 0)),
            0
        );
        const balancingAmount = Math.max(0, Math.round((debitTotal - nonBalancingCreditTotal) * 100) / 100);

        nextLines[index] = {
            ...nextLines[index],
            credit: balancingAmount ? balancingAmount.toFixed(2) : "",
        };

        setLines(nextLines);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!groupId) {
            setError("groupId is required");
            return;
        }
        if (lines.length < 2) {
            setError("At least two lines are required");
            return;
        }
        const lineValidationError = validateLines();
        if (lineValidationError) {
            setError(lineValidationError);
            return;
        }
        try {
            setSaving(true);
            const payload = {
                groupId,
                date,
                voucherNumber,
                lines: lines.map((line) => ({
                    accountHead: line.accountHead,
                    debit: parseFloat(line.debit) || 0,
                    credit: parseFloat(line.credit) || 0,
                    memberId: line.memberId || undefined,
                    notes: line.notes || undefined,
                })),
            };
            const res = await createJV(payload);
            if (res.success) {
                setSuccess(`JV created: ${res.data.voucherNo}`);
                setLines(initialLines());
                setVoucherNumber("");
                await loadEntries();
            } else {
                setError(res.message || "Failed to create JV");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create JV");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Journal Voucher</h1>
                <p className="text-gray-600 mt-1">Create and review double-entry journal vouchers.</p>
            </div>

            {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}
            {success && <div className="p-3 rounded border border-green-200 bg-green-50 text-green-700">{success}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow border space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Create JV</h2>
                    <div className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded p-2">
                        Select group to load members.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm text-gray-700 font-medium">Group</label>
                            <div className="relative">
                                <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={groupSearch}
                                    onFocus={() => setGroupDropdownOpen(true)}
                                    onChange={(e) => {
                                        setGroupSearch(e.target.value);
                                        setGroupDropdownOpen(true);
                                        if (!e.target.value.trim()) {
                                            setGroupId("");
                                            setSelectedGroupName("");
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 150)}
                                    placeholder={groupLoading ? "Loading groups..." : "Search group name/code"}
                                    className="border rounded pl-7 pr-3 py-2 w-full"
                                />
                                {groupDropdownOpen && filteredGroups.length > 0 && (
                                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white border rounded shadow-lg">
                                        {filteredGroups.map((group) => (
                                            <button
                                                key={group.id}
                                                type="button"
                                                onClick={() => onSelectGroup(group)}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                                            >
                                                <div className="font-medium text-gray-800">{group.name}</div>
                                                <div className="text-xs text-gray-600">Code: {group.code}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-gray-700 font-medium">JV Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="border rounded px-3 py-2 w-full"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-gray-700 font-medium">Voucher Number</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={voucherNumber}
                                onChange={(e) => setVoucherNumber(e.target.value)}
                                placeholder="Enter unique voucher number"
                                className="border rounded px-3 py-2 w-full"
                                required
                            />
                        </div>
                    </div>
                    {selectedGroupName && (
                        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded p-2">
                            Selected Group: <strong>{selectedGroupName}</strong>
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-sm text-gray-700 font-medium">Member</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                value={selectedMemberSearch}
                                onFocus={() => setMemberDropdownOpen(true)}
                                onChange={(e) => {
                                    setSelectedMemberSearch(e.target.value);
                                    setSelectedMemberId("");
                                    setMemberDropdownOpen(true);
                                }}
                                onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                                placeholder={
                                    memberLoading
                                        ? "Loading members..."
                                        : !groupId
                                          ? "Select group first"
                                          : "Search name/phone/group"
                                }
                                className="border rounded pl-7 pr-2 py-2 w-full"
                                disabled={!groupId}
                            />
                            {memberDropdownOpen && groupId && filteredMembers.length > 0 && (
                                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border rounded shadow-lg">
                                    {filteredMembers.map((member) => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => selectPrimaryMember(member)}
                                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                                        >
                                            <div className="font-medium text-gray-800">{member.name}</div>
                                            <div className="text-xs text-gray-600">{member.group} | {member.phone}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedMemberId && (
                        <div className="border border-gray-200 rounded-lg p-3 bg-white">
                            {demandLoading ? (
                                <p className="text-sm text-gray-600">Loading member demand details...</p>
                            ) : (
                                <DemandSummaryTable
                                    currentMember={selectedMember}
                                    currentMemberSummary={selectedMemberSummary}
                                />
                            )}
                        </div>
                    )}

                    {balancePreview && (
                        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">Live Balance Preview</h3>
                            {balancePreview.financeSummary && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3 pb-3 border-b border-gray-200">
                                    <div>Total Savings: <strong>{balancePreview.financeSummary.totalSavings?.toFixed?.(2) ?? "0.00"}</strong></div>
                                    <div>Loan principal (outstanding est.): <strong>{balancePreview.financeSummary.totalLoans?.toFixed?.(2) ?? "0.00"}</strong></div>
                                    <div>Total FD: <strong>{balancePreview.financeSummary.totalFD?.toFixed?.(2) ?? "0.00"}</strong></div>
                                    <div>Interest due (from latest demand): <strong>{balancePreview.financeSummary.totalInterest?.toFixed?.(2) ?? "0.00"}</strong></div>
                                    <div>Total Yogdan: <strong>{balancePreview.financeSummary.totalYogdan?.toFixed?.(2) ?? "0.00"}</strong></div>
                                    <div>Recovery meeting totals: <strong>{balancePreview.financeSummary.totalRecovery?.toFixed?.(2) ?? "0.00"}</strong></div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="border rounded-xl overflow-hidden bg-white">
                        {selectedMember && (
                            <div className="px-4 py-3 bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                                <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Selected Member</div>
                                <div className="text-sm text-blue-900">
                                    JV lines for <strong>{selectedMember.name}</strong>
                                </div>
                            </div>
                        )}
                        <div className="p-4 space-y-3">
                            {lines.map((line, index) => (
                                <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                            Line {index + 1}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAsBalancingCreditLine(index)}
                                                className="px-2 py-1 border rounded text-blue-700 hover:bg-blue-50"
                                                disabled={!groupId}
                                            >
                                                Set as credit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeLine(index)}
                                                className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 disabled:opacity-40"
                                                disabled={lines.length <= 2}
                                            >
                                                <Trash2 size={14} className="inline" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">Account Head</label>
                                            <select
                                                value={line.accountHead}
                                                onChange={(e) => onAccountHeadChange(index, e.target.value)}
                                                className="border rounded px-3 py-2 w-full bg-white"
                                                disabled={!groupId}
                                            >
                                                <option value="">Select head</option>
                                                {ACCOUNT_HEAD_OPTIONS.map((head) => (
                                                    <option key={head.value} value={head.value}>
                                                        {head.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">Notes</label>
                                            <input
                                                value={line.notes}
                                                onChange={(e) => updateLine(index, "notes", e.target.value)}
                                                className="border rounded px-3 py-2 w-full bg-white"
                                                placeholder="Optional note"
                                                disabled={!groupId}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">Debit</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={
                                                    line.accountHead
                                                        ? demandClosingCaps[line.accountHead] ?? 0
                                                        : undefined
                                                }
                                                value={line.debit}
                                                onChange={(e) => updateLine(index, "debit", e.target.value)}
                                                className="border rounded px-3 py-2 w-full text-right bg-white"
                                                disabled={!groupId || (creditLineIndex === index && (parseFloat(line.credit) || 0) > 0)}
                                            />
                                            {line.accountHead && (
                                                <p className="text-[11px] text-gray-500">
                                                    Max allowed: {(demandClosingCaps[line.accountHead] || 0).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">Credit</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.credit}
                                                onChange={(e) => updateLine(index, "credit", e.target.value)}
                                                className="border rounded px-3 py-2 w-full text-right bg-white"
                                                disabled={!groupId || (creditLineIndex !== -1 && creditLineIndex !== index)}
                                            />
                                            {creditLineIndex !== -1 && creditLineIndex !== index && (
                                                <p className="text-[11px] text-gray-500">
                                                    Credit locked to Line {creditLineIndex + 1}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div
                            className={`text-sm px-3 py-2 rounded border ${
                                totals.balanced
                                    ? "border-green-200 bg-green-50 text-green-700"
                                    : "border-red-200 bg-red-50 text-red-700"
                            }`}
                        >
                            Total Debit: <strong>{totals.debit.toFixed(2)}</strong> | Total Credit:{" "}
                            <strong>{totals.credit.toFixed(2)}</strong>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={addLine}
                                className="px-3 py-2 border rounded text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                                disabled={!groupId}
                            >
                                <Plus size={14} className="inline mr-1" />
                                Add Line
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!groupId || !selectedMemberId || !totals.balanced || saving || Boolean(validateLines())}
                        className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
                    >
                        {saving ? "Posting..." : "Create JV"}
                    </button>
                </form>

                <div className="bg-white p-4 rounded-lg shadow border space-y-3">
                    <h2 className="text-lg font-semibold text-gray-800">JV List</h2>
                    {loading ? (
                        <p className="text-gray-600">Loading...</p>
                    ) : (
                        <div className="space-y-2 max-h-[520px] overflow-auto">
                            {entries.map((entry) => (
                                <button
                                    key={entry.entryId}
                                    type="button"
                                    onClick={() => loadDetail(entry.entryId)}
                                    className="w-full text-left border rounded p-3 hover:bg-gray-50"
                                >
                                    <p className="font-semibold">{entry.voucherNo}</p>
                                    <p className="text-xs text-gray-600">
                                        {new Date(entry.date).toLocaleDateString()} - {entry.sourceType}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                    {selected && (
                        <div className="border-t pt-3 mt-3">
                            <h3 className="font-semibold text-gray-800">{selected.voucherNo}</h3>
                            <p className="text-xs text-gray-600 mb-2">Entry ID: {selected.entryId}</p>
                            <div className="space-y-1 text-sm">
                                {(selected.lines || []).map((line, idx) => (
                                    <div key={`${line.entryId}-${idx}`} className="flex justify-between">
                                        <span>{line.accountHead}</span>
                                        <span>D {line.debit || 0} / C {line.credit || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
