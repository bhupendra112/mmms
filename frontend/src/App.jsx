import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { OfflineProvider } from "./contexts/OfflineContext";
import { GroupProvider } from "./contexts/GroupContext";
import { AdminProvider } from "./contexts/AdminContext";
import PreSyncBlocker from "./components/PreSyncBlocker";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedGroupRoute from "./components/ProtectedGroupRoute";
import ProtectedSupervisorRoute from "./components/ProtectedSupervisorRoute";

// Layouts
import AdminNavbar from "./components/admin/AdminNavbar";
import GroupNavbar from "./components/group/GroupNavbar";
import SupervisorNavbar from "./components/supervisor/SupervisorNavbar";

// Auth Screens
import LoginAdmin from "./screens/LoginAdmin";
import LoginGroup from "./screens/LoginGroup";
import LoginSupervisor from "./screens/LoginSupervisor";
import RegisterAdmin from "./screens/RegisterAdmin";

// Admin Screens
import AdminDashboard from "./screens/admin/AdminDashboard";
import AdminMembers from "./screens/admin/AdminMembers";
import GroupManagement from "./screens/admin/GroupManagement";
import LoanManagement from "./screens/admin/LoanManagement";
import AdminPaymentManagement from "./screens/admin/PaymentManagement";
import AdminExpenseManagement from "./screens/admin/ExpenseManagement";
import FinancialReports from "./screens/admin/FinancialReports";
import ApprovalManagement from "./screens/admin/ApprovalManagement";
import AdminSettings from "./screens/admin/AdminSettings";
import BankDetails from "./screens/admin/BankDetails";
import CashToBankConversion from "./screens/admin/CashToBankConversion";
import CreateGroup from "./screens/admin/CreateGroup";
import DemandRecovery from "./screens/group/DemandRecovery";

// Group Screens
import GroupDashboard from "./screens/group/GroupDashboard";
import Members from "./screens/Members";
import MemberDashboard from "./screens/MemberDashboard";
import MemberExitSettlement from "./screens/MemberExitSettlement";
import MemberRegistration from "./screens/MemberRegistration";
import GroupDemandRecovery from "./screens/group/DemandRecovery";
import LoanTaking from "./screens/group/LoanTaking";
import GroupPaymentManagement from "./screens/group/PaymentManagement";
import GroupExpenseManagement from "./screens/group/ExpenseManagement";
import GroupLoanManagement from "./screens/group/LoanManagement";
import GroupLedger from "./screens/GroupLedger";
import SupervisorDashboard from "./screens/supervisor/SupervisorDashboard";
import SupervisorClusters from "./screens/supervisor/SupervisorClusters";
import SupervisorGroups from "./screens/supervisor/SupervisorGroups";
import SupervisorGroupDetail from "./screens/supervisor/SupervisorGroupDetail";
import SupervisorManagement from "./screens/admin/SupervisorManagement";

function App() {
  return (
    <BrowserRouter>
      <OfflineProvider>
        <PreSyncBlocker>
          <AdminProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login-admin" element={<LoginAdmin />} />
              <Route path="/group/login" element={<LoginGroup />} />
              <Route path="/supervisor/login" element={<LoginSupervisor />} />

              {/* Admin Routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedAdminRoute>
                    <AdminNavbar />
                  </ProtectedAdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="members/:id" element={<MemberDashboard />} />
                <Route path="members/:id/exit" element={<MemberExitSettlement />} />
                <Route path="member-registration" element={<MemberRegistration />} />
                <Route path="groups" element={<GroupManagement />} />
                <Route path="group-management" element={<GroupManagement />} />
                <Route path="loans" element={<LoanManagement />} />
                <Route path="loan-management" element={<LoanManagement />} />
                <Route path="loan-taking" element={<LoanTaking />} />
                <Route path="payments" element={<AdminPaymentManagement />} />
                <Route path="expenses" element={<AdminExpenseManagement />} />
                <Route path="reports" element={<FinancialReports />} />
                <Route path="financial-reports" element={<FinancialReports />} />
                <Route path="approvals" element={<ApprovalManagement />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="bank" element={<BankDetails />} />
                <Route path="bank-details" element={<BankDetails />} />
                <Route path="cash-to-bank" element={<CashToBankConversion />} />
                <Route path="create-group" element={<CreateGroup />} />
                <Route path="supervisor-management" element={<SupervisorManagement />} />
                <Route path="add-place" element={<RegisterAdmin />} />
                <Route path="demand-recovery" element={<DemandRecovery />} />
              </Route>

              {/* Group Routes */}
              <Route
                path="/group/*"
                element={
                  <ProtectedGroupRoute>
                    <GroupProvider>
                      <GroupNavbar />
                    </GroupProvider>
                  </ProtectedGroupRoute>
                }
              >
                <Route index element={<Navigate to="/group/dashboard" replace />} />
                <Route path="dashboard" element={<GroupDashboard />} />
                <Route path="members" element={<Members />} />
                <Route path="members/:id" element={<MemberDashboard />} />
                <Route path="members/:id/exit" element={<MemberExitSettlement />} />
                <Route path="member-registration" element={<MemberRegistration />} />
                <Route path="demand-recovery" element={<GroupDemandRecovery />} />
                <Route path="loans" element={<GroupLoanManagement />} />
                <Route path="loan-taking" element={<LoanTaking />} />
                <Route path="payments" element={<GroupPaymentManagement />} />
                <Route path="expenses" element={<GroupExpenseManagement />} />
                <Route path="ledger" element={<GroupLedger />} />
                <Route path="cash-to-bank" element={<CashToBankConversion />} />
              </Route>

              {/* Supervisor Routes */}
              <Route
                path="/supervisor/*"
                element={
                  <ProtectedSupervisorRoute>
                    <SupervisorNavbar />
                  </ProtectedSupervisorRoute>
                }
              >
                <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
                <Route path="dashboard" element={<SupervisorDashboard />} />
                <Route path="clusters" element={<SupervisorClusters />} />
                <Route path="groups" element={<SupervisorGroups />} />
                <Route path="group/:groupId" element={<SupervisorGroupDetail />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/group/login" replace />} />
              <Route path="*" element={<Navigate to="/group/login" replace />} />
            </Routes>
          </AdminProvider>
        </PreSyncBlocker>
      </OfflineProvider>
    </BrowserRouter>
  );
}

export default App;
