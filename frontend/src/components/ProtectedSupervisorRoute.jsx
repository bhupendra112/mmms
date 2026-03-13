import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsSupervisorAuthenticated } from "../store/supervisorAuthSlice";

export default function ProtectedSupervisorRoute({ children }) {
    const isAuthenticated = useSelector(selectIsSupervisorAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/supervisor/login" replace />;
    }
    return children;
}
