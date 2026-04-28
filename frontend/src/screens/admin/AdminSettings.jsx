import React, { useState, useEffect } from "react";
import {
    Settings,
    User,
    Shield,
    Database,
    Lock,
    Save,
    Eye,
    EyeOff,
} from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";
import {
    getAdminProfile,
    updateAdminProfile,
    changePassword,
    getAdminSettings,
    updateAdminSettings,
} from "../../services/adminService";
import { useAdmin } from "../../contexts/AdminContext";
import DataManagement from "../../pages/settings/DataManagement";

export default function AdminSettings() {
    const { admin: contextAdmin, refreshProfile } = useAdmin();
    const [activeTab, setActiveTab] = useState("profile");
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Profile Settings
    const [profile, setProfile] = useState({
        name: "",
        email: "",
        phone: "",
        designation: "",
        organization: "",
    });

    // Security Settings
    const [security, setSecurity] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        twoFactorAuth: false,
        sessionTimeout: "30",
    });

    // Load profile and settings on mount
    useEffect(() => {
        loadProfileAndSettings();
    }, []);

    const loadProfileAndSettings = async () => {
        try {
            setLoading(true);
            setError("");

            // Load profile
            const profileRes = await getAdminProfile();
            if (profileRes.success && profileRes.data) {
                setProfile({
                    name: profileRes.data.name || "",
                    email: profileRes.data.email || "",
                    phone: profileRes.data.phone || "",
                    designation: profileRes.data.designation || "",
                    organization: profileRes.data.organization || "",
                });
            }

            // Load settings
            const settingsRes = await getAdminSettings();
            if (settingsRes.success && settingsRes.data) {
                setSecurity((prev) => ({
                    ...prev,
                    twoFactorAuth: settingsRes.data.twoFactorAuth || false,
                    sessionTimeout: String(settingsRes.data.sessionTimeout || 30),
                }));
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load profile and settings");
        } finally {
            setLoading(false);
        }
    };

    // Handle Profile Update
    const handleProfileUpdate = async () => {
        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const res = await updateAdminProfile(profile);
            if (res.success) {
                setSuccess("Profile updated successfully!");
                // Update Redux store with new profile data
                refreshProfile(res.data);
                // Reload profile to get latest data
                await loadProfileAndSettings();
            } else {
                setError(res.message || "Failed to update profile");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    // Handle Security Update (Password Change)
    const handleSecurityUpdate = async () => {
        if (!security.currentPassword || !security.newPassword) {
            setError("Current password and new password are required");
            return;
        }

        if (security.newPassword !== security.confirmPassword) {
            setError("New password and confirm password do not match!");
            return;
        }

        if (security.newPassword.length < 6) {
            setError("Password must be at least 6 characters long!");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const res = await changePassword({
                currentPassword: security.currentPassword,
                newPassword: security.newPassword,
            });

            if (res.success) {
                setSuccess("Password changed successfully!");
                setSecurity({
                    ...security,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                });
            } else {
                setError(res.message || "Failed to change password");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to change password");
        } finally {
            setSaving(false);
        }
    };

    // Handle Settings Update
    const handleSettingsUpdate = async () => {
        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const res = await updateAdminSettings({
                twoFactorAuth: security.twoFactorAuth,
                sessionTimeout: parseInt(security.sessionTimeout),
            });

            if (res.success) {
                setSuccess("Settings updated successfully!");
            } else {
                setError(res.message || "Failed to update settings");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update settings");
        } finally {
            setSaving(false);
        }
    };


    const tabs = [
        { id: "profile", label: "Profile", icon: User },
        { id: "security", label: "Security", icon: Shield },
        { id: "data", label: "Data Management", icon: Database },
    ];

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-600">Loading settings...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Settings size={32} />
                    Settings
                </h1>
                <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700">{error}</p>
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700">{success}</p>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <div className="flex overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                                        ? "text-blue-600 border-b-2 border-blue-600"
                                        : "text-gray-600 hover:text-gray-800"
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {/* Profile Tab */}
                    {activeTab === "profile" && (
                        <div>
                            <FormSection title="Profile Information">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Full Name"
                                        name="name"
                                        value={profile.name}
                                        handleChange={(e) =>
                                            setProfile({ ...profile, name: e.target.value })
                                        }
                                        required
                                    />
                                    <Input
                                        label="Email"
                                        name="email"
                                        type="email"
                                        value={profile.email}
                                        handleChange={(e) =>
                                            setProfile({ ...profile, email: e.target.value })
                                        }
                                        required
                                        disabled
                                        className="bg-gray-100"
                                    />
                                    <p className="text-xs text-gray-500 -mt-4">Email cannot be changed</p>
                                    <Input
                                        label="Phone Number"
                                        name="phone"
                                        value={profile.phone}
                                        handleChange={(e) =>
                                            setProfile({ ...profile, phone: e.target.value })
                                        }
                                        required
                                    />
                                    <Input
                                        label="Designation"
                                        name="designation"
                                        value={profile.designation}
                                        handleChange={(e) =>
                                            setProfile({ ...profile, designation: e.target.value })
                                        }
                                        required
                                    />
                                    <div className="md:col-span-2">
                                        <Input
                                            label="Organization"
                                            name="organization"
                                            value={profile.organization}
                                            handleChange={(e) =>
                                                setProfile({ ...profile, organization: e.target.value })
                                            }
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end mt-6">
                                    <button
                                        onClick={handleProfileUpdate}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </FormSection>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === "security" && (
                        <div>
                            <FormSection title="Security Settings">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Current Password *
                                        </label>
                                        <p className="text-xs text-gray-500 mb-2">Required to change password</p>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={security.currentPassword}
                                                onChange={(e) =>
                                                    setSecurity({ ...security, currentPassword: e.target.value })
                                                }
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                placeholder="Enter current password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            New Password
                                        </label>
                                        <p className="text-xs text-gray-500 mb-2">Minimum 6 characters</p>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={security.newPassword}
                                                onChange={(e) =>
                                                    setSecurity({ ...security, newPassword: e.target.value })
                                                }
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                placeholder="Enter new password (min 8 characters)"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={security.confirmPassword}
                                                onChange={(e) =>
                                                    setSecurity({ ...security, confirmPassword: e.target.value })
                                                }
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                        <div>
                                            <p className="font-semibold text-gray-800">Two-Factor Authentication</p>
                                            <p className="text-sm text-gray-600">Add an extra layer of security</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={security.twoFactorAuth}
                                                onChange={(e) =>
                                                    setSecurity({ ...security, twoFactorAuth: e.target.checked })
                                                }
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div>
                                        <Select
                                            label="Session Timeout (minutes)"
                                            name="sessionTimeout"
                                            value={security.sessionTimeout}
                                            handleChange={(e) =>
                                                setSecurity({ ...security, sessionTimeout: e.target.value })
                                            }
                                            options={[
                                                { value: "15", label: "15 minutes" },
                                                { value: "30", label: "30 minutes" },
                                                { value: "60", label: "1 hour" },
                                                { value: "120", label: "2 hours" },
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-6">
                                    <button
                                        onClick={handleSettingsUpdate}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold shadow-md disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {saving ? "Saving..." : "Save Settings"}
                                    </button>
                                    <button
                                        onClick={handleSecurityUpdate}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50"
                                    >
                                        <Lock size={18} />
                                        {saving ? "Changing..." : "Change Password"}
                                    </button>
                                </div>
                            </FormSection>
                        </div>
                    )}

                    {/* Data Management Tab */}
                    {activeTab === "data" && (
                        <DataManagement setError={setError} setSuccess={setSuccess} />
                    )}
                </div>
            </div>
        </div>
    );
}

