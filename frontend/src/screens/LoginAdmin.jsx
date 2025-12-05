import React, { useState } from "react";
import { loginAdminService } from "../services/adminService";
import { Link } from "react-router-dom";

function LoginAdmin() {

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await loginAdminService(form);
      alert("Login Successful");

      // Save token in localStorage
      localStorage.setItem("adminToken", response.data.data.token);

      console.log("Login Response:", response.data);

    } catch (error) {
      alert(error.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">Admin Login</h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">

        <input
          type="email"
          name="email"
          placeholder="Enter Email"
          className="border p-2 rounded"
          value={form.email}
          onChange={handleChange}
        />

        <input
          type="password"
          name="password"
          placeholder="Enter Password"
          className="border p-2 rounded"
          value={form.password}
          onChange={handleChange}
        />

        <button className="bg-green-600 text-white p-2 rounded">
          Login
        </button>

      </form>

      <p className="mt-3">
        Don’t have an account?{" "}
        <Link to="/admin/register" className="text-blue-600 underline">
          Register here
        </Link>
      </p>
    </div>
  );
}

export default LoginAdmin;
