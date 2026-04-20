import { useEffect, useState } from "react";

import { notificationsApi } from "../api";

export default function NotificationsPage({ mode }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      const response = await notificationsApi.list();
      setItems(response.data.notifications || []);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (notificationId) => {
    try {
      await notificationsApi.markRead(notificationId);
      await loadNotifications();
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  return (
    <div className="stack notifications-page">
      <section className="card stack notifications-shell">
        <div className="section-heading notifications-heading">
          <div>
            <p className="eyebrow">Alerts</p>
            <h2>{mode === "business" ? "Business notifications" : "Notifications"}</h2>
          </div>
          <span className="badge badge-solid">{items.filter((item) => !item.is_read).length} unread</span>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        {items.length ? (
          <div className="notification-list-v2">
            {items.map((item) => (
            <article key={item.id} className={`notification-item notification-card-v2 ${item.is_read ? "is-read" : "is-unread"}`}>
              <span className="notification-dot" aria-hidden="true" />
              <div className="notification-copy">
                <div className="notification-title-row">
                  <strong>{item.title}</strong>
                  <span className="badge badge-neutral">{item.type.replaceAll("_", " ")}</span>
                </div>
                <p>{item.message}</p>
                <span className="muted small-text">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              {!item.is_read ? (
                <button className="button button-secondary notification-action" type="button" onClick={() => markRead(item.id)}>
                  Mark read
                </button>
              ) : (
                <span className="badge badge-neutral">Read</span>
              )}
            </article>
            ))}
          </div>
        ) : (
          <div className="empty-state-card">
            <h3>No notifications yet</h3>
            <p className="muted">
              {mode === "business"
                ? "New bookings, cancellations, and reviews will appear here."
                : "Booking confirmations, cancellations, and reminder placeholders will appear here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
