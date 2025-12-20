import React, { useState } from "react";
import LoanStep1Account from "../components/loans/LoanStep1Account"
import LoanStep2Source from "../components/loans/LoanStep2Source";
import LoanStep3Purpose from "../components/loans/LoanStep3Purpose";
import LoanStep4Amount from "../components/loans/LoanStep4Amount";
import LoanStep5File from "../components/loans/LoanStep5File";

const LoanProviding = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    accountType: "",
    source: "",
    purpose: "",
    amount: "",
    file: null,
  });

  const next = () => step < 5 && setStep(step + 1);
  const prev = () => step > 1 && setStep(step - 1);

  const handleSubmit = () => {
    alert("Loan request submitted successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-6">

        {/* Header */}
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-600">
          Loan Providing Module
        </h1>

        {/* Steps */}
        <div className="mb-6 flex justify-between text-sm font-semibold">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 flex items-center justify-center rounded-full 
              ${step === s ? "bg-blue-600 text-white" : "bg-gray-300"}`}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Step Components */}
        {step === 1 && <LoanStep1Account form={form} setForm={setForm} />}
        {step === 2 && <LoanStep2Source form={form} setForm={setForm} />}
        {step === 3 && <LoanStep3Purpose form={form} setForm={setForm} />}
        {step === 4 && <LoanStep4Amount form={form} setForm={setForm} />}
        {step === 5 && <LoanStep5File form={form} setForm={setForm} />}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={prev}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Previous
            </button>
          ) : (
            <div></div>
          )}

          {step < 5 ? (
            <button
              onClick={next}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanProviding;
 