import React, { useState } from "react";

function DemandRecovery() {
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [recoveryData, setRecoveryData] = useState([]);

  const allMembers = [
    {
      id: 1,
      code: "M001",
      name: "Rahul Patel",
      village: "Rewa",
      groupCode: "G1001",
      groupName: "Navjyoti SHG",
      date: "2025-02-18",
      summary: {
        saving: { prev: 300, curr: 200, actual: 100, opening: 35000 },
        loan: { prev: 4000, curr: 2000, actual: 1500, opening: 40000 },
        fd: { prev: "-", curr: "-", actual: 1000, opening: 3000 },
        interest: { prev: 800, curr: 1200, actual: 1200, opening: 0 },
        other: { prev: 0, curr: 0, actual: 0, opening: 0 },
      },
    },
    {
      id: 2,
      code: "M002",
      name: "Sita Devi",
      village: "Satna",
      groupCode: "G1001",
      groupName: "Navjyoti SHG",
      date: "2025-02-18",
      summary: {
        saving: { prev: 200, curr: 150, actual: 100, opening: 20000 },
        loan: { prev: 2000, curr: 500, actual: 500, opening: 15000 },
        fd: { prev: "-", curr: "-", actual: 500, opening: 1000 },
        interest: { prev: 200, curr: 300, actual: 200, opening: 0 },
        other: { prev: 0, curr: 0, actual: 0, opening: 0 },
      },
    },
  ];

  const current = allMembers[index];

  const [form, setForm] = useState({
    saving: "",
    loan: "",
    fd: "",
    interest: "",
    other: "",
    mode: "cash", // cash OR online
  });

  // -----------------------
  // SEARCH MEMBER
  // -----------------------
  const handleSearch = () => {
    const found = allMembers.findIndex(
      (x) =>
        x.code.toLowerCase() === search.toLowerCase() ||
        x.name.toLowerCase() === search.toLowerCase()
    );

    if (found === -1) {
      setError("Member not found!");
      return;
    }

    setIndex(found);
    setStep(2);
    setError("");
  };

  // -----------------------
  // SAVE CURRENT MEMBER RECOVERY
  // -----------------------
  const saveRecovery = () => {
    const updated = [...recoveryData];
    updated[index] = {
      memberId: current.id,
      ...form,
    };

    setRecoveryData(updated);

    if (index < allMembers.length - 1) {
      setIndex(index + 1);
      setForm({
        saving: "",
        loan: "",
        fd: "",
        interest: "",
        other: "",
        mode: "cash",
      });
    } else {
      setStep(3); // final submit
    }
  };

  // -----------------------
  // FINAL TOTAL CALCULATION
  // -----------------------
  const totalCash = recoveryData
    .filter((x) => x?.mode === "cash")
    .reduce(
      (sum, x) =>
        sum +
        (Number(x.saving) +
          Number(x.loan) +
          Number(x.fd) +
          Number(x.interest) +
          Number(x.other)),
      0
    );

  const totalOnline = recoveryData
    .filter((x) => x?.mode === "online")
    .reduce(
      (sum, x) =>
        sum +
        (Number(x.saving) +
          Number(x.loan) +
          Number(x.fd) +
          Number(x.interest) +
          Number(x.other)),
      0
    );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Demand Recovery</h2>

      {/* STEP 1 — SEARCH */}
      {step === 1 && (
        <div style={styles.card}>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter Member Code or Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={styles.btn} onClick={handleSearch}>
            Search
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      )}

      {/* STEP 2 — SUMMARY + FORM */}
      {step === 2 && (
        <div style={styles.card}>
          <h3>{current.name}</h3>
          <p>Village: {current.village}</p>
          <p>Group: {current.groupName}</p>
          <p>Date: {current.date}</p>

          <h4 style={{ marginTop: 15 }}>Summary</h4>

          <table style={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Prev</th>
                <th>Current</th>
                <th>Actual</th>
                <th>Opening</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(current.summary).map((key) => (
                <tr key={key}>
                  <td>{key.toUpperCase()}</td>
                  <td>{current.summary[key].prev}</td>
                  <td>{current.summary[key].curr}</td>
                  <td>{current.summary[key].actual}</td>
                  <td>{current.summary[key].opening}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{ marginTop: 15 }}>Enter Recovery</h4>

          <input
            style={styles.input}
            placeholder="Saving"
            value={form.saving}
            onChange={(e) => setForm({ ...form, saving: e.target.value })}
          />
          <input
            style={styles.input}
            placeholder="Loan"
            value={form.loan}
            onChange={(e) => setForm({ ...form, loan: e.target.value })}
          />
          <input
            style={styles.input}
            placeholder="FD"
            value={form.fd}
            onChange={(e) => setForm({ ...form, fd: e.target.value })}
          />
          <input
            style={styles.input}
            placeholder="Interest"
            value={form.interest}
            onChange={(e) => setForm({ ...form, interest: e.target.value })}
          />
          <input
            style={styles.input}
            placeholder="Other"
            value={form.other}
            onChange={(e) => setForm({ ...form, other: e.target.value })}
          />

          <select
            style={styles.input}
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
          >
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>

          <div style={{ marginTop: 10 }}>
            {index > 0 && (
              <button style={styles.prevBtn} onClick={() => setIndex(index - 1)}>
                Previous
              </button>
            )}

            <button style={styles.btn} onClick={saveRecovery}>
              {index === allMembers.length - 1 ? "Submit" : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — FINAL */}
      {step === 3 && (
        <div style={styles.card}>
          <h2>Final Summary</h2>

          <h3>Total Cash: ₹{totalCash}</h3>
          <h3>Total Online: ₹{totalOnline}</h3>

          <button style={styles.submitBtn}>FINAL SUBMIT</button>

          <h4 style={{ marginTop: 20 }}>Reports</h4>
          <button style={styles.reportBtn}>User Report</button>
          <button style={styles.reportBtn}>Admin Report</button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// CSS
// ----------------------------------------------------
const styles = {
  container: { padding: 20, maxWidth: 700, margin: "auto" },
  title: { textAlign: "center", marginBottom: 20 },
  card: {
    padding: 20,
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0px 2px 8px rgba(0,0,0,0.15)",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 10,
    margin: "8px 0",
    border: "1px solid #ccc",
    borderRadius: 6,
  },
  btn: {
    padding: "10px 20px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginLeft: 5,
  },
  prevBtn: {
    padding: "10px 20px",
    background: "gray",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginRight: 5,
  },
  submitBtn: {
    padding: "12px 25px",
    background: "green",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginTop: 10,
  },
  reportBtn: {
    padding: "10px 20px",
    background: "orange",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginRight: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 10,
  },
};

export default DemandRecovery;
