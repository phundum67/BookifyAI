import { useNavigate } from "react-router-dom";

import NotificationBell from "./NotificationBell";

export default function AppHeader({ eyebrow, title, notificationTo, showBack = true, fallbackTo = "/" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo);
  };

  return (
    <header className="app-header unified-app-header">
      <div className="app-header-left">
        {showBack ? (
          <button className="app-back-button" type="button" onClick={handleBack} aria-label="Go back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        <div className="customer-brand app-header-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      <NotificationBell to={notificationTo} />
    </header>
  );
}
