import React, { useState, useEffect } from "react";
import { Building2, LogIn, AlertCircle, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setGroupCredentials, selectIsGroupAuthenticated } from "../store/groupAuthSlice";
import { setSupervisorCredentials, selectIsSupervisorAuthenticated } from "../store/supervisorAuthSlice";
import { loginGroup } from "../services/groupAuthService";
import { loginSupervisor } from "../services/supervisorAuthService";

const TAB_GROUP = "group";
const TAB_SUPERVISOR = "supervisor";

export default function LoginGroup() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isGroupAuth = useSelector(selectIsGroupAuthenticated);
    const isSupervisorAuth = useSelector(selectIsSupervisorAuthenticated);
    const isAuthenticated = isGroupAuth || isSupervisorAuth;
    const [activeTab, setActiveTab] = useState(TAB_GROUP);
    const [form, setForm] = useState({
        groupCode: "",
        password: "",
        email: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Clear any stale error when landing on login page (e.g. after session expiry redirect)
    useEffect(() => {
        setError("");
    }, []);

    // Redirect if already authenticated (group or supervisor)
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/group", { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        setError("");
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setError("");
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await loginGroup(form.groupCode.trim(), form.password);
            if (response.success && response.data) {
                dispatch(setGroupCredentials({
                    token: response.data.token,
                    group: response.data.group,
                }));
                navigate("/group", { replace: true });
            } else {
                setError(response.message || "Login failed");
            }
        } catch (err) {
            setError(err.message || "Invalid group code or password");
        } finally {
            setLoading(false);
        }
    };

    const handleSupervisorSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await loginSupervisor(form.email.trim(), form.password);
            if (response.success && response.data) {
                dispatch(setSupervisorCredentials({
                    token: response.data.token,
                    supervisor: response.data.supervisor,
                }));
                navigate("/group", { replace: true });
            } else {
                setError(response.message || "Login failed");
            }
        } catch (err) {
            setError(err.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-4">
                        <div className="bg-blue-100 rounded-full p-4">
                            <Building2 size={48} className="text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Group Panel Login</h1>
                    <p className="text-gray-600 text-sm">Sign in as Group or Supervisor</p>
                </div>

                {/* Tabs: Group | Supervisor */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        type="button"
                        onClick={() => handleTabChange(TAB_GROUP)}
                        className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                            activeTab === TAB_GROUP
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <Building2 size={18} />
                        Group
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange(TAB_SUPERVISOR)}
                        className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                            activeTab === TAB_SUPERVISOR
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <UserCheck size={18} />
                        Supervisor
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle size={20} className="text-red-600 shrink-0" />
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                {activeTab === TAB_GROUP ? (
                    <form onSubmit={handleGroupSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Group Code *</label>
                            <input
                                type="text"
                                name="groupCode"
                                value={form.groupCode}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter group code"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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
                ) : (
                    <form onSubmit={handleSupervisorSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your email"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Login as Supervisor
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">Need help? Contact your administrator</p>
                </div>
            </div>
        </div>
    );
}

