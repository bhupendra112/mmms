import React, { useState } from "react";
import { registerAdminService } from "../services/adminService";
import { Link , useNavigate} from "react-router-dom";

function RegisterAdmin() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
const navigate = useNavigate();
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setMessage("❌ Password & Confirm Password must match");
      return;
    }

    try {
      const response = await registerAdminService({
        name: form.name,
        email: form.email,
        password: form.password
      });

      setMessage("✅ Registered Successfully!");

      localStorage.setItem("token", response.data.token);

      alert("Login Successful");
      navigate("/");
    } catch (error) {
      setMessage(error.response?.data?.message || "❌ Registration Failed");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-8 border rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Register Admin</h2>

      {message && <p className="mb-3 text-red-600">{message}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={form.email}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Register Admin
        </button>

        <p className="text-sm mt-2">
          Already have an account?{" "}
          <Link to="/login-admin" className="text-blue-600 underline">
            Login here
          </Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterAdmin;
