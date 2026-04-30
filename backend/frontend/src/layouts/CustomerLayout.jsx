import { NavLink, Outlet } from "react-router-dom";

import AppHeader from "../components/AppHeader";

const items = [
  { label: "Home", to: "/customer/home" },
  { label: "Browse", to: "/customer/browse" },
  { label: "Bookings", to: "/customer/bookings" },
  { label: "Settings", to: "/customer/profile" },
];

export default function CustomerLayout() {
  return (
    <div className="app-shell">
      <AppHeader eyebrow="Continue as Customer" title="Smart Booking" notificationTo="/notifications" />

      <main className="page-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="nav-item">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
