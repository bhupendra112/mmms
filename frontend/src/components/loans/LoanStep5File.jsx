const LoanStep5File = ({ form, setForm }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Step 5: Upload File (Optional)</h2>

      <input
        type="file"
        className="w-full border p-3 rounded-lg"
        onChange={(e) => setForm({ ...form, file: e.target.files[0] })}
      />

      {form.file && (
        <p className="mt-2 text-green-600 text-sm">
          File Selected: {form.file.name}
        </p>
      )}
    </div>
  );
};

export default LoanStep5File;
