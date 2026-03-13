import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsGroupAuthenticated } from "../store/groupAuthSlice";
import { selectIsSupervisorAuthenticated } from "../store/supervisorAuthSlice";

export default function ProtectedGroupRoute({ children }) {
    const isGroupAuth = useSelector(selectIsGroupAuthenticated);
    const isSupervisorAuth = useSelector(selectIsSupervisorAuthenticated);
    const isAuthenticated = isGroupAuth || isSupervisorAuth;

    if (!isAuthenticated) {
        return <Navigate to="/group/login" replace />;
    }
    return children;
}

