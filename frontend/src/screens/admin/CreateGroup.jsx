import React, { useState, useEffect } from "react";
import { createGroup, getClusters } from "../../services/groupService";
import { getMembers } from "../../services/memberService";
import { PlusCircle, Building2, Users, Calendar, DollarSign, FileText, LayoutGrid, UserPlus, Lock } from "lucide-react";
import BackButton from "../../components/admin/BackButton";
import { Input, Select, TextArea, FormSection } from "../../components/forms/FormComponents";
import Loader, { OverlayLoader } from "../../components/common/Loader";
import VillageCombobox from "../../components/common/VillageCombobox";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useApiCall } from "../../hooks/useApiCall";

export default function CreateGroup() {
    const { loading, error, execute, clearError } = useApiCall({
        defaultErrorMessage: "Failed to create group. Please try again.",
    });
    const [form, setForm] = useState({
        group_name: "",
        group_code: "",
        cluster_name: "",
        cluster_code: "",
        village: "",
        no_members: "",
        formation_date: "",
        saving_per_member: "",
        Mship_Group: "",
        membership_fees: "",
        mitan_name: "",
        meeting_date_1_day: "",
        meeting_date_2_day: "",
        meeting_date_2_time: "",
        sahyog_rashi: "",
        shar_capital: "",
        other: "",
        remark: "",
        govt_linked: "",
        govt_project_type: "",
        saving_rate: "",
        fd_rate: "",
        loan_rate: "",
        password: "",
        supervisorId: "",
        supervisorName: "",
    });

    const [clusters, setClusters] = useState([]);
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [isNewCluster, setIsNewCluster] = useState(false);
    const [useExistingSupervisor, setUseExistingSupervisor] = useState(true);
    const [existingMembers, setExistingMembers] = useState([]);

    useEffect(() => {
        fetchClusters();
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getMembers();
                const list = Array.isArray(res?.data) ? res.data : [];
                setExistingMembers(list);
            } catch (err) {
                console.error("Failed to load members for supervisor dropdown:", err);
            }
        };
        load();
    }, []);

    const fetchClusters = async () => {
        try {
            const res = await getClusters();
            if (res.success) {
                setClusters(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch clusters:", err);
        }
    };

    const govtOptions = ["Yes", "No"];
    const projectOptions = ["NRLM", "Other"];

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleClusterChange = (e) => {
        const val = e.target.value;
        setSelectedClusterId(val);
        
        if (val === "NEW") {
            setIsNewCluster(true);
            setForm({ ...form, cluster_name: "", cluster_code: "" });
        } else if (val) {
            const cluster = clusters.find(c => `${c.cluster_name}|${c.cluster_code}` === val);
            if (cluster) {
                setIsNewCluster(false);
                setForm({ ...form, cluster_name: cluster.cluster_name, cluster_code: cluster.cluster_code });
            }
        } else {
            setIsNewCluster(false);
            setForm({ ...form, cluster_name: "", cluster_code: "" });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...form };
        if (useExistingSupervisor && form.supervisorId) {
            payload.supervisorId = form.supervisorId;
            delete payload.supervisorName;
        } else if (!useExistingSupervisor && form.supervisorName?.trim()) {
            payload.supervisorName = form.supervisorName.trim();
            delete payload.supervisorId;
        } else {
            delete payload.supervisorId;
            delete payload.supervisorName;
        }
        if (!payload.password?.trim()) delete payload.password;
        const result = await execute(() => createGroup(payload));
        
        if (result.success) {
            alert("Group created successfully! You can add bank details later from 'Bank for Group' section.");
            // Reset form
            setForm({
                group_name: "",
                group_code: "",
                cluster_name: "",
                cluster_code: "",
                village: "",
                no_members: "",
                formation_date: "",
                saving_per_member: "",
                Mship_Group: "",
                membership_fees: "",
                mitan_name: "",
                meeting_date_1_day: "",
                meeting_date_2_day: "",
                meeting_date_2_time: "",
                sahyog_rashi: "",
                shar_capital: "",
                other: "",
                remark: "",
                govt_linked: "",
                govt_project_type: "",
                saving_rate: "",
                fd_rate: "",
                loan_rate: "",
                password: "",
                supervisorId: "",
                supervisorName: "",
            });
            setSelectedClusterId("");
            setIsNewCluster(false);
            fetchClusters(); // Refresh clusters list
        }
    };

    const clusterOptions = [
        ...clusters.map(c => ({
            value: `${c.cluster_name}|${c.cluster_code}`,
            label: `${c.cluster_name} (${c.cluster_code || 'No Code'})`
        })),
        { value: "NEW", label: "+ Add New Cluster" }
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <BackButton fallback="/admin/group-management" label="Back to group management" className="mb-4" />
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <PlusCircle size={32} />
                    Create Village Samooh Group
                </h1>
                <p className="text-gray-600 mt-2">
                    Create a new group - one group can have many members. Bank details can be added separately from "Bank for Group" section.
                </p>
            </div>

            {error && error.shouldShow && (
                <div className="mb-6">
                    <ErrorMessage error={error} onDismiss={clearError} />
                </div>
            )}

            <div className="relative">
                <OverlayLoader loading={loading} message="Creating group..." />
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Group Information */}
                <FormSection title="Basic Group Information" icon={Building2}>
                    <Input
                        label="Group Name"
                        name="group_name"
                        value={form.group_name}
                        handleChange={handleChange}
                        required
                        placeholder="Enter group name"
                    />
                    <Input
                        label="Group Code"
                        name="group_code"
                        value={form.group_code}
                        handleChange={handleChange}
                        required
                        placeholder="Enter unique group code"
                    />
                    <VillageCombobox
                        label="Village"
                        name="village"
                        value={form.village}
                        handleChange={handleChange}
                        required
                        placeholder="Search or type village name"
                    />
                    <Input
                        type="number"
                        label="Number of Members"
                        name="no_members"
                        value={form.no_members}
                        handleChange={handleChange}
                        placeholder="Enter number of members"
                    />
                </FormSection>

                {/* Cluster Information */}
                <FormSection title="Cluster Information" icon={LayoutGrid}>
                    <Select
                        label="Select Cluster"
                        name="cluster_selection"
                        value={selectedClusterId}
                        handleChange={handleClusterChange}
                        options={clusterOptions}
                        required
                    />
                    {isNewCluster && (
                        <>
                            <Input
                                label="New Cluster Name"
                                name="cluster_name"
                                value={form.cluster_name}
                                handleChange={handleChange}
                                required
                                placeholder="Enter new cluster name"
                            />
                            <Input
                                label="New Cluster Code"
                                name="cluster_code"
                                value={form.cluster_code}
                                handleChange={handleChange}
                                required
                                placeholder="Enter new cluster code"
                            />
                        </>
                    )}
                    {!isNewCluster && selectedClusterId && (
                        <>
                            <Input
                                label="Cluster Name"
                                name="cluster_name"
                                value={form.cluster_name}
                                handleChange={handleChange}
                                disabled
                            />
                            <Input
                                label="Cluster Code"
                                name="cluster_code"
                                value={form.cluster_code}
                                handleChange={handleChange}
                                disabled
                            />
                        </>
                    )}
                </FormSection>

                {/* Formation & Dates */}
                <FormSection title="Formation & Meeting Details" icon={Calendar}>
                    <Input
                        type="date"
                        label="Formation Date"
                        name="formation_date"
                        value={form.formation_date}
                        handleChange={handleChange}
                    />
                    <div className="flex flex-col">
                        <label className="font-semibold mb-1.5 text-gray-700 text-sm">Meeting Date 1 - Day</label>
                        <input
                            type="number"
                            name="meeting_date_1_day"
                            value={form.meeting_date_1_day || ""}
                            onChange={handleChange}
                            min="1"
                            max="31"
                            placeholder="Day (1-31)"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-semibold mb-1.5 text-gray-700 text-sm">Meeting Date 2 - Day</label>
                        <input
                            type="number"
                            name="meeting_date_2_day"
                            value={form.meeting_date_2_day || ""}
                            onChange={handleChange}
                            min="1"
                            max="31"
                            placeholder="Day (1-31)"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-semibold mb-1.5 text-gray-700 text-sm">Meeting Time</label>
                        <input
                            type="time"
                            name="meeting_date_2_time"
                            value={form.meeting_date_2_time || ""}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                        />
                    </div>
                </FormSection>

                {/* Office Bearers */}
                <FormSection title="Office Bearers" icon={Users}>
                    <Input
                        label="Mitan Name"
                        name="mitan_name"
                        value={form.mitan_name}
                        handleChange={handleChange}
                        placeholder="Enter mitan name"
                    />
                </FormSection>

                {/* Supervisor & Group Login */}
                <FormSection title="Supervisor & Group Panel Login" icon={UserPlus}>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-4">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="supervisorMode"
                                    checked={useExistingSupervisor}
                                    onChange={() => setUseExistingSupervisor(true)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Select existing member</span>
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="supervisorMode"
                                    checked={!useExistingSupervisor}
                                    onChange={() => setUseExistingSupervisor(false)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Create new supervisor</span>
                            </label>
                        </div>
                        {useExistingSupervisor ? (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Existing member</label>
                                <select
                                    name="supervisorId"
                                    value={form.supervisorId || ""}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="">— Select member —</option>
                                    {existingMembers.map((m) => (
                                        <option key={m._id} value={m._id}>
                                            {m.Member_Nm || m.Member_Id || m._id}
                                            {m.Member_Id ? ` (${m.Member_Id})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <Input
                                label="Supervisor name"
                                name="supervisorName"
                                value={form.supervisorName}
                                handleChange={handleChange}
                                placeholder="Enter name for new supervisor"
                            />
                        )}
                    </div>
                </FormSection>

                <FormSection title="Group panel password" icon={Lock}>
                    <Input
                        type="password"
                        label="Password (for group login)"
                        name="password"
                        value={form.password}
                        handleChange={handleChange}
                        placeholder="Leave blank to set later from Group Management"
                    />
                </FormSection>

                {/* Financial Information */}
                <FormSection title="Financial Information" icon={DollarSign}>
                    <Input
                        type="number"
                        label="Saving Per Member"
                        name="saving_per_member"
                        value={form.saving_per_member}
                        handleChange={handleChange}
                        placeholder="Enter saving amount per member"
                    />
                    <Input
                        type="number"
                        label="Membership Fees"
                        name="membership_fees"
                        value={form.membership_fees}
                        handleChange={handleChange}
                        placeholder="Enter membership fees"
                    />
                    <Input
                        label="Sahyog Rashi"
                        name="sahyog_rashi"
                        value={form.sahyog_rashi}
                        handleChange={handleChange}
                        placeholder="Enter sahyog rashi"
                    />
                    <Input
                        label="Share Capital"
                        name="shar_capital"
                        value={form.shar_capital}
                        handleChange={handleChange}
                        placeholder="Enter share capital"
                    />
                    <Input
                        label="Membership Group"
                        name="Mship_Group"
                        value={form.Mship_Group}
                        handleChange={handleChange}
                        placeholder="Enter membership group"
                    />
                    <Input
                        type="number"
                        label="Saving Rate (%)"
                        name="saving_rate"
                        value={form.saving_rate}
                        handleChange={handleChange}
                        placeholder="Enter saving interest rate percentage"
                        step="0.01"
                        min="0"
                        max="100"
                    />
                    <Input
                        type="number"
                        label="FD Rate (%)"
                        name="fd_rate"
                        value={form.fd_rate}
                        handleChange={handleChange}
                        placeholder="Enter Fixed Deposit interest rate percentage"
                        step="0.01"
                        min="0"
                        max="100"
                    />
                    <Input
                        type="number"
                        label="Loan Rate (%)"
                        name="loan_rate"
                        value={form.loan_rate}
                        handleChange={handleChange}
                        placeholder="Enter loan interest rate percentage"
                        step="0.01"
                        min="0"
                        max="100"
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

                {/* Additional Information */}
                <FormSection title="Additional Information">
                    <div className="md:col-span-2">
                        <TextArea
                            label="Other Information"
                            name="other"
                            value={form.other}
                            handleChange={handleChange}
                            rows={3}
                            placeholder="Enter any other information"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <TextArea
                            label="Remarks"
                            name="remark"
                            value={form.remark}
                            handleChange={handleChange}
                            rows={3}
                            placeholder="Enter remarks if any"
                        />
                    </div>
                </FormSection>

                {/* Submit Button */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to reset the form?")) {
                                    setForm({
                                        group_name: "",
                                        group_code: "",
                                        cluster_name: "",
                                        cluster_code: "",
                                        village: "",
                                        no_members: "",
                                        formation_date: "",
                                        saving_per_member: "",
                                        Mship_Group: "",
                                        membership_fees: "",
                                        mitan_name: "",
                                        meeting_date_1_day: "",
                                        meeting_date_2_day: "",
                                        meeting_date_2_time: "",
                                        sahyog_rashi: "",
                                        shar_capital: "",
                                        other: "",
                                        remark: "",
                                        govt_linked: "",
                                        govt_project_type: "",
                                        saving_rate: "",
                                        fd_rate: "",
                                        loan_rate: "",
                                        password: "",
                                        supervisorId: "",
                                        supervisorName: "",
                                    });
                                    setSelectedClusterId("");
                                    setIsNewCluster(false);
                                }
                            }}
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                        >
                            Reset Form
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors shadow-md"
                        >
                            {loading ? "Creating..." : "Create Group"}
                        </button>
                    </div>
                </div>
            </form>
            </div>
        </div>
    );
}
