import { Link } from "react-router-dom";
import { getBusinessPrimaryImage } from "../utils/businessMedia";
import { formatBusinessPrice } from "../utils/currency";

export default function BusinessCard({ business, compact = false }) {
  const cardImage = getBusinessPrimaryImage(business);

  return (
    <article className={`card business-card ${compact ? "compact compact-business-card" : ""}`}>
      <div className="business-card-image">
        <img className="business-card-photo" src={cardImage} alt={`${business.name} cover`} />
        <span className="image-placeholder-chip">{business.is_featured ? "Featured" : "Ready to book"}</span>
      </div>
      <div className="business-card-body">
        <div className="business-card-topline">
          <span className="badge business-category-chip">{business.category}</span>
        </div>
        <div className="business-card-heading">
          <h3>{business.name}</h3>
          <p className="muted">{business.location}</p>
        </div>
        <div className="card-meta business-card-meta">
          <span className="meta-pill">
            {business.average_rating ? `${business.average_rating} stars` : "No ratings yet"}
          </span>
          <span className="meta-pill">{formatBusinessPrice(business, "/hr")}</span>
        </div>
        <div className="business-card-footer">
          <Link className="button button-secondary card-action" to={`/businesses/${business.id}`}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
