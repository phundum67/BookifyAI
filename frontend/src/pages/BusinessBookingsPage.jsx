import { useEffect, useState } from "react";

import { bookingsApi } from "../api";
import { formatTimeRange } from "../utils/time";

export default function BusinessBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  const loadBookings = async () => {
    try {
      const response = await bookingsApi.business();
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

  return (
    <div className="stack">
      <section className="card stack business-bookings-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Owner view</p>
            <h2>Business bookings</h2>
          </div>
          <span className="badge badge-neutral">{bookings.length}</span>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        {bookings.length ? (
          bookings.map((booking) => (
            <article key={booking.id} className="booking-item booking-card-v2">
              <div className="booking-copy">
                <strong>{booking.customer_name}</strong>
                <p className="muted">
                  {booking.slot_date} | {formatTimeRange(booking.start_time, booking.end_time)}
                </p>
                <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
              </div>
              {booking.status === "confirmed" ? (
                <button className="button button-secondary" type="button" onClick={() => cancelBooking(booking.id)}>
                  Cancel booking
                </button>
              ) : (
                <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state-card">
            <h3>No bookings yet</h3>
            <p className="muted">Bookings will appear here as customers confirm them.</p>
          </div>
        )}
      </section>
    </div>
  );
}
