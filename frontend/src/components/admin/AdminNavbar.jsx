import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
    Bell,
    User,
    Menu,
    Search,
    X,
    LayoutGrid,
    Building2,
    Users,
    Settings,
    Banknote,
    PlusCircle,
    DollarSign,
    CheckCircle,
    LogOut,
} from "lucide-react";
import { useAdmin } from "../../contexts/AdminContext";

// Logout Button Component
function LogoutButton() {
    const { logout } = useAdmin();

    return (
        <button
            onClick={() => {
                if (window.confirm("Are you sure you want to logout?")) {
                    logout();
                }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-gray-300 hover:bg-gray-800 hover:text-red-400"
        >
            <LogOut size={18} />
            <span>Logout</span>
        </button>
    );
}

export default function AdminNavbar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const menuItems = [
        {
            section: "Dashboard",
            items: [{ icon: LayoutGrid, label: "Dashboard", path: "/admin" }],
        },
        {
            section: "Village Samooh Management",
            items: [
                {
                    icon: Building2,
                    label: "Group Management",
                    path: "/admin/group-management",
                    description: "Manage all groups, members, bank & finance"
                },
                {
                    icon: Banknote,
                    label: "Bank for Group",
                    path: "/admin/bank-details",
                    description: "Fill bank details for groups"
                },
                {
                    icon: PlusCircle,
                    label: "Create Group",
                    path: "/admin/create-group",
                    description: "Create new village samooh group"
                },
                {
                    icon: Users,
                    label: "Members",
                    path: "/admin/members",
                    description: "Manage group members"
                },
                {
                    icon: DollarSign,
                    label: "Demand Recovery",
                    path: "/admin/demand-recovery",
                    description: "Manage member recovery and finance"
                },
                {
                    icon: DollarSign,
                    label: "Loan Management",
                    path: "/admin/loan-management",
                    description: "Manage loan transactions"
                },
                {
                    icon: CheckCircle,
                    label: "Approvals",
                    path: "/admin/approvals",
                    description: "Manage approval requests"
                },
            ],
        },
    ];

    const closeMobileSidebar = () => {
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* ---------------- Sidebar ---------------- */}
            <aside
                className={`
          fixed top-0 left-0 z-40 h-full w-64 bg-[#0b1623] text-white
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
            >
                {/* Brand Header */}
                <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
                    <div className="bg-blue-600 w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold">
                        AS
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Samooh</h1>
                        <p className="text-gray-400 text-sm">Admin Panel</p>
                    </div>
                </div>

                {/* Navigation */}
                <div className="p-5 overflow-y-auto">
                    {menuItems.map((section, idx) => (
                        <div key={idx} className="mb-6">
                            <h3 className="text-gray-400 text-xs font-semibold uppercase mb-2">
                                {section.section}
                            </h3>
                            <ul className="space-y-2">
                                {section.items.map(({ icon: Icon, label, path, description }, i) => {
                                    const active = location.pathname === path;
                                    return (
                                        <li key={i}>
                                            <Link
                                                to={path}
                                                onClick={closeMobileSidebar}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active
                                                    ? "bg-blue-600 text-white"
                                                    : "text-gray-300 hover:bg-gray-800"
                                                    }`}
                                                title={description}
                                            >
                                                <Icon size={18} />
                                                <span>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-800 p-4 space-y-2">
                    <Link
                        to="/admin/settings"
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${location.pathname === "/admin/settings"
                            ? "bg-blue-600 text-white"
                            : "text-gray-300 hover:bg-gray-800"
                            }`}
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </Link>
                    <LogoutButton />
                </div>
            </aside>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ---------------- Main Layout ---------------- */}
            <div className="flex-1 flex flex-col lg:ml-64 transition-all duration-300">
                {/* Top Navbar */}
                <nav className="fixed top-0 left-0 lg:left-64 right-0 z-20 bg-white border-b shadow-sm">
                    <div className="h-14 px-4 flex items-center justify-between">
                        {/* Mobile Toggle Button */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden text-gray-700 hover:text-gray-900"
                        >
                            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>

                        {/* Search Bar */}
                        <div className="hidden sm:block w-full max-w-xl mx-auto">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search groups, members..."
                                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md 
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Right Icons */}
                        <div className="flex items-center space-x-9">
                            <div className="relative cursor-pointer">
                                <Bell size={22} className="text-gray-700 hover:text-gray-900" />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                                    3
                                </span>
                            </div>
                            <User size={22} className="text-gray-700 hover:text-gray-900 cursor-pointer" />
                        </div>
                    </div>
                </nav>

                {/* ---------------- Main Content ---------------- */}
                <main className="pt-16 p-4 min-h-screen bg-[#f8fbff]">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

