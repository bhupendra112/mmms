import React, { useState } from "react";
import { createGroup, createBank } from "../services/groupService";

// --------------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------------
export default function GroupBankMaster() {
  const [step, setStep] = useState(1);
  const [groupData, setGroupData] = useState({});
  const [bankData, setBankData] = useState({});

  const [loading, setLoading] = useState(false);

  const finalSubmit = async (bankForm) => {
    try {
      setLoading(true);

      // STEP 1: STORE GROUP
      const groupRes = await createGroup(groupData);

      const groupId = groupRes?.data?._id;
      if (!groupId) {
        alert("Group created but no ID returned");
        return;
      }

      // STEP 2: STORE BANK (with group_id)
      const bankPayload = {
        ...bankForm,
        group_id: groupId,
      };

      await createBank(bankPayload);

      alert("Group & Bank Saved Successfully!");
      setLoading(false);
      setStep(1);
    } catch (error) {
      setLoading(false);
      alert(error.message || "Something went wrong!");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Group & Bank Master</h1>

      {loading && (
        <p className="text-center text-lg text-blue-600 font-bold">Saving...</p>
      )}

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

// --------------------------------------------------------
// GROUP MASTER FORM (FIXED VERSION)
// --------------------------------------------------------
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

  const govtOptions = ["Yes", "No"];
  const projectOptions = ["NRLM", "Other"];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitGroup = (e) => {
    e.preventDefault();
    onNext(form);
  };

  return (
    <form
      onSubmit={submitGroup}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 shadow rounded-xl"
    >
      <Input label="Group Name" name="group_name" value={form.group_name} handleChange={handleChange} />
      <Input label="Group Code" name="group_code" value={form.group_code} handleChange={handleChange} />
      <Input label="Cluster Name" name="cluster_name" value={form.cluster_name} handleChange={handleChange} />
      <Input label="Village" name="village" value={form.village} handleChange={handleChange} />

      <Input type="number" label="No. of Members" name="no_members" value={form.no_members} handleChange={handleChange} />
      <Input type="date" label="Formation Date" name="formation_date" value={form.formation_date} handleChange={handleChange} />

      <Input label="President Name" name="president_name" value={form.president_name} handleChange={handleChange} />
      <Input label="Secretary Name" name="secretary_name" value={form.secretary_name} handleChange={handleChange} />
      <Input label="Treasurer Name" name="treasurer_name" value={form.treasurer_name} handleChange={handleChange} />

      <Input label="Cluster" name="cluster" value={form.cluster} handleChange={handleChange} />
      <Input type="number" label="Saving Per Member" name="saving_per_member" value={form.saving_per_member} handleChange={handleChange} />

      <Input label="Membership Group" name="Mship_Group" value={form.Mship_Group} handleChange={handleChange} />
      <Input type="number" label="Membership Fees" name="membership_fees" value={form.membership_fees} handleChange={handleChange} />

      <Input label="Mitan Name" name="mitan_name" value={form.mitan_name} handleChange={handleChange} />
      <Input type="date" label="Meeting Date 1" name="meeting_date_1" value={form.meeting_date_1} handleChange={handleChange} />
      <Input type="date" label="Meeting Date 2" name="meeting_date_2" value={form.meeting_date_2} handleChange={handleChange} />

      <Input label="Sahyog Rashi" name="sahyog_rashi" value={form.sahyog_rashi} handleChange={handleChange} />
      <Input label="Share Capital" name="shar_capital" value={form.shar_capital} handleChange={handleChange} />
      <Input label="Other" name="other" value={form.other} handleChange={handleChange} />

      <Input label="Remark" name="remark" value={form.remark} handleChange={handleChange} />

      <Select label="Linked with Govt Project?" name="govt_linked" value={form.govt_linked} handleChange={handleChange} options={govtOptions} />

      {form.govt_linked === "Yes" && (
        <Select
          label="Project Type"
          name="govt_project_type"
          value={form.govt_project_type}
          handleChange={handleChange}
          options={projectOptions}
        />
      )}

      <div className="col-span-2 text-center mt-6">
        <button className="bg-blue-600 text-white font-bold px-8 py-3 rounded-lg">
          NEXT → Fill Bank Master
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------
// BANK MASTER FORM
// --------------------------------------------------------
function BankMasterForm({ onSubmitAll, onBack, defaultValues }) {
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
    ...defaultValues,
  });

  const govtOptions = ["Yes", "No"];
  const projectOptions = ["NRLM", "Other"];
  const accountTypes = ["Saving", "CC", "FD"];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitBank = (e) => {
    e.preventDefault();
    onSubmitAll(form);
  };

  return (
    <form
      onSubmit={submitBank}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 shadow rounded-xl"
    >
      <Input label="Bank Name" name="bank_name" value={form.bank_name} handleChange={handleChange} />
      <Input label="Account No." name="account_no" value={form.account_no} handleChange={handleChange} />
      <Input label="Branch Name" name="branch_name" value={form.branch_name} handleChange={handleChange} />
      <Input label="IFSC" name="ifsc" value={form.ifsc} handleChange={handleChange} />
      <Input label="Short Name" name="short_name" value={form.short_name} handleChange={handleChange} />
      <Input type="date" label="Account Open Date" name="ac_open_date" value={form.ac_open_date} handleChange={handleChange} />

      <Select label="Account Type" name="account_type" value={form.account_type} handleChange={handleChange} options={accountTypes} />

      <Input label="Opening Balance" name="opening_balance" value={form.opening_balance} handleChange={handleChange} />
      <Input label="Open Indicator" name="open_indicator" value={form.open_indicator} handleChange={handleChange} />

      <Input label="CC Limit" name="cc_limit" value={form.cc_limit} handleChange={handleChange} />
      <Input label="DP Limit" name="dp_limit" value={form.dp_limit} handleChange={handleChange} />

      <Input label="Open Balance Current" name="open_bal_curr" value={form.open_bal_curr} handleChange={handleChange} />
      <Input type="date" label="FD Maturity Date" name="fd_mat_dt" value={form.fd_mat_dt} handleChange={handleChange} />

      <Input label="Open Indicator Current" name="open_ind_curr" value={form.open_ind_curr} handleChange={handleChange} />
      <Input label="A/C Closed?" name="flg_acclosed" value={form.flg_acclosed} handleChange={handleChange} />
      <Input type="date" label="A/C Closed Date" name="acclosed_dt" value={form.acclosed_dt} handleChange={handleChange} />

      <Select label="Linked with Govt Project?" name="govt_linked" value={form.govt_linked} handleChange={handleChange} options={govtOptions} />

      {form.govt_linked === "Yes" && (
        <Select label="Project Type" name="govt_project_type" value={form.govt_project_type} handleChange={handleChange} options={projectOptions} />
      )}

      <div className="col-span-2 flex justify-center gap-6 mt-6">
        <button type="button" className="bg-gray-600 text-white font-bold px-8 py-3 rounded-lg" onClick={onBack}>
          ← PREVIOUS (Edit Group Master)
        </button>

        <button type="submit" className="bg-green-600 text-white font-bold px-8 py-3 rounded-lg">
          SUBMIT FINAL FORM
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------
// REUSABLE COMPONENTS
// --------------------------------------------------------
function Input({ label, name, value, handleChange, type = "text" }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={handleChange}
        className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
      />
    </div>
  );
}

function Select({ label, name, value, options, handleChange }) {
  return (
    <div className="flex flex-col">
      <label className="font-semibold mb-1">{label}</label>
      <select
        name={name}
        value={value || ""}
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
