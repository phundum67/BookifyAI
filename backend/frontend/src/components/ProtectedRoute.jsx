import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ requiredRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="screen-center">Loading your workspace...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.account_type) {
    return <Navigate to="/choose-role" replace />;
  }

  if (requiredRole && user.account_type !== requiredRole) {
    const fallback = user.account_type === "Business" ? "/business/dashboard" : "/customer/home";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
