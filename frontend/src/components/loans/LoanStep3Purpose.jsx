import { LoanPurposeInput } from "../forms/LoanPurposeInput";

const LoanStep3Purpose = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Step 3: Select Purpose for Taking Loan
      </h2>

      <LoanPurposeInput
        label="Purpose"
        name="purpose"
        value={form.purpose}
        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
        placeholder="Search or type purpose of loan"
      />
    </div>
  );
};

export default LoanStep3Purpose;
