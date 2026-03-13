import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutSupervisor } from "../../store/supervisorAuthSlice";
import { Menu, X, LayoutGrid, Layers, Users } from "lucide-react";

export default function SupervisorNavbar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const supervisor = useSelector((state) => state.supervisorAuth.supervisor);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [sidebarOpen]);

    const handleLogout = () => {
        dispatch(logoutSupervisor());
        navigate("/supervisor/login", { replace: true });
    };

    const menuItems = [
        { icon: LayoutGrid, label: "Dashboard", path: "/supervisor/dashboard" },
        { icon: Layers, label: "Clusters", path: "/supervisor/clusters" },
        { icon: Users, label: "Groups", path: "/supervisor/groups" },
    ];

    const closeMobileSidebar = () => {
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85%] bg-slate-800 text-white transform transition-transform duration-200 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                } lg:translate-x-0 lg:max-w-none`}
            >
                <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
                    <div className="bg-slate-600 w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold">
                        SV
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Supervisor</h1>
                        <p className="text-slate-400 text-sm">{supervisor?.place || "Panel"}</p>
                    </div>
                </div>
                <nav className="p-3">
                    <ul className="space-y-1">
                        {menuItems.map(({ icon: Icon, label, path }) => {
                            const active = location.pathname === path;
                            return (
                                <li key={path}>
                                    <Link
                                        to={path}
                                        onClick={closeMobileSidebar}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                                            active ? "bg-slate-600 text-white" : "text-slate-300 hover:bg-slate-700"
                                        }`}
                                    >
                                        <Icon size={18} className="shrink-0" />
                                        {label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
                <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
                    <div className="h-14 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-md"
                            aria-label="Toggle sidebar"
                        >
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div className="flex-1" />
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 hidden sm:inline">{supervisor?.name || supervisor?.email}</span>
                            <button
                                onClick={handleLogout}
                                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </nav>
                <main className="flex-1 min-h-screen bg-gray-50 min-w-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
