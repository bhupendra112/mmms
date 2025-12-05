const LoanStep1Account = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Step 1: Select Account Type</h2>

      <select
        className="w-full border p-3 rounded-lg"
        value={form.accountType}
        onChange={(e) =>
          setForm({ ...form, accountType: e.target.value })
        }
      >
        <option value="">Select Account</option>
        <option value="Deposit in Bank">Deposit in Bank</option>
        <option value="Loan">Loan</option>
        <option value="Saving">Saving</option>
        <option value="FD">FD</option>
        <option value="Group Expenses">Group Expenses</option>
      </select>
    </div>
  );
};

export default LoanStep1Account;
