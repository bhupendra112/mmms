import React, { useState, useEffect } from "react";
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
    CreditCard,
    Receipt,
    FileText,
    ArrowLeftRight,
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

    // Close sidebar on ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape" && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [sidebarOpen]);

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
                {
                    icon: CreditCard,
                    label: "Payments",
                    path: "/admin/payments",
                    description: "Process FD maturity and savings withdrawal payments"
                },
                {
                    icon: Receipt,
                    label: "Expenses",
                    path: "/admin/expenses",
                    description: "Manage group expenses (Stationery, Travel, etc.)"
                },
                {
                    icon: FileText,
                    label: "Financial Reports",
                    path: "/admin/financial-reports",
                    description: "View Receipt & Payment, Income & Expense, and Balance Sheet reports"
                },
                {
                    icon: ArrowLeftRight,
                    label: "Conversion",
                    path: "/admin/cash-to-bank",
                    description: "Convert cash to bank or transfer between bank accounts"
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
          fixed inset-y-0 left-0 z-40 w-64 max-w-[85%] bg-[#0b1623] text-white
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:max-w-none
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
                <div className="flex-1 overflow-y-auto p-3 md:p-5">
                    {menuItems.map((section, idx) => (
                        <div key={idx} className="mb-4 md:mb-6">
                            <h3 className="text-gray-400 text-xs font-semibold uppercase mb-2 px-2">
                                {section.section}
                            </h3>
                            <ul className="space-y-1 md:space-y-2">
                                {section.items.map(({ icon: Icon, label, path, description }, i) => {
                                    const active = location.pathname === path;
                                    return (
                                        <li key={i}>
                                            <Link
                                                to={path}
                                                onClick={closeMobileSidebar}
                                                className={`flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm transition-colors ${active
                                                    ? "bg-blue-600 text-white"
                                                    : "text-gray-300 hover:bg-gray-800"
                                                    }`}
                                                title={description}
                                            >
                                                <Icon size={16} className="shrink-0" />
                                                <span className="truncate">{label}</span>
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
            <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
                {/* Top Navbar */}
                <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
                    <div className="h-14 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4">
                        {/* Mobile Toggle Button */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                            aria-label="Toggle sidebar"
                        >
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>

                        {/* Search Bar */}
                        <div className="hidden sm:flex flex-1 max-w-xl mx-auto">
                            <div className="relative w-full">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search groups, members..."
                                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Right Icons */}
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="relative cursor-pointer p-2 hover:bg-gray-100 rounded-md transition-colors">
                                <Bell size={20} className="text-gray-700" />
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                    3
                                </span>
                            </div>
                            <div className="cursor-pointer p-2 hover:bg-gray-100 rounded-md transition-colors">
                                <User size={20} className="text-gray-700" />
                            </div>
                        </div>
                    </div>
                </nav>

                {/* ---------------- Main Content ---------------- */}
                <main className="flex-1 min-h-screen bg-[#f8fbff]">
                    <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

