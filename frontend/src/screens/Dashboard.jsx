import React from "react";
import { Users, IndianRupee, PiggyBank, Banknote, TrendingUp, Wallet, CreditCard, List, FilePlus2, HandCoins, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const summaryCards = [
    { title: "Total Members", value: "120", icon: Users, color: "from-blue-500 to-blue-700" },
    { title: "Loan Recovery (This Month)", value: "₹2,45,000", icon: IndianRupee, color: "from-green-500 to-green-700" },
    { title: "Savings Collected", value: "₹1,80,000", icon: PiggyBank, color: "from-indigo-500 to-indigo-700" },
    { title: "Total FD Amount", value: "₹6,25,000", icon: Banknote, color: "from-purple-500 to-purple-700" },
    { title: "Interest Collected", value: "₹35,000", icon: TrendingUp, color: "from-pink-500 to-pink-700" },
    { title: "Cash Received Today", value: "₹22,000", icon: Wallet, color: "from-orange-500 to-orange-700" },
    { title: "Online Payment Today", value: "₹12,500", icon: CreditCard, color: "from-teal-500 to-teal-700" },
  ];

  const quickActions = [
    { title: "Member List", icon: List, color: "bg-blue-600" },
    { title: "New Recovery Entry", icon: FilePlus2, color: "bg-green-600" },
    { title: "Loan Payment", icon: HandCoins, color: "bg-purple-600" },
    { title: "Reports", icon: BarChart3, color: "bg-orange-600" },
  ];

  return (
    <div className="space-y-10">

      {/* -------------------- Summary Cards -------------------- */}
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {summaryCards.map((item, i) => (
          <div
            key={i}
            className={`p-5 rounded-xl shadow-md bg-gradient-to-br ${item.color} text-white transform transition-all hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">{item.title}</p>
                <h2 className="text-2xl font-bold mt-1">{item.value}</h2>
              </div>
              <item.icon size={40} className="opacity-80" />
            </div>
          </div>
        ))}
      </div>

      {/* -------------------- Quick Action Buttons -------------------- */}
      <h2 className="text-xl font-semibold text-gray-800">Quick Actions</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {quickActions.map((btn, i) => (
          <button
            key={i}
            className={`${btn.color} text-white py-4 rounded-xl shadow-md flex flex-col items-center gap-3 hover:opacity-90 transition`}
          >
            <btn.icon size={32} />
            <span className="font-medium">{btn.title}</span>
          </button>
        ))}
      </div>

    </div>
  );
};

export default Dashboard;
