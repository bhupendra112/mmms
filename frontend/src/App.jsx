import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./screens/Dashboard";
import Members from "./screens/Members";
import MemberDashboard from "./screens/MemberDashboard";
import DemandRecovery from "./screens/DemandRecovery";
import LoanProviding from "./screens/LoanProviding";
import GroupLedger from "./screens/GroupLedger";
import MemberRegistration from "./screens/MemberRegistration";
import GroupBankMaster from "./screens/GroupBankMaster"
import RegisterAdmin from "./screens/RegisterAdmin";
import LoginAdmin from "./screens/LoginAdmin";
function App() {
  return (
    <Router>
      <Routes>
        {/* Main Layout */}
        <Route path="/" element={<Navbar />}>
          {/* Dashboard */}
          <Route index element={<Dashboard />} />

          {/* Members List */}
          <Route path="members" element={<Members />} />

          {/* Member Dashboard (dynamic route) */}
          <Route path="members/:id" element={<MemberDashboard />} />
          <Route path="demand-recovery" element={<DemandRecovery />} />

            {/* Group Management */}
          <Route path="group-management" element={<GroupLedger />} />
          <Route path="loan-management" element={<LoanProviding />} />
          <Route path="/member-registration" element={<MemberRegistration />} />
          <Route path="/register-group" element={<GroupBankMaster />} />
          <Route path="/admin/register" element={<RegisterAdmin />} />
          <Route path="/login-admin" element={<LoginAdmin />} />

        </Route>
      </Routes>
    </Router>
  );
}

export default App;
