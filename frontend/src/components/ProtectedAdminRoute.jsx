import { Navigate } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login-admin" replace />;
  }

  return children;
}

