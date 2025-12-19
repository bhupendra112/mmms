import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { User, IdCard, Building2, DollarSign, GraduationCap, MapPin, Users } from "lucide-react";
import { Input, Select, TextArea, FormSection } from "../components/forms/FormComponents";
import { createApprovalRequest } from "../services/approvalDB";
import { useGroup } from "../contexts/GroupContext";
import { getGroups } from "../services/groupService";
import { registerMember as registerMemberApi } from "../services/memberService";

export default function MemberRegistration() {
  const { currentGroup, isGroupPanel, isGroupLoading } = useGroup();
  const isAdminMode = !isGroupPanel;
  const [searchParams] = useSearchParams();
  const preselectGroupId = searchParams.get("groupId") || "";

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [form, setForm] = useState({
    Member_Id: "M001",
    Member_Nm: "",
    Member_Dt: "",
    Dt_Join: "",
    F_H_Name: "",
    F_H_FatherName: "",
    Voter_Id: "",
    Adhar_Id: "",
    Ration_Card: "",
    Job_Card: "",
    Apl_Bpl_Etc: "",
    Desg: "",
    Bank_Name: "",
    Br_Name: "",
    Bank_Ac: "",
    Ifsc_No: "",
    Age: "",
    Edu_Qual: "",
    Anual_Income: "",
    Profession: "",
    Caste: "",
    Religion: "",
    cell_phone: "",
    dt_birth: "",
    nominee_1: "",
    nominee_2: "",
    res_add1: "",
    res_add2: "",
    Village: "",
    Group_Name: "",
    group_id: "",
  });

  // Load groups list for admin mode (for dynamic group selection)
  useEffect(() => {
    if (!isAdminMode) return;
    setGroupsLoading(true);
    getGroups()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setGroups(list);
        if (preselectGroupId) {
          const selected = list.find((g) => g._id === preselectGroupId);
          if (selected) {
            setForm((prev) => ({
              ...prev,
              group_id: selected._id,
              Group_Name: selected.group_name || "",
            }));
          }
        }
      })
      .catch((e) => {
        console.error("Failed to load groups:", e);
        setGroups([]);
      })
      .finally(() => setGroupsLoading(false));
  }, [isAdminMode, preselectGroupId]);

  // In group panel, lock the group automatically
  useEffect(() => {
    if (!currentGroup) return;
    setForm((prev) => ({
      ...prev,
      Group_Name: currentGroup.name || "",
      group_id: currentGroup.id || "",
    }));
  }, [currentGroup]);

  const groupOptions = useMemo(() => {
    return groups.map((g) => ({
      value: g._id,
      label: `${g.group_name} (${g.group_code})`,
    }));
  }, [groups]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGroupChange = (e) => {
    const groupId = e.target.value;
    const selected = groups.find((g) => g._id === groupId);
    setForm((prev) => ({
      ...prev,
      group_id: groupId,
      Group_Name: selected?.group_name || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // If in group context, create approval request
      if (currentGroup) {
        await createApprovalRequest("member", form, currentGroup.id, currentGroup.name);
        alert("Member registration submitted for approval!");
      } else {
        // In admin context, directly register member to DB
        await registerMemberApi({
          ...form,
          group_id: form.group_id,
          Group_Name: form.Group_Name,
        });
        alert("Member Registered Successfully!");
      }

      // Reset form
      setForm({
        Member_Id: "",
        Member_Nm: "",
        Member_Dt: "",
        Dt_Join: "",
        F_H_Name: "",
        F_H_FatherName: "",
        Voter_Id: "",
        Adhar_Id: "",
        Ration_Card: "",
        Job_Card: "",
        Apl_Bpl_Etc: "",
        Desg: "",
        Bank_Name: "",
        Br_Name: "",
        Bank_Ac: "",
        Ifsc_No: "",
        Age: "",
        Edu_Qual: "",
        Anual_Income: "",
        Profession: "",
        Caste: "",
        Religion: "",
        cell_phone: "",
        dt_birth: "",
        nominee_1: "",
        nominee_2: "",
        res_add1: "",
        res_add2: "",
        Village: "",
        Group_Name: currentGroup?.name || form.Group_Name, // Keep group selection
        group_id: currentGroup?.id || form.group_id,
      });
    } catch (error) {
      console.error("Error submitting member registration:", error);
      alert("Error submitting member registration");
    }
  };

  // Options
  const casteOptions = ["GEN", "OBC", "SC", "ST", "MINORITY"];
  const religionOptions = ["Hindu", "Muslim", "Christian", "Sikh", "Other"];
  const educationOptions = [
    "Illiterate",
    "Primary",
    "Middle",
    "High School",
    "Higher Secondary",
    "Graduate",
    "Post Graduate",
  ];
  const professionOptions = [
    "Farmer",
    "Labour",
    "Self Employed",
    "Student",
    "House Wife",
    "Private Job",
    "Government Job",
  ];
  const aplbplOptions = ["APL", "BPL"];
  const designationOptions = ["Member", "President", "Secretary", "Treasurer"];
  const bankOptions = ["SBI", "PNB", "BOI", "Central Bank", "HDFC", "ICICI"];
  // groupOptions now comes from API (admin) or from context (group panel)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <User size={32} />
          Member Registration
        </h1>
        <p className="text-gray-600 mt-2">Register a new member for the village samooh group</p>
      </div>

      {isAdminMode && (
        <Link
          to="/admin/create-group"
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block text-sm font-medium"
        >
          ➕ Create New Group
        </Link>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Group Selection */}
        <FormSection title="Group Selection" icon={Building2}>
          {isGroupPanel ? (
            <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
              {isGroupLoading ? (
                <p className="text-gray-600">Loading group…</p>
              ) : currentGroup ? (
                <div className="text-gray-800">
                  <p className="font-semibold">{currentGroup.name}</p>
                  <p className="text-sm text-gray-600">
                    Code: {currentGroup.code} {currentGroup.village ? `| Village: ${currentGroup.village}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-red-600">No active group found.</p>
              )}
            </div>
          ) : (
            <Select
              label={groupsLoading ? "Loading Groups..." : "Select Group"}
              name="group_id"
              value={form.group_id}
              options={groupOptions}
              handleChange={handleGroupChange}
              required
            />
          )}
        </FormSection>

        {/* Basic Member Information */}
        <FormSection title="Basic Member Information" icon={User}>
          <Input
            label="Member ID"
            name="Member_Id"
            value={form.Member_Id}
            handleChange={handleChange}
            placeholder="Auto-generated or enter manually"
          />
          <Input
            label="Member Name"
            name="Member_Nm"
            value={form.Member_Nm}
            handleChange={handleChange}
            required
            placeholder="Enter member full name"
          />
          <Input
            type="date"
            label="Member Date"
            name="Member_Dt"
            value={form.Member_Dt}
            handleChange={handleChange}
          />
          <Input
            type="date"
            label="Join Date"
            name="Dt_Join"
            value={form.Dt_Join}
            handleChange={handleChange}
            required
          />
          <Input
            type="date"
            label="Birth Date"
            name="dt_birth"
            value={form.dt_birth}
            handleChange={handleChange}
          />
          <Input
            type="number"
            label="Age"
            name="Age"
            value={form.Age}
            handleChange={handleChange}
            placeholder="Enter age"
          />
        </FormSection>

        {/* Family Information */}
        <FormSection title="Family Information" icon={Users}>
          <Input
            label="Father/Husband Name"
            name="F_H_Name"
            value={form.F_H_Name}
            handleChange={handleChange}
            placeholder="Enter father/husband name"
          />
          <Input
            label="Father's Father Name"
            name="F_H_FatherName"
            value={form.F_H_FatherName}
            handleChange={handleChange}
            placeholder="Enter grandfather name"
          />
        </FormSection>

        {/* Identity Documents */}
        <FormSection title="Identity Documents" icon={IdCard}>
          <Input
            label="Voter ID"
            name="Voter_Id"
            value={form.Voter_Id}
            handleChange={handleChange}
            placeholder="Enter voter ID number"
          />
          <Input
            label="Aadhar Number"
            name="Adhar_Id"
            value={form.Adhar_Id}
            handleChange={handleChange}
            placeholder="Enter Aadhar number"
          />
          <Input
            label="Ration Card Number"
            name="Ration_Card"
            value={form.Ration_Card}
            handleChange={handleChange}
            placeholder="Enter ration card number"
          />
          <Input
            label="Job Card Number"
            name="Job_Card"
            value={form.Job_Card}
            handleChange={handleChange}
            placeholder="Enter job card number"
          />
        </FormSection>

        {/* Personal Details */}
        <FormSection title="Personal Details">
          <Select
            label="Education Qualification"
            name="Edu_Qual"
            value={form.Edu_Qual}
            options={educationOptions}
            handleChange={handleChange}
          />
          <Select
            label="Profession"
            name="Profession"
            value={form.Profession}
            options={professionOptions}
            handleChange={handleChange}
          />
          <Input
            type="number"
            label="Annual Income"
            name="Anual_Income"
            value={form.Anual_Income}
            handleChange={handleChange}
            placeholder="Enter annual income"
          />
          <Select
            label="Caste"
            name="Caste"
            value={form.Caste}
            options={casteOptions}
            handleChange={handleChange}
          />
          <Select
            label="Religion"
            name="Religion"
            value={form.Religion}
            options={religionOptions}
            handleChange={handleChange}
          />
          <Select
            label="APL / BPL"
            name="Apl_Bpl_Etc"
            value={form.Apl_Bpl_Etc}
            options={aplbplOptions}
            handleChange={handleChange}
          />
        </FormSection>

        {/* Designation */}
        <FormSection title="Group Designation">
          <Select
            label="Designation"
            name="Desg"
            value={form.Desg}
            options={designationOptions}
            handleChange={handleChange}
          />
        </FormSection>

        {/* Bank Information */}
        <FormSection title="Bank Information" icon={DollarSign}>
          <Select
            label="Bank Name"
            name="Bank_Name"
            value={form.Bank_Name}
            options={bankOptions}
            handleChange={handleChange}
          />
          <Input
            label="Branch Name"
            name="Br_Name"
            value={form.Br_Name}
            handleChange={handleChange}
            placeholder="Enter branch name"
          />
          <Input
            label="Account Number"
            name="Bank_Ac"
            value={form.Bank_Ac}
            handleChange={handleChange}
            placeholder="Enter account number"
          />
          <Input
            label="IFSC Code"
            name="Ifsc_No"
            value={form.Ifsc_No}
            handleChange={handleChange}
            placeholder="Enter IFSC code"
          />
        </FormSection>

        {/* Contact Information */}
        <FormSection title="Contact Information">
          <Input
            type="tel"
            label="Mobile Number"
            name="cell_phone"
            value={form.cell_phone}
            handleChange={handleChange}
            placeholder="Enter mobile number"
          />
        </FormSection>

        {/* Nominees */}
        <FormSection title="Nominees">
          <Input
            label="Nominee 1"
            name="nominee_1"
            value={form.nominee_1}
            handleChange={handleChange}
            placeholder="Enter first nominee name"
          />
          <Input
            label="Nominee 2"
            name="nominee_2"
            value={form.nominee_2}
            handleChange={handleChange}
            placeholder="Enter second nominee name"
          />
        </FormSection>

        {/* Address */}
        <FormSection title="Address" icon={MapPin}>
          <div className="md:col-span-2">
            <Input
              label="Address Line 1"
              name="res_add1"
              value={form.res_add1}
              handleChange={handleChange}
              placeholder="Enter address line 1"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Address Line 2"
              name="res_add2"
              value={form.res_add2}
              handleChange={handleChange}
              placeholder="Enter address line 2"
            />
          </div>
          <Input
            label="Village"
            name="Village"
            value={form.Village}
            handleChange={handleChange}
            placeholder="Enter village name"
          />
        </FormSection>

        {/* Submit Button */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to reset the form?")) {
                  setForm({
                    Member_Id: "M001",
                    Member_Nm: "",
                    Member_Dt: "",
                    Dt_Join: "",
                    F_H_Name: "",
                    F_H_FatherName: "",
                    Voter_Id: "",
                    Adhar_Id: "",
                    Ration_Card: "",
                    Job_Card: "",
                    Apl_Bpl_Etc: "",
                    Desg: "",
                    Bank_Name: "",
                    Br_Name: "",
                    Bank_Ac: "",
                    Ifsc_No: "",
                    Age: "",
                    Edu_Qual: "",
                    Anual_Income: "",
                    Profession: "",
                    Caste: "",
                    Religion: "",
                    cell_phone: "",
                    dt_birth: "",
                    nominee_1: "",
                    nominee_2: "",
                    res_add1: "",
                    res_add2: "",
                    Village: "",
                    Group_Name: "",
                  });
                }
              }}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Reset Form
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors shadow-md"
            >
              Register Member
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
