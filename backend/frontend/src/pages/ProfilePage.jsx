import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { bookingsApi, favoritesApi } from "../api";
import { useAuth } from "../context/AuthContext";
import BusinessCard from "../components/BusinessCard";
import { formatTimeRange } from "../utils/time";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [favorites, setFavorites] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  useEffect(() => {
    favoritesApi.list().then((response) => setFavorites(response.data.businesses || [])).catch(() => {});
    bookingsApi.customer().then((response) => setBookings(response.data.bookings || [])).catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await updateProfile(form);
      setMessage("Profile updated successfully.");
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="stack settings-page">
      <section className="card settings-hero-card">
        <div className="stack compact-stack">
          <p className="eyebrow">Settings</p>
          <h2>Account and app</h2>
          <p className="muted">Manage your profile, saved places, bookings, and app information from one mobile-friendly screen.</p>
        </div>
      </section>

      <form className="card stack settings-section-card" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>Edit profile</h2>
          <span className="badge">Account</span>
        </div>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} />
        </label>
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
        <button className="button" type="submit">
          Save settings
        </button>
      </form>

      <section className="card stack settings-section-card">
        <div className="section-heading">
          <h2>Saved businesses</h2>
          <span className="badge badge-neutral">{favorites.length}</span>
        </div>
        {favorites.length ? (
          <div className="settings-saved-grid">
            {favorites.map((business) => (
              <BusinessCard key={business.id} business={business} compact />
            ))}
          </div>
        ) : (
          <p className="muted">No saved businesses yet. Save a place to find it again quickly.</p>
        )}
      </section>

      <section className="card stack settings-section-card">
        <div className="section-heading">
          <h2>Booking history</h2>
          <span className="badge badge-neutral">{bookings.length}</span>
        </div>
        {bookings.length ? (
          bookings.map((booking) => (
            <div key={booking.id} className="list-row">
              <div className="stack compact-stack">
                <strong>{booking.business_name}</strong>
                <span className="muted">
                  {booking.slot_date} | {formatTimeRange(booking.start_time, booking.end_time)}
                </span>
                <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No booking history yet. Start by creating your first booking.</p>
        )}
      </section>

      <section className="settings-info-grid">
        <article className="card settings-info-card">
          <div className="section-heading">
            <h3>Policies</h3>
          </div>
          <p className="muted">Review booking rules, cancellation guidance, and account safety information.</p>
        </article>
        <article className="card settings-info-card">
          <div className="section-heading">
            <h3>About us</h3>
          </div>
          <p className="muted">This app helps local businesses and customers connect through quick, simple bookings.</p>
        </article>
      </section>

      <section className="card settings-section-card settings-logout-card">
        <div>
          <h2>Logout</h2>
          <p className="muted">Sign out from this device when you are done.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={handleLogout}>
          Logout
        </button>
      </section>
    </div>
  );
}
