import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function BusinessSettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="stack settings-page business-settings-page">
      <section className="card settings-hero-card">
        <div className="stack compact-stack">
          <p className="eyebrow">Business settings</p>
          <h2>Account and business tools</h2>
          <p className="muted">Manage your owner account, business profile, support information, and app policies in one simple place.</p>
        </div>
      </section>

      <section className="card stack settings-section-card">
        <div className="section-heading">
          <h2>Account info</h2>
          <span className="badge">Owner</span>
        </div>
        <div className="settings-list">
          <div className="settings-list-item">
            <span>Name</span>
            <strong>{user?.name || "Business owner"}</strong>
          </div>
          <div className="settings-list-item">
            <span>Email</span>
            <strong>{user?.email || "Not added"}</strong>
          </div>
          <div className="settings-list-item">
            <span>Phone</span>
            <strong>{user?.phone || "Not added"}</strong>
          </div>
        </div>
      </section>

      <section className="card stack settings-section-card">
        <div className="section-heading">
          <h2>Business controls</h2>
          <span className="badge badge-neutral">Quick links</span>
        </div>
        <div className="settings-action-list">
          <Link className="settings-action-row" to="/business/profile">
            <div>
              <strong>Edit Profile</strong>
              <span>Update photos, price, hours, location, and booking status.</span>
            </div>
            <span aria-hidden="true">&gt;</span>
          </Link>
          <Link className="settings-action-row" to="/business/slots">
            <div>
              <strong>Manage Slots</strong>
              <span>Open or close slots for customers from the visual grid.</span>
            </div>
            <span aria-hidden="true">&gt;</span>
          </Link>
          <Link className="settings-action-row" to="/business/bookings">
            <div>
              <strong>Booking History</strong>
              <span>Review customer bookings and booking statuses.</span>
            </div>
            <span aria-hidden="true">&gt;</span>
          </Link>
        </div>
      </section>

      <section className="settings-info-grid">
        <article className="card settings-info-card">
          <div className="section-heading">
            <h3>Help / Support</h3>
          </div>
          <p className="muted">Find guidance for managing bookings, updating slots, and keeping your business profile accurate.</p>
        </article>
        <article className="card settings-info-card">
          <div className="section-heading">
            <h3>Policies</h3>
          </div>
          <p className="muted">Review booking rules, cancellation guidance, review standards, and business account terms.</p>
        </article>
        <article className="card settings-info-card">
          <div className="section-heading">
            <h3>About us</h3>
          </div>
          <p className="muted">This platform helps local businesses manage slots and receive instant customer bookings.</p>
        </article>
      </section>

      <section className="card settings-section-card settings-logout-card">
        <div>
          <h2>Logout</h2>
          <p className="muted">Sign out from this business account on this device.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={handleLogout}>
          Logout
        </button>
      </section>
    </div>
  );
}
