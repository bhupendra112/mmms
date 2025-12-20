import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsGroupAuthenticated } from "../store/groupAuthSlice";

export default function ProtectedGroupRoute({ children }) {
    const isAuthenticated = useSelector(selectIsGroupAuthenticated);
    
    if (!isAuthenticated) {
        return <Navigate to="/group/login" replace />;
    }
    return children;
}

