import React, { useState } from "react";
import { createGroup } from "../../services/groupService";
import { PlusCircle, Building2, Users, Calendar, DollarSign, FileText } from "lucide-react";
import { Input, Select, TextArea, FormSection } from "../../components/forms/FormComponents";

export default function CreateGroup() {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        group_name: "",
        group_code: "",
        cluster_name: "",
        village: "",
        no_members: "",
        formation_date: "",
        president_name: "",
        secretary_name: "",
        treasurer_name: "",
        cluster: "",
        saving_per_member: "",
        Mship_Group: "",
        membership_fees: "",
        mitan_name: "",
        meeting_date_1: "",
        meeting_date_2: "",
        sahyog_rashi: "",
        shar_capital: "",
        other: "",
        remark: "",
        govt_linked: "",
        govt_project_type: "",
    });

    const govtOptions = ["Yes", "No"];
    const projectOptions = ["NRLM", "Other"];

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await createGroup(form);
            alert("Group created successfully! You can add bank details later from 'Bank for Group' section.");
            // Reset form
            setForm({
                group_name: "",
                group_code: "",
                cluster_name: "",
                village: "",
                no_members: "",
                formation_date: "",
                president_name: "",
                secretary_name: "",
                treasurer_name: "",
                cluster: "",
                saving_per_member: "",
                Mship_Group: "",
                membership_fees: "",
                mitan_name: "",
                meeting_date_1: "",
                meeting_date_2: "",
                sahyog_rashi: "",
                shar_capital: "",
                other: "",
                remark: "",
                govt_linked: "",
                govt_project_type: "",
            });
        } catch (error) {
            alert(error.message || "Something went wrong!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <PlusCircle size={32} />
                    Create Village Samooh Group
                </h1>
                <p className="text-gray-600 mt-2">
                    Create a new group - one group can have many members. Bank details can be added separately from "Bank for Group" section.
                </p>
            </div>

            {loading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-center text-lg text-blue-600 font-bold">Creating Group...</p>
                </div>
            )}

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
                    <Input
                        label="Village"
                        name="village"
                        value={form.village}
                        handleChange={handleChange}
                        required
                        placeholder="Enter village name"
                    />
                    <Input
                        label="Cluster Name"
                        name="cluster_name"
                        value={form.cluster_name}
                        handleChange={handleChange}
                        placeholder="Enter cluster name"
                    />
                    <Input
                        label="Cluster"
                        name="cluster"
                        value={form.cluster}
                        handleChange={handleChange}
                        placeholder="Enter cluster"
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

                {/* Formation & Dates */}
                <FormSection title="Formation & Meeting Details" icon={Calendar}>
                    <Input
                        type="date"
                        label="Formation Date"
                        name="formation_date"
                        value={form.formation_date}
                        handleChange={handleChange}
                    />
                    <Input
                        type="date"
                        label="Meeting Date 1"
                        name="meeting_date_1"
                        value={form.meeting_date_1}
                        handleChange={handleChange}
                    />
                    <Input
                        type="date"
                        label="Meeting Date 2"
                        name="meeting_date_2"
                        value={form.meeting_date_2}
                        handleChange={handleChange}
                    />
                </FormSection>

                {/* Office Bearers */}
                <FormSection title="Office Bearers" icon={Users}>
                    <Input
                        label="President Name"
                        name="president_name"
                        value={form.president_name}
                        handleChange={handleChange}
                        placeholder="Enter president name"
                    />
                    <Input
                        label="Secretary Name"
                        name="secretary_name"
                        value={form.secretary_name}
                        handleChange={handleChange}
                        placeholder="Enter secretary name"
                    />
                    <Input
                        label="Treasurer Name"
                        name="treasurer_name"
                        value={form.treasurer_name}
                        handleChange={handleChange}
                        placeholder="Enter treasurer name"
                    />
                    <Input
                        label="Mitan Name"
                        name="mitan_name"
                        value={form.mitan_name}
                        handleChange={handleChange}
                        placeholder="Enter mitan name"
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
                                        village: "",
                                        no_members: "",
                                        formation_date: "",
                                        president_name: "",
                                        secretary_name: "",
                                        treasurer_name: "",
                                        cluster: "",
                                        saving_per_member: "",
                                        Mship_Group: "",
                                        membership_fees: "",
                                        mitan_name: "",
                                        meeting_date_1: "",
                                        meeting_date_2: "",
                                        sahyog_rashi: "",
                                        shar_capital: "",
                                        other: "",
                                        remark: "",
                                        govt_linked: "",
                                        govt_project_type: "",
                                    });
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
    );
}
