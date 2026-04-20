import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function RoleSelectionPage() {
  const { user, chooseRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.account_type === "Customer") {
    return <Navigate to="/customer/home" replace />;
  }

  if (user.account_type === "Business") {
    return <Navigate to="/business/dashboard" replace />;
  }

  const handleSelect = async (role) => {
    setError("");
    try {
      setLoading(true);
      await chooseRole(role);
      navigate(role === "Business" ? "/business/dashboard" : "/customer/home");
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-center">
      <div className="card role-card">
        <p className="eyebrow">Choose your side</p>
        <h1>How would you like to continue?</h1>
        <div className="role-actions">
          <button className="button" disabled={loading} onClick={() => handleSelect("Customer")}>
            Continue as Customer
          </button>
          <button className="button button-secondary" disabled={loading} onClick={() => handleSelect("Business")}>
            Continue as Business
          </button>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
      </div>
    </div>
  );
}
