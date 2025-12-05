const LoanStep2Source = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Step 2: Select Source (Bank or Cash)
      </h2>

      <select
        className="w-full border p-3 rounded-lg"
        value={form.source}
        onChange={(e) =>
          setForm({ ...form, source: e.target.value })
        }
      >
        <option value="">Select Source</option>
        <option value="Bank">Bank</option>
        <option value="Cash">Cash</option>
      </select>
    </div>
  );
};

export default LoanStep2Source;
 