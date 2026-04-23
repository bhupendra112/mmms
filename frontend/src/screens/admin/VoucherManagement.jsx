import React, { useEffect, useState, useCallback } from "react";
import { Hash, Search, Save } from "lucide-react";
import BackButton from "../../components/admin/BackButton";
import { getGroups } from "../../services/groupService";
import {
    getVoucherRange,
    saveVoucherRange,
    getUsedVouchers,
} from "../../services/voucherService";

export default function VoucherManagement() {
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [startNumber, setStartNumber] = useState("");
    const [endNumber, setEndNumber] = useState("");
    const [priority, setPriority] = useState("0");
    const [rangeLoading, setRangeLoading] = useState(false);
    const [ranges, setRanges] = useState([]);
    const [saveMessage, setSaveMessage] = useState(null);
    const [saveError, setSaveError] = useState(null);

    const [usedSearch, setUsedSearch] = useState("");
    const [usedLoading, setUsedLoading] = useState(false);
    const [usedRows, setUsedRows] = useState([]);
    const [usedError, setUsedError] = useState(null);

    const loadGroups = useCallback(() => {
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroups(
                    list.map((g) => ({
                        id: g._id,
                        name: g.group_name,
                        code: g.group_code,
                    }))
                );
            })
            .catch(() => setGroups([]))
            .finally(() => setGroupsLoading(false));
    }, []);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    const loadRanges = useCallback(async (groupId) => {
        if (!groupId) {
            setStartNumber("");
            setEndNumber("");
            setRanges([]);
            return;
        }
        setRangeLoading(true);
        setSaveMessage(null);
        setSaveError(null);
        try {
            const res = await getVoucherRange(groupId);
            const list = Array.isArray(res?.data) ? res.data : [];
            setRanges(list);
            if (!list.length) {
                setStartNumber("");
                setEndNumber("");
            }
        } catch {
            setStartNumber("");
            setEndNumber("");
            setRanges([]);
        } finally {
            setRangeLoading(false);
        }
    }, []);

    const loadUsed = useCallback(async (groupId, search = "") => {
        if (!groupId) {
            setUsedRows([]);
            setUsedError(null);
            return;
        }
        setUsedLoading(true);
        setUsedError(null);
        try {
            const res = await getUsedVouchers(groupId, search);
            setUsedRows(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            setUsedRows([]);
            setUsedError(e?.message || "Failed to load used vouchers");
        } finally {
            setUsedLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedGroupId) {
            loadRanges(selectedGroupId);
            loadUsed(selectedGroupId, "");
            setUsedSearch("");
        }
    }, [selectedGroupId, loadRanges, loadUsed]);

    const handleSaveRange = async () => {
        if (!selectedGroupId) {
            setSaveError("Select a group first.");
            return;
        }
        setSaveError(null);
        setSaveMessage(null);
        try {
            const res = await saveVoucherRange({
                groupId: selectedGroupId,
                startNumber: parseInt(startNumber, 10),
                endNumber: parseInt(endNumber, 10),
                priority: parseInt(priority, 10) || 0,
            });
            if (res?.success) {
                setSaveMessage("Voucher range saved.");
                setStartNumber("");
                setEndNumber("");
                setPriority("0");
                await loadRanges(selectedGroupId);
            } else {
                setSaveError(res?.message || "Save failed");
            }
        } catch (e) {
            setSaveError(e?.message || "Save failed");
        }
    };

    const formatDate = (d) => {
        if (!d) return "-";
        try {
            return new Date(d).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        } catch {
            return String(d);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <BackButton fallback="/admin/dashboard" label="Back" className="mb-4" />
            <div className="flex items-center gap-3 mb-6">
                <Hash className="text-blue-600" size={32} />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Voucher Management</h1>
                    <p className="text-gray-600 text-sm mt-1">
                        Configure voucher number ranges per group and look up loans by voucher.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Group</label>
                <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">{groupsLoading ? "Loading groups…" : "Select group"}</option>
                    {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name} ({g.code})
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Save size={20} className="text-green-600" />
                    Active voucher range
                </h2>
                {rangeLoading ? (
                    <p className="text-gray-500 text-sm">Loading range…</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start number</label>
                            <input
                                type="number"
                                value={startNumber}
                                onChange={(e) => setStartNumber(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                min={0}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End number</label>
                            <input
                                type="number"
                                value={endNumber}
                                onChange={(e) => setEndNumber(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                min={0}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <input
                                type="number"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleSaveRange}
                    disabled={!selectedGroupId}
                    className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    Save range
                </button>
                {saveMessage && <p className="mt-2 text-sm text-green-700">{saveMessage}</p>}
                {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
                <p className="mt-3 text-xs text-gray-500">
                    Multiple active ranges are allowed. New ranges must not overlap existing ranges.
                </p>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Configured ranges</h2>
                {rangeLoading ? (
                    <p className="text-sm text-gray-500">Loading ranges…</p>
                ) : ranges.length === 0 ? (
                    <p className="text-sm text-gray-500">No ranges configured for this group.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-600 border-b">
                                    <th className="py-2 pr-4">Start</th>
                                    <th className="py-2 pr-4">End</th>
                                    <th className="py-2 pr-4">Status</th>
                                    <th className="py-2 pr-4">Priority</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranges.map((r) => (
                                    <tr key={r._id} className="border-b last:border-0">
                                        <td className="py-2 pr-4">{r.startNumber}</td>
                                        <td className="py-2 pr-4">{r.endNumber}</td>
                                        <td className="py-2 pr-4">
                                            <span className={r.isActive ? "text-green-700" : "text-gray-500"}>
                                                {r.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4">{r.priority ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Search size={20} className="text-blue-600" />
                    Used vouchers
                </h2>
                <div className="flex flex-wrap gap-2 items-end max-w-xl">
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search voucher number or member name
                        </label>
                        <input
                            type="text"
                            value={usedSearch}
                            onChange={(e) => setUsedSearch(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => loadUsed(selectedGroupId, usedSearch.trim())}
                        disabled={usedLoading || !selectedGroupId}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                    >
                        {usedLoading ? "Searching…" : "Search"}
                    </button>
                </div>
                {usedError && <p className="mt-3 text-sm text-red-600">{usedError}</p>}
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Voucher</th>
                                <th className="py-2 pr-4">Member</th>
                                <th className="py-2 pr-4">Amount</th>
                                <th className="py-2 pr-4">Purpose</th>
                                <th className="py-2 pr-4">Date</th>
                                <th className="py-2 pr-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usedRows.map((row, idx) => (
                                <tr key={`${row.voucherNumber}-${idx}`} className="border-b last:border-0">
                                    <td className="py-2 pr-4">{row.voucherNumber}</td>
                                    <td className="py-2 pr-4">{row.memberName || "-"}</td>
                                    <td className="py-2 pr-4">
                                        ₹{Number(row.amount || 0).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td className="py-2 pr-4">{row.purpose || "-"}</td>
                                    <td className="py-2 pr-4">{formatDate(row.date)}</td>
                                    <td className="py-2 pr-4">{row.status || "-"}</td>
                                </tr>
                            ))}
                            {!usedLoading && usedRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-4 text-gray-500">
                                        No used vouchers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
