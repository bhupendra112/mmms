import React, { useState } from "react";
import {
    Settings,
    User,
    Shield,
    Database,
    Lock,
    Save,
    Eye,
    EyeOff,
    Download,
    Upload,
    Trash2,
} from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";

export default function AdminSettings() {
    const [activeTab, setActiveTab] = useState("profile");
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    // Profile Settings
    const [profile, setProfile] = useState({
        name: "Admin User",
        email: "admin@samooh.com",
        phone: "+91 9876543210",
        designation: "Administrator",
        organization: "Village Samooh Management",
    });

    // Security Settings
    const [security, setSecurity] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        twoFactorAuth: false,
        sessionTimeout: "30",
    });

    // Handle Profile Update
    const handleProfileUpdate = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        alert("Profile updated successfully!");
        setSaving(false);
    };

    // Handle Security Update
    const handleSecurityUpdate = async () => {
        if (security.newPassword && security.newPassword !== security.confirmPassword) {
            alert("New password and confirm password do not match!");
            return;
        }
        if (security.newPassword && security.newPassword.length < 8) {
            alert("Password must be at least 8 characters long!");
            return;
        }
        setSaving(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        alert("Security settings updated successfully!");
        setSecurity({
            ...security,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
        setSaving(false);
    };

    // Handle Data Export
    const handleExportData = () => {
        alert("Data export feature will be implemented soon!");
    };

    // Handle Data Import
    const handleImportData = () => {
        alert("Data import feature will be implemented soon!");
    };

    // Handle Data Backup
    const handleBackupData = () => {
        alert("Data backup feature will be implemented soon!");
    };

    const tabs = [
        { id: "profile", label: "Profile", icon: User },
        { id: "security", label: "Security", icon: Shield },
        { id: "data", label: "Data Management", icon: Database },
    ];

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Settings size={32} />
                    Settings
                </h1>
                <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
            </div>

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
                                    />
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
                                <div className="flex justify-end mt-6">
                                    <button
                                        onClick={handleSecurityUpdate}
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

                    {/* Data Management Tab */}
                    {activeTab === "data" && (
                        <div>
                            <FormSection title="Data Management">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <button
                                            onClick={handleExportData}
                                            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                        >
                                            <Download className="text-blue-600" size={32} />
                                            <span className="font-semibold text-gray-800">Export Data</span>
                                            <span className="text-sm text-gray-600 text-center">
                                                Export all data to Excel/CSV
                                            </span>
                                        </button>
                                        <button
                                            onClick={handleImportData}
                                            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                        >
                                            <Upload className="text-green-600" size={32} />
                                            <span className="font-semibold text-gray-800">Import Data</span>
                                            <span className="text-sm text-gray-600 text-center">
                                                Import data from Excel/CSV
                                            </span>
                                        </button>
                                        <button
                                            onClick={handleBackupData}
                                            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                        >
                                            <Database className="text-purple-600" size={32} />
                                            <span className="font-semibold text-gray-800">Backup Data</span>
                                            <span className="text-sm text-gray-600 text-center">
                                                Create a backup of all data
                                            </span>
                                        </button>
                                    </div>
                                    <div className="border-t border-gray-200 pt-6">
                                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Trash2 className="text-red-600" size={20} />
                                                <p className="font-semibold text-red-800">Danger Zone</p>
                                            </div>
                                            <p className="text-sm text-red-700 mb-4">
                                                Permanently delete all data. This action cannot be undone.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            "Are you sure you want to delete all data? This action cannot be undone!"
                                                        )
                                                    ) {
                                                        alert("Data deletion feature will be implemented soon!");
                                                    }
                                                }}
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                            >
                                                Delete All Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </FormSection>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

