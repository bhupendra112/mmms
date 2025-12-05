const LoanStep3Purpose = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Step 3: Select Purpose for Taking Loan
      </h2>

      <input
        type="text"
        className="w-full border p-3 rounded-lg"
        placeholder="Enter loan purpose"
        value={form.purpose}
        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
      />
    </div>
  );
};

export default LoanStep3Purpose;
