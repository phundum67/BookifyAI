import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { dashboardApi } from "../api";
import { formatMoney } from "../utils/currency";
import { formatTimeRange } from "../utils/time";

function formatReadableDate(dateValue) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function DashboardStat({ label, value, helper }) {
  return (
    <article className="card dashboard-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function BookingPreview({ booking, showDate = false }) {
  return (
    <article className="dashboard-booking-preview">
      <div>
        <strong>{booking.customer_name}</strong>
        <p className="muted">
          {showDate ? `${formatReadableDate(booking.slot_date)} | ` : ""}
          {formatTimeRange(booking.start_time, booking.end_time)}
        </p>
      </div>
      <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
    </article>
  );
}

export default function BusinessDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .summary()
      .then((response) => {
        setSummary(response.data.summary);
        setBusiness(response.data.business);
      })
      .catch((apiError) => setError(apiError.errors?.[0] || apiError.message))
      .finally(() => setIsLoading(false));
  }, []);

  const recentBookings = summary?.recent_bookings || [];
  const todaysBookings = summary?.todays_bookings || [];
  const nextBooking = summary?.next_upcoming_booking;
  const earnings = formatMoney(summary?.estimated_earnings, summary?.currency_code || summary?.currency, summary?.currency_symbol);

  const dashboardStats = useMemo(
    () => [
      { label: "Today", value: summary?.todays_booking_count || 0, helper: "Bookings" },
      { label: "Total", value: summary?.total_bookings || 0, helper: "All bookings" },
      { label: "Recent", value: recentBookings.length, helper: "Latest activity" },
      { label: "Reviews", value: summary?.total_reviews || 0, helper: `${summary?.average_rating || 0} avg rating` },
      { label: "Rating", value: `${summary?.average_rating || 0}`, helper: "Customer trust" },
      { label: "Earnings", value: earnings, helper: "Estimated" },
    ],
    [summary, recentBookings.length, earnings],
  );

  if (isLoading) {
    return (
      <div className="card empty-state-card">
        <h3>Loading dashboard</h3>
        <p className="muted">Preparing today's business summary...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="card stack">
        <h2>Set up your business profile</h2>
        <p className="muted">Create your business profile first, then return here for bookings and dashboard stats.</p>
        {error ? <div className="alert error">{error}</div> : null}
        <Link className="button" to="/business/profile">
          Go to profile setup
        </Link>
      </div>
    );
  }

  return (
    <div className="stack business-dashboard-v3">
      {error ? <div className="alert error">{error}</div> : null}

      <section className={`card dashboard-focus-card ${nextBooking ? "has-next-booking" : "is-waiting"}`}>
        <div className="dashboard-focus-topline">
          <div>
            <p className="eyebrow">Up next</p>
            <h2>{nextBooking ? nextBooking.customer_name : "No upcoming booking"}</h2>
          </div>
          <span className={`status-badge ${nextBooking ? "status-confirmed" : "status-blocked"}`}>
            {nextBooking ? "confirmed" : "waiting"}
          </span>
        </div>

        {nextBooking ? (
          <div className="dashboard-next-details">
            <div>
              <span>Date</span>
              <strong>{formatReadableDate(nextBooking.slot_date)}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{formatTimeRange(nextBooking.start_time, nextBooking.end_time)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Ready to serve</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Keep your business profile active and manage today's slots so customers can book instantly.</p>
        )}

        <div className="dashboard-focus-actions">
          <Link className="button compact-button" to="/business/slots">
            Manage slots
          </Link>
          <Link className="button button-secondary compact-button" to="/business/bookings">
            View bookings
          </Link>
        </div>
      </section>

      <section className="dashboard-quick-actions">
        <Link className="card dashboard-action-card" to="/business/profile">
          <span>Edit</span>
          <strong>Profile</strong>
        </Link>
        <Link className="card dashboard-action-card" to="/business/slots">
          <span>Manage</span>
          <strong>Slots</strong>
        </Link>
        <Link className="card dashboard-action-card" to="/business/bookings">
          <span>View</span>
          <strong>Bookings</strong>
        </Link>
        <Link className="card dashboard-action-card" to="/business/settings">
          <span>Open</span>
          <strong>Settings</strong>
        </Link>
      </section>

      <section className="dashboard-stat-grid">
        {dashboardStats.map((item) => (
          <DashboardStat key={item.label} label={item.label} value={item.value} helper={item.helper} />
        ))}
      </section>

      <section className="card dashboard-review-card">
        <div>
          <p className="eyebrow">Reviews and earnings</p>
          <h2>{summary?.average_rating || 0} star average</h2>
          <p className="muted">
            {summary?.total_reviews || 0} reviews | Estimated earnings {earnings}
          </p>
        </div>
        <span className="badge badge-solid">Owner summary</span>
      </section>

      <section className="card stack dashboard-list-card">
        <div className="section-heading dashboard-section-heading">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Today's bookings</h2>
          </div>
          <span className="badge badge-neutral">{todaysBookings.length}</span>
        </div>
        {todaysBookings.length ? (
          todaysBookings.slice(0, 3).map((booking) => <BookingPreview key={booking.id} booking={booking} />)
        ) : (
          <div className="empty-state-card">
            <h3>No bookings today</h3>
            <p className="muted">You have no confirmed bookings scheduled for today.</p>
          </div>
        )}
      </section>

      <section className="card stack dashboard-list-card">
        <div className="section-heading dashboard-section-heading">
          <div>
            <p className="eyebrow">Recent</p>
            <h2>Latest bookings</h2>
          </div>
          <Link className="section-link" to="/business/bookings">
            View all
          </Link>
        </div>
        {recentBookings.length ? (
          recentBookings.slice(0, 4).map((booking) => <BookingPreview key={booking.id} booking={booking} showDate />)
        ) : (
          <div className="empty-state-card">
            <h3>No booking activity yet</h3>
            <p className="muted">Recent customer bookings will appear here after your first confirmed booking.</p>
          </div>
        )}
      </section>
    </div>
  );
}
