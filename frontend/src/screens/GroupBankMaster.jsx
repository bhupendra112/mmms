import React, { useState } from "react";
import { addGroup, addBank } from "../Api/groupApi";

/* =====================================
   CLEAN PAYLOAD
===================================== */
const cleanPayload = (obj) => {
  const cleaned = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) {
      cleaned[k] = v;
    }
  });
  return cleaned;
};

/* =====================================
   MAIN COMPONENT
===================================== */
export default function GroupBankMaster() {
  const [step, setStep] = useState(1);
  const [groupData, setGroupData] = useState({});
  const [bankData, setBankData] = useState({});
  const [loading, setLoading] = useState(false);

  const finalSubmit = async (bankForm) => {
    try {
      setLoading(true);

      if (!groupData.group_name || !groupData.group_code) {
        alert("Group Name & Code required");
        setStep(1);
        return;
      }

      const groupPayload = cleanPayload(groupData);
      const groupRes = await addGroup(groupPayload);
      const groupId = groupRes?.data?._id;

      if (!groupId) {
        alert("Group ID missing");
        return;
      }

      const bankPayload = cleanPayload({
        ...bankForm,
        group_id: groupId,
      });

      if (bankPayload.bank_name && bankPayload.account_type) {
        await addBank(bankPayload);
      }

      alert("✅ Saved Successfully");
      setStep(1);
      setGroupData({});
      setBankData({});
    } catch (err) {
      console.log(err)
      // alert(err?.response?.data?.message || "Server Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        Group & Bank Master
      </h1>

      {loading && <p className="text-center">Saving...</p>}

      {step === 1 ? (
        <GroupMasterForm
          defaultValues={groupData}
          onNext={(data) => {
            setGroupData(data);
            setStep(2);
          }}
        />
      ) : (
        <BankMasterForm
          defaultValues={bankData}
          onBack={() => setStep(1)}
          onSubmitAll={finalSubmit}
        />
      )}
    </div>
  );
}


/* ======================================================
   GROUP MASTER FORM
====================================================== */
function GroupMasterForm({ onNext, defaultValues }) {
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
    ...defaultValues,
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext(form);
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 shadow rounded-xl"
    >
      <Input label="Group Name" name="group_name" value={form.group_name} handleChange={handleChange} />
      <Input label="Group Code" name="group_code" value={form.group_code} handleChange={handleChange} />
      <Input label="Cluster Name" name="cluster_name" value={form.cluster_name} handleChange={handleChange} />
      <Input label="Village" name="village" value={form.village} handleChange={handleChange} />
      <Input label="Cluster" name="cluster" value={form.cluster} handleChange={handleChange} />
      <Input label="No Members" name="no_members" value={form.no_members} handleChange={handleChange} />
      <Input type="date" label="Formation Date" name="formation_date" value={form.formation_date} handleChange={handleChange} />
      <Input label="President Name" name="president_name" value={form.president_name} handleChange={handleChange} />
      <Input label="Secretary Name" name="secretary_name" value={form.secretary_name} handleChange={handleChange} />
      <Input label="Treasurer Name" name="treasurer_name" value={form.treasurer_name} handleChange={handleChange} />
      <Input label="Saving Per Member" name="saving_per_member" value={form.saving_per_member} handleChange={handleChange} />
      <Input label="Membership Fees" name="membership_fees" value={form.membership_fees} handleChange={handleChange} />
      <Input label="Membership Group" name="Mship_Group" value={form.Mship_Group} handleChange={handleChange} />
      <Input label="Mitan Name" name="mitan_name" value={form.mitan_name} handleChange={handleChange} />
      <Input type="date" label="Meeting Date 1" name="meeting_date_1" value={form.meeting_date_1} handleChange={handleChange} />
      <Input type="date" label="Meeting Date 2" name="meeting_date_2" value={form.meeting_date_2} handleChange={handleChange} />
      <Input label="Sahyog Rashi" name="sahyog_rashi" value={form.sahyog_rashi} handleChange={handleChange} />
      <Input label="Share Capital" name="shar_capital" value={form.shar_capital} handleChange={handleChange} />
      <Input label="Other" name="other" value={form.other} handleChange={handleChange} />
      <Input label="Remark" name="remark" value={form.remark} handleChange={handleChange} />

      <Select
        label="Govt Linked?"
        name="govt_linked"
        value={form.govt_linked}
        options={["Yes", "No"]}
        handleChange={handleChange}
      />

      {form.govt_linked === "Yes" && (
        <Select
          label="Govt Project Type"
          name="govt_project_type"
          value={form.govt_project_type}
          options={["NRLM", "Other"]}
          handleChange={handleChange}
        />
      )}

      <div className="col-span-2 text-center mt-4">
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg">
          NEXT → BANK
        </button>
      </div>
    </form>
  );
}


/* ======================================================
   BANK MASTER FORM (IMPORTANT FIX)
====================================================== */
function BankMasterForm({ onSubmitAll, onBack, defaultValues }) {
  const [form, setForm] = useState({
    bank_name: "",
    short_name: "",
    account_no: "",
    branch_name: "",
    ifsc: "",
    account_type: "",
    ac_open_date: "",
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
    ...defaultValues,
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmitAll(form);
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 shadow rounded-xl"
    >
      <Input label="Bank Name" name="bank_name" value={form.bank_name} handleChange={handleChange} />
      <Input label="Short Name" name="short_name" value={form.short_name} handleChange={handleChange} />
      <Input label="Account No" name="account_no" value={form.account_no} handleChange={handleChange} />
      <Input label="Branch Name" name="branch_name" value={form.branch_name} handleChange={handleChange} />
      <Input label="IFSC Code" name="ifsc" value={form.ifsc} handleChange={handleChange} />

      <Select
        label="Account Type"
        name="account_type"
        value={form.account_type}
        options={["Saving", "CC", "FD"]}
        handleChange={handleChange}
      />

      <Input type="date" label="Account Open Date" name="ac_open_date" value={form.ac_open_date} handleChange={handleChange} />
      <Input label="Opening Balance" name="opening_balance" value={form.opening_balance} handleChange={handleChange} />

      {form.account_type === "CC" && (
        <>
          <Input label="CC Limit" name="cc_limit" value={form.cc_limit} handleChange={handleChange} />
          <Input label="DP Limit" name="dp_limit" value={form.dp_limit} handleChange={handleChange} />
        </>
      )}

      {form.account_type === "FD" && (
        <Input type="date" label="FD Maturity Date" name="fd_mat_dt" value={form.fd_mat_dt} handleChange={handleChange} />
      )}

      <Select
        label="Account Closed?"
        name="flg_acclosed"
        value={form.flg_acclosed}
        options={["Yes", "No"]}
        handleChange={handleChange}
      />

      {form.flg_acclosed === "Yes" && (
        <Input type="date" label="Account Closed Date" name="acclosed_dt" value={form.acclosed_dt} handleChange={handleChange} />
      )}

      <Select
        label="Govt Linked?"
        name="govt_linked"
        value={form.govt_linked}
        options={["Yes", "No"]}
        handleChange={handleChange}
      />

      {form.govt_linked === "Yes" && (
        <Select
          label="Govt Project Type"
          name="govt_project_type"
          value={form.govt_project_type}
          options={["NRLM", "Other"]}
          handleChange={handleChange}
        />
      )}

      <div className="col-span-2 flex justify-center gap-6 mt-4">
        <button type="button" onClick={onBack} className="bg-gray-500 text-white px-6 py-2 rounded-lg">
          ← BACK
        </button>
        <button className="bg-green-600 text-white px-6 py-2 rounded-lg">
          FINAL SUBMIT
        </button>
      </div>
    </form>
  );
}


/* ======================================================
   REUSABLE INPUTS
====================================================== */
function Input({ label, name, value, handleChange, type = "text" }) {
  return (
    <div>
      <label className="font-semibold block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      />
    </div>
  );
}

function Select({ label, name, value, options, handleChange }) {
  return (
    <div>
      <label className="font-semibold block mb-1">{label}</label>
      <select
        name={name}
        value={value || ""}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}