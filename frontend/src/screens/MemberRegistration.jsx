import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { allGroup } from "../Api/groupApi";
import { registerMember } from "../Api/memberModelApi";
import { ApiUrl } from "../redux/api_url";
export default function MemberRegistration() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

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

  /* ================= FETCH GROUPS ================= */
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const res = await allGroup();
        setGroups(res?.data || []);
      } catch (err) {
        console.error("Group fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      Age: form.Age ? Number(form.Age) : null,
      Anual_Income: form.Anual_Income ? Number(form.Anual_Income) : null,
      Member_Dt: form.Member_Dt || null,
      Dt_Join: form.Dt_Join || null,
      dt_birth: form.dt_birth || null,
    };

    try {
      setLoading(true);
      await registerMember(payload);
      alert("✅ Member Registered Successfully!");
    } catch (err) {
      console.error(err?.response?.data);
      // alert("❌ Registration failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= EXPORT PDF ================= */
  const handleExportPdf = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(ApiUrl.EXPORT_FULL_MEMBER_API, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "members.pdf");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("❌ Failed to export members PDF");
    }
  };

  const aplbplOptions = ["APL", "BPL"];
  const designationOptions = ["Member", "President", "Secretary", "Treasurer"];
  const bankOptions = ["SBI", "PNB", "BOI", "HDFC", "ICICI"];
  const casteOptions = ["GEN", "OBC", "SC", "ST"];
  const religionOptions = ["Hindu", "Muslim", "Christian", "Sikh"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        Member Registration
      </h1>
      <div className="flex justify-around m-3">
        <Link to="/register-group" className="underline text-blue-500 focus:text-gray-400">
          Register Group
        </Link>
        <button
          onClick={handleExportPdf}
          className="bg-blue-600 text-white rounded-2xl p-2"
        >
          Export Full Member Detail
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* GROUP */}
        <Select
          label="Select Group"
          name="Group_Name"
          value={form.Group_Name}
          options={groups.map((g) => g.group_name)}
          handleChange={handleChange}
        />

        <Input label="Member ID" name="Member_Id" value={form.Member_Id} handleChange={handleChange} />
        <Input label="Member Name" name="Member_Nm" value={form.Member_Nm} handleChange={handleChange} />

        <Input type="date" label="Member Date" name="Member_Dt" value={form.Member_Dt} handleChange={handleChange} />
        <Input type="date" label="Join Date" name="Dt_Join" value={form.Dt_Join} handleChange={handleChange} />

        <Input label="Father / Husband Name" name="F_H_Name" value={form.F_H_Name} handleChange={handleChange} />
        <Input label="Father's Father Name" name="F_H_FatherName" value={form.F_H_FatherName} handleChange={handleChange} />

        <Input label="Voter ID" name="Voter_Id" value={form.Voter_Id} handleChange={handleChange} />
        <Input label="Aadhar ID" name="Adhar_Id" value={form.Adhar_Id} handleChange={handleChange} />

        <Input label="Ration Card" name="Ration_Card" value={form.Ration_Card} handleChange={handleChange} />
        <Input label="Job Card" name="Job_Card" value={form.Job_Card} handleChange={handleChange} />

        <Select label="APL / BPL" name="Apl_Bpl_Etc" value={form.Apl_Bpl_Etc} options={aplbplOptions} handleChange={handleChange} />
        <Select label="Designation" name="Desg" value={form.Desg} options={designationOptions} handleChange={handleChange} />

        <Select label="Bank Name" name="Bank_Name" value={form.Bank_Name} options={bankOptions} handleChange={handleChange} />
        <Input label="Branch Name" name="Br_Name" value={form.Br_Name} handleChange={handleChange} />
        <Input label="Account Number" name="Bank_Ac" value={form.Bank_Ac} handleChange={handleChange} />
        <Input label="IFSC Code" name="Ifsc_No" value={form.Ifsc_No} handleChange={handleChange} />

        <Input type="number" label="Age" name="Age" value={form.Age} handleChange={handleChange} />
        <Input label="Annual Income" name="Anual_Income" value={form.Anual_Income} handleChange={handleChange} />
        <Input label="Profession" name="Profession" value={form.Profession} handleChange={handleChange} />

        <Select label="Caste" name="Caste" value={form.Caste} options={casteOptions} handleChange={handleChange} />
        <Select label="Religion" name="Religion" value={form.Religion} options={religionOptions} handleChange={handleChange} />

        <Input label="Mobile Number" name="cell_phone" value={form.cell_phone} handleChange={handleChange} />
        <Input type="date" label="Birth Date" name="dt_birth" value={form.dt_birth} handleChange={handleChange} />

        <Input label="Nominee 1" name="nominee_1" value={form.nominee_1} handleChange={handleChange} />
        <Input label="Nominee 2" name="nominee_2" value={form.nominee_2} handleChange={handleChange} />

        <Input label="Address Line 1" name="res_add1" value={form.res_add1} handleChange={handleChange} />
        <Input label="Address Line 2" name="res_add2" value={form.res_add2} handleChange={handleChange} />
        <Input label="Village" name="Village" value={form.Village} handleChange={handleChange} />

        <div className="col-span-1 md:col-span-2 text-center mt-6">
          <button
            disabled={loading}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg"
          >
            {loading ? "Saving..." : "Register Member"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= INPUT ================= */
function Input({ label, name, value, handleChange, type = "text" }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        className="border p-2 rounded-lg"
      />
    </div>
  );
}

/* ================= SELECT ================= */
function Select({ label, name, value, options = [], handleChange }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <select
        name={name}
        value={value}
        onChange={handleChange}
        className="border p-2 rounded-lg bg-white"
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
