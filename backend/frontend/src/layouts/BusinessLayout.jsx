import { NavLink, Outlet } from "react-router-dom";

import AppHeader from "../components/AppHeader";

const items = [
  { label: "Dashboard", to: "/business/dashboard" },
  { label: "Profile", to: "/business/profile" },
  { label: "Slot Management", to: "/business/slots" },
  { label: "Bookings", to: "/business/bookings" },
  { label: "Settings", to: "/business/settings" },
];

export default function BusinessLayout() {
  return (
    <div className="app-shell business-shell">
      <AppHeader eyebrow="Continue as Business" title="Manage bookings faster" notificationTo="/business/notifications" />

      <nav className="tab-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="tab-link">
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
