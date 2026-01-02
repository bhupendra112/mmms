import React, { useState } from "react";
import { createGroup, createBank } from "../services/groupService";
import Loader, { OverlayLoader } from "../components/common/Loader";
import ErrorMessage from "../components/common/ErrorMessage";
import { useApiCall } from "../hooks/useApiCall";

// --------------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------------
export default function GroupBankMaster() {
  const [step, setStep] = useState(1);
  const [groupData, setGroupData] = useState({});
  const [bankData, setBankData] = useState({});

  const { loading, error, execute, clearError } = useApiCall({
    defaultErrorMessage: "Failed to save group and bank details. Please try again.",
  });

  const finalSubmit = async (bankForm) => {
    const result = await execute(async () => {
      // STEP 1: STORE GROUP
      const groupRes = await createGroup(groupData);
      const groupId = groupRes?.data?._id;
      
      if (!groupId) {
        throw new Error("Group created but no ID returned");
      }

      // STEP 2: STORE BANK (with group_id)
      const bankPayload = {
        ...bankForm,
        group_id: groupId,
        // Set open_bal_curr to same value as opening_balance (they are the same)
        open_bal_curr: bankForm.opening_balance || bankForm.open_bal_curr || null,
        // Set open_ind_curr to same value as open_indicator (they are the same)
        open_ind_curr: bankForm.open_indicator || bankForm.open_ind_curr || null,
      };

      await createBank(bankPayload);
      return { groupId };
    });

    if (result.success) {
      alert("Group & Bank Saved Successfully!");
      setStep(1);
      setGroupData({});
      setBankData({});
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Group & Bank Master</h1>

      {error && error.shouldShow && (
        <div className="mb-6">
          <ErrorMessage error={error} onDismiss={clearError} />
        </div>
      )}

      <div className="relative">
        <OverlayLoader loading={loading} message="Saving group and bank details..." />
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

      <Input type="number" label="Saving Per Member" name="saving_per_member" value={form.saving_per_member} handleChange={handleChange} />

      <Input label="Membership Group" name="Mship_Group" value={form.Mship_Group} handleChange={handleChange} />
      <Input type="number" label="Membership Fees" name="membership_fees" value={form.membership_fees} handleChange={handleChange} />

      <Input label="Mitan Name" name="mitan_name" value={form.mitan_name} handleChange={handleChange} />

      <div className="flex flex-col">
        <label className="font-semibold mb-1">Meeting Date 1 - Day</label>
        <input
          type="number"
          name="meeting_date_1_day"
          value={form.meeting_date_1_day || ""}
          onChange={handleChange}
          min="1"
          max="31"
          placeholder="Day (1-31)"
          className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Meeting Date 1 - Time</label>
        <input
          type="time"
          name="meeting_date_1_time"
          value={form.meeting_date_1_time || ""}
          onChange={handleChange}
          className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
        />
      </div>

      <div className="flex flex-col">
        <label className="font-semibold mb-1">Meeting Date 2 - Day</label>
        <input
          type="number"
          name="meeting_date_2_day"
          value={form.meeting_date_2_day || ""}
          onChange={handleChange}
          min="1"
          max="31"
          placeholder="Day (1-31)"
          className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Meeting Date 2 - Time</label>
        <input
          type="time"
          name="meeting_date_2_time"
          value={form.meeting_date_2_time || ""}
          onChange={handleChange}
          className="border p-2 rounded-lg focus:ring-2 ring-blue-400"
        />
      </div>

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
      <Input type="date" label="FD Maturity Date" name="fd_mat_dt" value={form.fd_mat_dt} handleChange={handleChange} />
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
