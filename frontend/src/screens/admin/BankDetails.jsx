import React, { useEffect, useMemo, useState } from "react";
import { createBank, getGroupBanks, getGroups } from "../../services/groupService";
import { Building2, Search, Banknote, Calendar, DollarSign, FileText } from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";
import { useSearchParams } from "react-router-dom";

export default function BankDetails() {
    const [searchParams] = useSearchParams();
    const preselectGroupId = searchParams.get("groupId") || "";
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [banks, setBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [form, setForm] = useState({
        bank_name: "",
        account_no: "",
        branch_name: "",
        ifsc: "",
        short_name: "",
        ac_open_date: "",
        account_type: "",
        opening_balance: "",
        open_indicator: "",
        cc_limit: "",
        dp_limit: "",
        open_bal_curr: "",
        fd_mat_dt: "",
        open_ind_curr: "",
        flg_acclosed: "",
        acclosed_dt: "",
        govt_linked: "",
        govt_project_type: "",
    });

    useEffect(() => {
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                const mapped = list.map((g) => ({
                    id: g._id,
                    name: g.group_name,
                    code: g.group_code,
                }));
                setGroupsState(mapped);

                if (preselectGroupId) {
                    const selected = mapped.find((g) => g.id === preselectGroupId);
                    if (selected) {
                        setSelectedGroup(selected);
                        loadBanks(selected.id);
                    }
                }
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroupsState([]);
            })
            .finally(() => setGroupsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preselectGroupId]);

    const loadBanks = async (groupId) => {
        if (!groupId) return;
        try {
            setBanksLoading(true);
            const res = await getGroupBanks(groupId);
            setBanks(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load banks:", e);
            setBanks([]);
        } finally {
            setBanksLoading(false);
        }
    };

    const accountTypes = ["Saving", "CC", "FD"];
    const govtOptions = ["Yes", "No"];
    const projectOptions = ["NRLM", "Other"];

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedGroup) {
            alert("Please select a group first");
            return;
        }

        try {
            setLoading(true);
            const bankPayload = {
                ...form,
                group_id: selectedGroup.id,
            };
            await createBank(bankPayload);
            alert("Bank details saved successfully!");
            await loadBanks(selectedGroup.id);
            // Reset form
            setForm({
                bank_name: "",
                account_no: "",
                branch_name: "",
                ifsc: "",
                short_name: "",
                ac_open_date: "",
                account_type: "",
                opening_balance: "",
                open_indicator: "",
                cc_limit: "",
                dp_limit: "",
                open_bal_curr: "",
                fd_mat_dt: "",
                open_ind_curr: "",
                flg_acclosed: "",
                acclosed_dt: "",
                govt_linked: "",
                govt_project_type: "",
            });
        } catch (error) {
            alert(error.message || "Something went wrong!");
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter(
            (group) =>
                (group.name || "").toLowerCase().includes(q) ||
                (group.code || "").toLowerCase().includes(q)
        );
    }, [groups, searchTerm]);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Banknote size={32} />
                    Bank Details for Group
                </h1>
                <p className="text-gray-600 mt-2">Fill bank details for village samooh groups</p>
            </div>

            {/* Group Selection */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 size={24} className="text-blue-600" />
                    Select Group
                </h2>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search groups by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map((group) => (
                            <div
                                key={group.id}
                                onClick={() => {
                                    setSelectedGroup(group);
                                    loadBanks(group.id);
                                }}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedGroup?.id === group.id
                                    ? "border-blue-500 bg-blue-50 shadow-md"
                                    : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Building2 className={`${selectedGroup?.id === group.id ? "text-blue-600" : "text-gray-400"}`} size={24} />
                                    <div>
                                        <p className="font-semibold text-gray-800">{group.name}</p>
                                        <p className="text-sm text-gray-600">Code: {group.code}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            <p>{groupsLoading ? "Loading groups..." : "No groups found matching your search."}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Existing Banks List */}
            {selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Banknote size={24} className="text-blue-600" />
                        Existing Bank Accounts ({banks.length})
                    </h2>
                    {banksLoading ? (
                        <p className="text-gray-600">Loading bank accounts…</p>
                    ) : banks.length === 0 ? (
                        <p className="text-gray-600">No bank accounts added yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border p-3 text-left font-semibold text-gray-700">Bank</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">Account No</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">IFSC</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">Type</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">Branch</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {banks.map((b) => (
                                        <tr key={b._id} className="hover:bg-gray-50">
                                            <td className="border p-3 text-gray-800">{b.bank_name}</td>
                                            <td className="border p-3 text-gray-800">{b.account_no}</td>
                                            <td className="border p-3 text-gray-600">{b.ifsc || "-"}</td>
                                            <td className="border p-3 text-gray-600">{b.account_type}</td>
                                            <td className="border p-3 text-gray-600">{b.branch_name || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Bank Details Form */}
            {selectedGroup && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Bank Information */}
                    <FormSection title="Basic Bank Information" icon={Banknote}>
                        <Input
                            label="Bank Name"
                            name="bank_name"
                            value={form.bank_name}
                            handleChange={handleChange}
                            required
                            placeholder="Enter bank name"
                        />
                        <Input
                            label="Account Number"
                            name="account_no"
                            value={form.account_no}
                            handleChange={handleChange}
                            required
                            placeholder="Enter account number"
                        />
                        <Input
                            label="Branch Name"
                            name="branch_name"
                            value={form.branch_name}
                            handleChange={handleChange}
                            required
                            placeholder="Enter branch name"
                        />
                        <Input
                            label="IFSC Code"
                            name="ifsc"
                            value={form.ifsc}
                            handleChange={handleChange}
                            required
                            placeholder="Enter IFSC code"
                        />
                        <Input
                            label="Short Name"
                            name="short_name"
                            value={form.short_name}
                            handleChange={handleChange}
                            placeholder="Enter short name"
                        />
                        <Select
                            label="Account Type"
                            name="account_type"
                            value={form.account_type}
                            handleChange={handleChange}
                            options={accountTypes}
                        />
                    </FormSection>

                    {/* Account Dates */}
                    <FormSection title="Account Dates" icon={Calendar}>
                        <Input
                            type="date"
                            label="Account Open Date"
                            name="ac_open_date"
                            value={form.ac_open_date}
                            handleChange={handleChange}
                        />
                        <Input
                            type="date"
                            label="FD Maturity Date"
                            name="fd_mat_dt"
                            value={form.fd_mat_dt}
                            handleChange={handleChange}
                        />
                        <Input
                            type="date"
                            label="A/C Closed Date"
                            name="acclosed_dt"
                            value={form.acclosed_dt}
                            handleChange={handleChange}
                        />
                    </FormSection>

                    {/* Financial Details */}
                    <FormSection title="Financial Details" icon={DollarSign}>
                        <Input
                            type="number"
                            label="Opening Balance"
                            name="opening_balance"
                            value={form.opening_balance}
                            handleChange={handleChange}
                            placeholder="Enter opening balance"
                        />
                        <Input
                            type="number"
                            label="Open Balance Current"
                            name="open_bal_curr"
                            value={form.open_bal_curr}
                            handleChange={handleChange}
                            placeholder="Enter current balance"
                        />
                        <Input
                            type="number"
                            label="CC Limit"
                            name="cc_limit"
                            value={form.cc_limit}
                            handleChange={handleChange}
                            placeholder="Enter CC limit"
                        />
                        <Input
                            type="number"
                            label="DP Limit"
                            name="dp_limit"
                            value={form.dp_limit}
                            handleChange={handleChange}
                            placeholder="Enter DP limit"
                        />
                        <Input
                            label="Open Indicator"
                            name="open_indicator"
                            value={form.open_indicator}
                            handleChange={handleChange}
                            placeholder="Enter open indicator"
                        />
                        <Input
                            label="Open Indicator Current"
                            name="open_ind_curr"
                            value={form.open_ind_curr}
                            handleChange={handleChange}
                            placeholder="Enter current indicator"
                        />
                    </FormSection>

                    {/* Account Status */}
                    <FormSection title="Account Status">
                        <Input
                            label="A/C Closed?"
                            name="flg_acclosed"
                            value={form.flg_acclosed}
                            handleChange={handleChange}
                            placeholder="Enter status"
                        />
                    </FormSection>

                    {/* Government Project Information */}
                    <FormSection title="Government Project Information" icon={FileText}>
                        <Select
                            label="Linked with Govt Project?"
                            name="govt_linked"
                            value={form.govt_linked}
                            handleChange={handleChange}
                            options={govtOptions}
                        />
                        {form.govt_linked === "Yes" && (
                            <Select
                                label="Project Type"
                                name="govt_project_type"
                                value={form.govt_project_type}
                                handleChange={handleChange}
                                options={projectOptions}
                            />
                        )}
                    </FormSection>

                    {/* Submit Buttons */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-600">
                                    Adding bank details for: <span className="font-semibold text-gray-800">{selectedGroup.name}</span>
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to cancel? All entered data will be lost.")) {
                                            setSelectedGroup(null);
                                            setForm({
                                                bank_name: "",
                                                account_no: "",
                                                branch_name: "",
                                                ifsc: "",
                                                short_name: "",
                                                ac_open_date: "",
                                                account_type: "",
                                                opening_balance: "",
                                                open_indicator: "",
                                                cc_limit: "",
                                                dp_limit: "",
                                                open_bal_curr: "",
                                                fd_mat_dt: "",
                                                open_ind_curr: "",
                                                flg_acclosed: "",
                                                acclosed_dt: "",
                                                govt_linked: "",
                                                govt_project_type: "",
                                            });
                                        }
                                    }}
                                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors shadow-md"
                                >
                                    {loading ? "Saving..." : "Save Bank Details"}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {!selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <Building2 size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 text-lg">Please select a group to add bank details</p>
                </div>
            )}
        </div>
    );
}
