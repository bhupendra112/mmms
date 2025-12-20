import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { User, IdCard, Building2, DollarSign, GraduationCap, MapPin, Users } from "lucide-react";
import { Input, Select, TextArea, FormSection, FileInput } from "../components/forms/FormComponents";
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
    // File uploads for identity documents
    Voter_Id_File: null,
    Adhar_Id_File: null,
    Ration_Card_File: null,
    Job_Card_File: null,
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
    // Existing member financial details
    isExistingMember: false,
    openingSaving: "",
    fdDetails: {
      date: "",
      maturityDate: "",
      amount: "",
      interest: "",
    },
    loanDetails: {
      amount: "",
      loanDate: "",
      overdueInterest: "",
    },
    openingYogdan: "",
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
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setForm({ ...form, [name]: checked });
    } else if (type === "file") {
      // Handle file uploads
      setForm({ ...form, [name]: files && files[0] ? files[0] : null });
    } else if (name.startsWith("fdDetails.")) {
      const field = name.split(".")[1];
      setForm({
        ...form,
        fdDetails: { ...form.fdDetails, [field]: value },
      });
    } else if (name.startsWith("loanDetails.")) {
      const field = name.split(".")[1];
      setForm({
        ...form,
        loanDetails: { ...form.loanDetails, [field]: value },
      });
    } else {
      setForm({ ...form, [name]: value });
    }
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
      // Create FormData for file uploads
      const formData = new FormData();

      // Add all form fields to FormData
      Object.keys(form).forEach(key => {
        // Skip file fields - they'll be added separately
        if (key.endsWith('_File')) {
          return;
        }

        const value = form[key];

        // Skip null/undefined values
        if (value === null || value === undefined || value === '') {
          return;
        }

        // Handle nested objects (fdDetails, loanDetails)
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else if (value instanceof Date) {
          // Convert dates to ISO string
          formData.append(key, value.toISOString());
        } else {
          // Convert all other values to string
          formData.append(key, String(value));
        }
      });

      // Add file uploads if present
      const fileFields = ['Voter_Id_File', 'Adhar_Id_File', 'Ration_Card_File', 'Job_Card_File'];
      fileFields.forEach(fieldName => {
        if (form[fieldName] && form[fieldName] instanceof File) {
          formData.append(fieldName, form[fieldName]);
        }
      });

      // If in group context, create approval request
      // Note: For approval requests, we might need to convert FormData to a regular object
      // or handle it differently in the approval service
      if (currentGroup) {
        // Convert FormData to object for approval request (files will be excluded)
        const approvalData = {};
        for (const [key, value] of formData.entries()) {
          if (!(value instanceof File)) {
            approvalData[key] = value;
          }
        }
        await createApprovalRequest("member", approvalData, currentGroup.id, currentGroup.name);
        alert("Member registration submitted for approval!");
      } else {
        // In admin context, directly register member to DB with FormData
        await registerMemberApi(formData);
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
        Voter_Id_File: null,
        Adhar_Id_File: null,
        Ration_Card_File: null,
        Job_Card_File: null,
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
        isExistingMember: false,
        openingSaving: "",
        fdDetails: { date: "", maturityDate: "", amount: "", interest: "" },
        loanDetails: { amount: "", loanDate: "", overdueInterest: "" },
        openingYogdan: "",
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
        {/* Existing Member Checkbox */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="isExistingMember"
              checked={form.isExistingMember}
              onChange={handleChange}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-lg font-semibold text-gray-800">
              Is this an existing member? (For migrating from Excel)
            </span>
          </label>
        </div>

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
          <FileInput
            label="Voter ID Document"
            name="Voter_Id_File"
            value={form.Voter_Id_File}
            handleChange={handleChange}
            accept="image/*,.pdf"
          />
          <Input
            label="Aadhar Number"
            name="Adhar_Id"
            value={form.Adhar_Id}
            handleChange={handleChange}
            placeholder="Enter Aadhar number"
          />
          <FileInput
            label="Aadhar Document"
            name="Adhar_Id_File"
            value={form.Adhar_Id_File}
            handleChange={handleChange}
            accept="image/*,.pdf"
          />
          <Input
            label="Ration Card Number"
            name="Ration_Card"
            value={form.Ration_Card}
            handleChange={handleChange}
            placeholder="Enter ration card number"
          />
          <FileInput
            label="Ration Card Document"
            name="Ration_Card_File"
            value={form.Ration_Card_File}
            handleChange={handleChange}
            accept="image/*,.pdf"
          />
          <Input
            label="Job Card Number"
            name="Job_Card"
            value={form.Job_Card}
            handleChange={handleChange}
            placeholder="Enter job card number"
          />
          <FileInput
            label="Job Card Document"
            name="Job_Card_File"
            value={form.Job_Card_File}
            handleChange={handleChange}
            accept="image/*,.pdf"
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

        {/* Existing Member Financial Details */}
        {form.isExistingMember && (
          <FormSection title="Existing Member Financial Details" icon={DollarSign}>
            <div className="md:col-span-2 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> These fields are for migrating existing members from Excel. Opening Yogdan is a one-time balance; future Yogdan will be tracked in the recovery system.
              </p>
            </div>

            <Input
              type="number"
              label="Opening Saving"
              name="openingSaving"
              value={form.openingSaving}
              handleChange={handleChange}
              placeholder="Enter opening saving balance"
            />

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">FD Details</h3>
            </div>
            <Input
              type="date"
              label="FD Date"
              name="fdDetails.date"
              value={form.fdDetails.date}
              handleChange={handleChange}
            />
            <Input
              type="date"
              label="Maturity Date"
              name="fdDetails.maturityDate"
              value={form.fdDetails.maturityDate}
              handleChange={handleChange}
            />
            <Input
              type="number"
              label="FD Amount"
              name="fdDetails.amount"
              value={form.fdDetails.amount}
              handleChange={handleChange}
              placeholder="Enter FD amount"
            />
            <Input
              type="number"
              label="Interest"
              name="fdDetails.interest"
              value={form.fdDetails.interest}
              handleChange={handleChange}
              placeholder="Enter interest amount"
            />

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-4">Loan Details</h3>
            </div>
            <Input
              type="number"
              label="Loan Amount"
              name="loanDetails.amount"
              value={form.loanDetails.amount}
              handleChange={handleChange}
              placeholder="Enter loan amount"
            />
            <Input
              type="date"
              label="Loan Date"
              name="loanDetails.loanDate"
              value={form.loanDetails.loanDate}
              handleChange={handleChange}
            />
            <Input
              type="number"
              label="Overdue Interest"
              name="loanDetails.overdueInterest"
              value={form.loanDetails.overdueInterest}
              handleChange={handleChange}
              placeholder="Enter overdue interest"
            />

            <Input
              type="number"
              label="Opening Yogdan"
              name="openingYogdan"
              value={form.openingYogdan}
              handleChange={handleChange}
              placeholder="Enter opening Yogdan balance"
            />
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mt-1">
                This is a one-time opening balance. Future Yogdan will be tracked in the recovery system.
              </p>
            </div>
          </FormSection>
        )}

        {/* Submit Button */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to reset the form?")) {
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
                    Voter_Id_File: null,
                    Adhar_Id_File: null,
                    Ration_Card_File: null,
                    Job_Card_File: null,
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
                    Group_Name: currentGroup?.name || form.Group_Name,
                    group_id: currentGroup?.id || form.group_id,
                    isExistingMember: false,
                    openingSaving: "",
                    fdDetails: { date: "", maturityDate: "", amount: "", interest: "" },
                    loanDetails: { amount: "", loanDate: "", overdueInterest: "" },
                    openingYogdan: "",
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
