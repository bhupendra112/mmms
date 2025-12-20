import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { GroupProvider } from "./contexts/GroupContext";
import { AdminProvider } from "./contexts/AdminContext";
import ProtectedGroupRoute from "./components/ProtectedGroupRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

// Admin Components
import AdminNavbar from "./components/admin/AdminNavbar";
import AdminDashboard from "./screens/admin/AdminDashboard";
import BankDetails from "./screens/admin/BankDetails";
import CreateGroup from "./screens/admin/CreateGroup";
import AdminMembers from "./screens/admin/AdminMembers";
import GroupManagement from "./screens/admin/GroupManagement";
import AdminLoanTaking from "./screens/admin/LoanTaking";
import AdminLoanManagement from "./screens/admin/LoanManagement";
import AdminSettings from "./screens/admin/AdminSettings";
import ApprovalManagement from "./screens/admin/ApprovalManagement";

// Group Components
import GroupNavbar from "./components/group/GroupNavbar";
import GroupDashboard from "./screens/group/GroupDashboard";
import DemandRecoveryGroup from "./screens/group/DemandRecovery";
import LoanTaking from "./screens/group/LoanTaking";
import LoanManagement from "./screens/group/LoanManagement";

// Legacy Components (keeping for backward compatibility)
import Navbar from "./components/Navbar";
import Dashboard from "./screens/Dashboard";
import Members from "./screens/Members";
import MemberDashboard from "./screens/MemberDashboard";
import DemandRecovery from "./screens/DemandRecovery";
import LoanProviding from "./screens/LoanProviding";
import GroupLedger from "./screens/GroupLedger";
import MemberRegistration from "./screens/MemberRegistration";
import GroupBankMaster from "./screens/GroupBankMaster";
import RegisterAdmin from "./screens/RegisterAdmin";
import LoginAdmin from "./screens/LoginAdmin";
import LoginGroup from "./screens/LoginGroup";

function App() {
  return (
    <Router>
      <AdminProvider>
        <Routes>
          {/* Admin Application Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminNavbar />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="group-management" element={<GroupManagement />} />
            <Route path="bank-details" element={<BankDetails />} />
            <Route path="create-group" element={<CreateGroup />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="member-registration" element={<MemberRegistration />} />
            <Route path="members/:id" element={<MemberDashboard />} />
            <Route path="demand-recovery" element={<DemandRecoveryGroup />} />
            <Route path="loan-taking" element={<AdminLoanTaking />} />
            <Route path="loan-management" element={<AdminLoanManagement />} />
            <Route path="approvals" element={<ApprovalManagement />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Group Application Routes */}
          <Route
            path="/group"
            element={
              <ProtectedGroupRoute>
                <GroupProvider>
                  <GroupNavbar />
                </GroupProvider>
              </ProtectedGroupRoute>
            }
          >
            <Route index element={<GroupDashboard />} />
            <Route path="members" element={<Members />} />
            <Route path="member-registration" element={<MemberRegistration />} />
            <Route path="members/:id" element={<MemberDashboard />} />
            <Route path="demand-recovery" element={<DemandRecoveryGroup />} />
            <Route path="ledger" element={<GroupLedger />} />
            <Route path="loans" element={<LoanManagement />} />
            <Route path="loan-taking" element={<LoanTaking />} />
          </Route>

          {/* Auth Routes (No Layout) */}
          <Route path="/admin/register" element={<RegisterAdmin />} />
          <Route path="/login-admin" element={<LoginAdmin />} />
          <Route path="/group/login" element={<LoginGroup />} />

          {/* Legacy Routes (keeping for backward compatibility) */}
          {/**    <Route path="/" element={<Navbar />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="members/:id" element={<MemberDashboard />} />
          <Route path="demand-recovery" element={<DemandRecovery />} />
          <Route path="group-management" element={<GroupLedger />} />
          <Route path="loan-management" element={<LoanProviding />} />
          <Route path="member-registration" element={<MemberRegistration />} />
          <Route path="register-group" element={<GroupBankMaster />} />
        </Route>
*/}
          {/* Default redirect to group panel */}
          <Route path="/" element={<Navigate to="/group" replace />} />
          <Route path="*" element={<Navigate to="/group" replace />} />
        </Routes>
      </AdminProvider>
    </Router>
  );
}

export default App;
