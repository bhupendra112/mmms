import React, { useState, useEffect } from "react";
import { Building2, LogIn, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setGroupCredentials, selectIsGroupAuthenticated } from "../store/groupAuthSlice";
import { loginGroup } from "../services/groupAuthService";

export default function LoginGroup() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isAuthenticated = useSelector(selectIsGroupAuthenticated);
    const [form, setForm] = useState({
        groupName: "",
        groupIdOrCode: "",
        isCode: false, // false = ID, true = Code
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/group", { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({
            ...form,
            [name]: type === "checkbox" ? checked : value,
        });
        setError(""); // Clear error on change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await loginGroup(
                form.groupName.trim(),
                form.groupIdOrCode.trim(),
                form.isCode
            );

            if (response.success && response.data) {
                // Store token and group data in Redux
                dispatch(setGroupCredentials({
                    token: response.data.token,
                    group: response.data.group
                }));
                
                // Redirect to group dashboard
                navigate("/group", { replace: true });
            } else {
                setError(response.message || "Login failed");
            }
        } catch (err) {
            setError(err.message || "Invalid group name or ID/Code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-blue-100 rounded-full p-4">
                            <Building2 size={48} className="text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Group Login</h1>
                    <p className="text-gray-600">Enter your group name and ID/Code to access</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle size={20} className="text-red-600" />
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Group Name *
                        </label>
                        <input
                            type="text"
                            name="groupName"
                            value={form.groupName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter group name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Group ID or Code *
                        </label>
                        <input
                            type="text"
                            name="groupIdOrCode"
                            value={form.groupIdOrCode}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter group ID or code"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="isCode"
                            checked={form.isCode}
                            onChange={handleChange}
                            id="isCode"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="isCode" className="text-sm text-gray-700">
                            I'm entering a Group Code (not ID)
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Logging in...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Login
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        Need help? Contact your administrator
                    </p>
                </div>
            </div>
        </div>
    );
}

