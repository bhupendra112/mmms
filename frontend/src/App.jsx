import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

import Navbar from "./components/Navbar";
import Dashboard from "./screens/Dashboard";
import Members from "./screens/Members";
import MemberDashboard from "./screens/MemberDashboard";
import DemandRecovery from "./screens/DemandRecovery";
import LoanProviding from "./screens/LoanProviding";
import GroupLedger from "./screens/GroupLedger";
import MemberRegistration from "./screens/MemberRegistration";
import GroupBankMaster from "./screens/GroupBankMaster";
import LoginAdmin from "./screens/LoginAdmin";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login-admin" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login-admin" element={<LoginAdmin />} />
        <Route path="/" element={<ProtectedRoute><Navbar /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="members/:id" element={<MemberDashboard />} />
          <Route path="demand-recovery" element={<DemandRecovery />} />
          <Route path="group-management" element={<GroupLedger />} />
          <Route path="loan-management" element={<LoanProviding />} />
          <Route path="member-registration" element={<MemberRegistration />} />
          <Route path="register-group" element={<GroupBankMaster />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
