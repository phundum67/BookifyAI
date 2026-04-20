import { Link } from "react-router-dom";

export default function WelcomePage() {
  return (
    <div className="screen-center welcome-screen">
      <div className="hero-card">
        <p className="eyebrow">Smart booking platform</p>
        <h1>Book local businesses without waiting for manual confirmations.</h1>
        <p className="hero-copy">
          Browse turfs, karaoke rooms, pools, resorts, salons, rentals, and more through one clean booking experience.
        </p>
        <div className="hero-actions">
          <Link to="/login" className="button">
            Login
          </Link>
          <Link to="/signup" className="button button-secondary">
            Signup
          </Link>
        </div>
      </div>
    </div>
  );
}
