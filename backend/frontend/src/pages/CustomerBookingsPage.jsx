import { useEffect, useState } from "react";

import { bookingsApi } from "../api";
import { formatTimeRange } from "../utils/time";

export default function CustomerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  const loadBookings = async () => {
    try {
      const response = await bookingsApi.customer();
      setBookings(response.data.bookings || []);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const cancelBooking = async (bookingId) => {
    try {
      await bookingsApi.cancel(bookingId);
      await loadBookings();
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const upcoming = bookings.filter((booking) => booking.status === "confirmed");
  const completed = bookings.filter((booking) => booking.status === "completed");
  const cancelled = bookings.filter((booking) => booking.status === "cancelled");

  const renderList = (items, title, emptyMessage, showCancel = false) => (
    <section className="card stack">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      {items.length ? (
        items.map((booking) => (
          <article key={booking.id} className="booking-item">
            <div className="booking-copy">
              <strong>{booking.business_name}</strong>
              <p className="muted">
                {booking.slot_date} | {formatTimeRange(booking.start_time, booking.end_time)}
              </p>
              <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
            </div>
            {showCancel ? (
              <button className="button button-secondary" onClick={() => cancelBooking(booking.id)} type="button">
                Cancel
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <p className="muted">{emptyMessage}</p>
      )}
    </section>
  );

  return (
    <div className="stack">
      {error ? <div className="alert error">{error}</div> : null}
      {renderList(upcoming, "Upcoming bookings", "No upcoming bookings. Browse businesses to reserve your first slot.", true)}
      {renderList(completed, "Completed", "Completed bookings will appear here after your visits.")}
      {renderList(cancelled, "Cancelled", "Cancelled bookings will appear here for your records.")}
    </div>
  );
}
