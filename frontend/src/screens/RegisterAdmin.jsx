import React, { useState } from "react";
import { registerAdminService } from "../services/adminService";
import { Link, useNavigate, useLocation } from "react-router-dom";

function RegisterAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAddPlace = location.pathname.includes("add-place");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    place: ""
  });
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
        password: form.password,
        place: form.place
      });

      if (isAddPlace) {
        setMessage("✅ Place added successfully.");
        setForm({ name: "", email: "", password: "", confirmPassword: "", place: "" });
        setTimeout(() => navigate("/admin/dashboard"), 1500);
      } else {
        setMessage("✅ Registered Successfully!");
        localStorage.setItem("token", response.data.token);
        alert("Login Successful");
        navigate("/");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "❌ Registration Failed");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-8 border rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">{isAddPlace ? "Add new place" : "Register Admin"}</h2>

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
          type="text"
          name="place"
          placeholder="Place/Location (Unique)"
          value={form.place}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />
        <p className="text-xs text-gray-500 -mt-2">Each place can only have one admin</p>

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
          {isAddPlace ? "Add new place" : "Register Admin"}
        </button>

        {isAddPlace ? (
          <p className="text-sm mt-2">
            <Link to="/admin/dashboard" className="text-blue-600 underline">
              Back to dashboard
            </Link>
          </p>
        ) : (
          <p className="text-sm mt-2">
            Already have an account?{" "}
            <Link to="/login-admin" className="text-blue-600 underline">
              Login here
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

export default RegisterAdmin;
