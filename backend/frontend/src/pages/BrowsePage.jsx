import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { businessApi } from "../api";
import BusinessCard from "../components/BusinessCard";
import { categories } from "../data/categories";

const priceRanges = [
  { label: "All prices", value: "" },
  { label: "Below 1000", value: "below-1000" },
  { label: "1000 to 1500", value: "1000-1500" },
  { label: "1500 to 2000", value: "1500-2000" },
  { label: "Above 2000", value: "above-2000" },
];

export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    category: searchParams.get("category") || "",
    location: "",
    priceRange: "",
  });
  const [businesses, setBusinesses] = useState([]);
  const [error, setError] = useState("");

  const loadBusinesses = async () => {
    const query = new URLSearchParams();
    if (filters.search) query.set("search", filters.search);
    if (filters.category) query.set("category", filters.category);
    if (filters.location) query.set("location", filters.location);

    try {
      const response = await businessApi.list(query.toString() ? `?${query.toString()}` : "");
      setBusinesses(response.data.businesses || []);
      setError("");
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    loadBusinesses();
  };

  const visibleBusinesses = businesses
    .filter((business) => {
      if (!filters.priceRange || business.price_per_hour == null) {
        return true;
      }

      if (filters.priceRange === "below-1000") {
        return business.price_per_hour < 1000;
      }

      if (filters.priceRange === "1000-1500") {
        return business.price_per_hour >= 1000 && business.price_per_hour <= 1500;
      }

      if (filters.priceRange === "1500-2000") {
        return business.price_per_hour >= 1500 && business.price_per_hour <= 2000;
      }

      if (filters.priceRange === "above-2000") {
        return business.price_per_hour > 2000;
      }

      return true;
    })
    .sort((first, second) => Number(second.is_featured) - Number(first.is_featured));

  return (
    <div className="stack">
      <section className="card stack browse-top-card">
        <div className="section-heading browse-topbar">
          <h2>Browse</h2>
          <Link className="section-link" to="/customer/categories">
            All categories
          </Link>
        </div>
        <form className="browse-filter-form" onSubmit={handleSubmit}>
          <div className="browse-filter-row browse-filter-row-primary">
            <label className="field browse-inline-field browse-search-field">
              <span className="sr-only">Search by name</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
                placeholder="Search businesses"
              />
            </label>
            <label className="field browse-inline-field browse-select-field">
              <span className="sr-only">Category</span>
              <select
                value={filters.category}
                onChange={(event) => setFilters((previous) => ({ ...previous, category: event.target.value }))}
              >
                <option value="">Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="browse-filter-row browse-filter-row-secondary">
            <label className="field browse-inline-field browse-location-field">
              <span className="sr-only">Location</span>
              <input
                value={filters.location}
                onChange={(event) => setFilters((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="Location"
              />
            </label>
            <button className="button browse-submit-button" type="submit">
              Search
            </button>
          </div>
        </form>
        <div className="filter-chip-row">
          {priceRanges.map((range) => (
            <button
              key={range.value || "all"}
              className={`filter-chip ${filters.priceRange === range.value ? "active" : ""}`}
              type="button"
              onClick={() => setFilters((previous) => ({ ...previous, priceRange: range.value }))}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="browse-category-bar">
          <button
            className="button button-secondary compact-button browse-chip-toggle"
            type="button"
            onClick={() => setCategoriesExpanded((previous) => !previous)}
          >
            {categoriesExpanded ? "Show less" : "Show more"}
          </button>
        </div>
        <div className={`category-list browse-chip-list ${categoriesExpanded ? "is-expanded" : "is-collapsed"}`}>
          {categories.map((category) => (
            <button
              key={category}
              className={`category-item browse-category-chip ${filters.category === category ? "active" : ""}`}
              type="button"
              onClick={() => setFilters((previous) => ({ ...previous, category: previous.category === category ? "" : category }))}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid browse-results-grid">
        {visibleBusinesses.map((business) => (
          <BusinessCard key={business.id} business={business} compact />
        ))}
      </div>
      {!visibleBusinesses.length && !error ? (
        <div className="card empty-state-card">
          <h3>No businesses found</h3>
          <p className="muted">Try a different category, location, or price range.</p>
        </div>
      ) : null}
    </div>
  );
}
