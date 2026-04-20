import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { notificationsApi } from "../api";
import { useAuth } from "../context/AuthContext";

export default function NotificationBell({ to }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    notificationsApi
      .list()
      .then((response) => setCount(response.data.unread_count))
      .catch(() => setCount(0));
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <Link to={to} className="notification-bell" aria-label="Open notifications">
      <span className="notification-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="notification-icon-svg">
          <path
            d="M12 3a4 4 0 0 0-4 4v1.2c0 .9-.3 1.8-.8 2.5L5.8 13c-.7 1-.2 2.4 1 2.7l.7.2h9l.7-.2c1.2-.3 1.7-1.7 1-2.7l-1.4-2.3a4.5 4.5 0 0 1-.8-2.5V7a4 4 0 0 0-4-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.8 18a2.4 2.4 0 0 0 4.4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {count > 0 ? <strong className="notification-count">{count}</strong> : null}
    </Link>
  );
}
