import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { businessApi } from "../api";
import BusinessCard from "../components/BusinessCard";
import { categories } from "../data/categories";

export default function CustomerHomePage() {
  const [featured, setFeatured] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [error, setError] = useState("");
  const previewCategories = categories.slice(0, 6);

  useEffect(() => {
    businessApi
      .list()
      .then((response) => {
        const businesses = response.data.businesses || [];
        setFeatured(businesses.filter((item) => item.is_featured).slice(0, 4));
      })
      .catch((apiError) => setError(apiError.errors?.[0] || apiError.message));

    const storedViewed = JSON.parse(localStorage.getItem("recentBusinesses") || "[]");
    setRecentlyViewed(storedViewed.slice(0, 3));
  }, []);

  return (
    <div className="stack customer-home">
      <section className="card hero-strip home-hero">
        <div className="stack compact-stack home-hero-copy">
          <p className="eyebrow">Fast local bookings</p>
          <h2 className="home-hero-title">Book nearby businesses in a few taps</h2>
          <p className="home-hero-text">Search quickly, jump into categories, and book businesses with live slots without waiting around.</p>
        </div>
      </section>

      <section className="quick-actions-grid">
        <Link className="card quick-action-card" to="/customer/browse">
          <p className="eyebrow">Quick action</p>
          <h3>Browse businesses</h3>
          <p className="muted">Search by name, category, location, and price range.</p>
        </Link>
        <Link className="card quick-action-card ai-highlight-card" to="/customer/browse">
          <p className="eyebrow">Popular searches</p>
          <h3>Find places faster</h3>
          <ul className="plain-list compact-list">
            <li>Sports venues nearby</li>
            <li>Karaoke rooms tonight</li>
          </ul>
        </Link>
      </section>

      <section className="stack compact-section home-section">
        <div className="section-heading home-section-heading">
          <h2>Categories</h2>
          <Link className="section-link" to="/customer/categories">
            Browse categories
          </Link>
        </div>
        <div className="category-preview-grid">
          {previewCategories.map((category) => (
            <Link key={category} className="category-preview-item" to={`/customer/browse?category=${encodeURIComponent(category)}`}>
              <span>{category}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="stack compact-section home-section">
        <div className="section-heading home-section-heading">
          <h2>Featured</h2>
          <Link className="section-link" to="/customer/browse">
            See all
          </Link>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="featured-grid">
          {featured.map((business) => (
            <BusinessCard key={business.id} business={business} compact />
          ))}
        </div>
      </section>

      <section className="stack compact-section home-section">
        <div className="section-heading home-section-heading">
          <h2>Recently viewed</h2>
        </div>
        {recentlyViewed.length ? (
          <div className="recent-grid">
            {recentlyViewed.map((business) => (
              <BusinessCard key={business.id} business={business} compact />
            ))}
          </div>
        ) : (
          <div className="card compact-note-card">
            <h3>No recently viewed places</h3>
            <p className="muted">Open a business to keep it handy for your next visit.</p>
          </div>
        )}
      </section>
    </div>
  );
}
