import { useState } from "react";
import { Link } from "react-router-dom";

export default function MemberRegistration() {
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
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form Submitted:", form);
    alert("Member Registered Successfully!");
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
  const groupOptions = ["Group 1", "Group 2", "Group 3", "Group 4"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Member Registration</h1>

      <Link
        to="/register-group"
        className="text-blue-600 underline mb-4 inline-block"
      >
        ➕ Add Group
      </Link>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Group */}
        <Select
          label="Select Group"
          name="Group_Name"
          value={form.Group_Name}
          options={groupOptions}
          handleChange={handleChange}
        />

        {/* Basic Inputs */}
        <Input
          label="Member ID"
          name="Member_Id"
          value={form.Member_Id}
          handleChange={handleChange}
        />
        <Input
          label="Member Name"
          name="Member_Nm"
          value={form.Member_Nm}
          handleChange={handleChange}
        />

        {/* Dates */}
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
        />

        {/* Family */}
        <Input
          label="Father/Husband Name"
          name="F_H_Name"
          value={form.F_H_Name}
          handleChange={handleChange}
        />
        <Input
          label="Father's Father Name"
          name="F_H_FatherName"
          value={form.F_H_FatherName}
          handleChange={handleChange}
        />

        {/* IDs */}
        <Input
          label="Voter ID"
          name="Voter_Id"
          value={form.Voter_Id}
          handleChange={handleChange}
        />
        <Input
          label="Aadhar No"
          name="Adhar_Id"
          value={form.Adhar_Id}
          handleChange={handleChange}
        />
        <Input
          label="Ration Card No"
          name="Ration_Card"
          value={form.Ration_Card}
          handleChange={handleChange}
        />
        <Input
          label="Job Card No"
          name="Job_Card"
          value={form.Job_Card}
          handleChange={handleChange}
        />

        {/* Dropdowns */}
        <Select
          label="APL / BPL"
          name="Apl_Bpl_Etc"
          value={form.Apl_Bpl_Etc}
          options={aplbplOptions}
          handleChange={handleChange}
        />
        <Select
          label="Designation"
          name="Desg"
          value={form.Desg}
          options={designationOptions}
          handleChange={handleChange}
        />

        {/* Bank */}
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
        />
        <Input
          label="Account Number"
          name="Bank_Ac"
          value={form.Bank_Ac}
          handleChange={handleChange}
        />
        <Input
          label="IFSC Code"
          name="Ifsc_No"
          value={form.Ifsc_No}
          handleChange={handleChange}
        />

        {/* Personal Info */}
        <Input
          type="number"
          label="Age"
          name="Age"
          value={form.Age}
          handleChange={handleChange}
        />
        <Select
          label="Education"
          name="Edu_Qual"
          value={form.Edu_Qual}
          options={educationOptions}
          handleChange={handleChange}
        />
        <Input
          type="number"
          label="Annual Income"
          name="Anual_Income"
          value={form.Anual_Income}
          handleChange={handleChange}
        />
        <Select
          label="Profession"
          name="Profession"
          value={form.Profession}
          options={professionOptions}
          handleChange={handleChange}
        />

        {/* Caste & Religion */}
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

        {/* Contact */}
        <Input
          type="number"
          label="Mobile Number"
          name="cell_phone"
          value={form.cell_phone}
          handleChange={handleChange}
        />
        <Input
          type="date"
          label="Birth Date"
          name="dt_birth"
          value={form.dt_birth}
          handleChange={handleChange}
        />

        {/* Nominees */}
        <Input
          label="Nominee 1"
          name="nominee_1"
          value={form.nominee_1}
          handleChange={handleChange}
        />
        <Input
          label="Nominee 2"
          name="nominee_2"
          value={form.nominee_2}
          handleChange={handleChange}
        />

        {/* Address */}
        <Input
          label="Address Line 1"
          name="res_add1"
          value={form.res_add1}
          handleChange={handleChange}
        />
        <Input
          label="Address Line 2"
          name="res_add2"
          value={form.res_add2}
          handleChange={handleChange}
        />
        <Input
          label="Village"
          name="Village"
          value={form.Village}
          handleChange={handleChange}
        />

        {/* Submit */}
        <div className="col-span-1 md:col-span-2 text-center mt-6">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow"
          >
            Register Member
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= INPUT COMPONENT ================= */
function Input({ label, name, value, handleChange, type = "text" }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
      />
    </div>
  );
}

/* ================= SELECT COMPONENT ================= */
function Select({ label, name, value, options, handleChange }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <select
        name={name}
        value={value}
        onChange={handleChange}
        className="border p-2 rounded-lg bg-white focus:ring-2 ring-blue-400"
      >
        <option value="">Select</option>
        {options.map((opt, i) => (
          <option key={i} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
