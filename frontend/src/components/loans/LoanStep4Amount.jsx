const LoanStep4Amount = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Step 4: Enter Loan Amount</h2>

      <input
        type="number"
        className="w-full border p-3 rounded-lg"
        placeholder="Enter amount"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />
    </div>
  );
};

export default LoanStep4Amount;
 