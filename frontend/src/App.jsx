import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import BusinessLayout from "./layouts/BusinessLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import AuthPage from "./pages/AuthPage";
import BrowsePage from "./pages/BrowsePage";
import CategoriesPage from "./pages/CategoriesPage";
import BusinessBookingsPage from "./pages/BusinessBookingsPage";
import BusinessDashboardPage from "./pages/BusinessDashboardPage";
import BusinessDetailPage from "./pages/BusinessDetailPage";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import BusinessSettingsPage from "./pages/BusinessSettingsPage";
import CustomerBookingsPage from "./pages/CustomerBookingsPage";
import CustomerHomePage from "./pages/CustomerHomePage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import RoleSelectionPage from "./pages/RoleSelectionPage";
import SlotManagementPage from "./pages/SlotManagementPage";
import WelcomePage from "./pages/WelcomePage";

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="screen-center">Loading your workspace...</div>;
  }

  if (!user) {
    return <WelcomePage />;
  }

  if (!user.account_type) {
    return <Navigate to="/choose-role" replace />;
  }

  if (user.account_type === "Business") {
    return <Navigate to="/business/dashboard" replace />;
  }

  return <Navigate to="/customer/home" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/choose-role" element={<RoleSelectionPage />} />
      <Route path="/businesses/:businessId" element={<BusinessDetailPage />} />
      <Route element={<ProtectedRoute requiredRole="Customer" />}>
        <Route element={<CustomerLayout />}>
          <Route path="/customer/home" element={<CustomerHomePage />} />
          <Route path="/customer/browse" element={<BrowsePage />} />
          <Route path="/customer/categories" element={<CategoriesPage />} />
          <Route path="/customer/bookings" element={<CustomerBookingsPage />} />
          <Route path="/customer/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/notifications" element={<NotificationsPage mode="customer" />} />
      </Route>
      <Route element={<ProtectedRoute requiredRole="Business" />}>
        <Route element={<BusinessLayout />}>
          <Route path="/business/dashboard" element={<BusinessDashboardPage />} />
          <Route path="/business/profile" element={<BusinessProfilePage />} />
          <Route path="/business/slots" element={<SlotManagementPage />} />
          <Route path="/business/bookings" element={<BusinessBookingsPage />} />
          <Route path="/business/settings" element={<BusinessSettingsPage />} />
          <Route path="/business/notifications" element={<NotificationsPage mode="business" />} />
        </Route>
      </Route>
    </Routes>
  );
}
