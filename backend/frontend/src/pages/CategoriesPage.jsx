import { Link } from "react-router-dom";

import { categories } from "../data/categories";

export default function CategoriesPage() {
  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Browse categories</p>
            <h2>Find the kind of business you want faster</h2>
          </div>
          <Link className="button button-secondary compact-button" to="/customer/browse">
            Open browse
          </Link>
        </div>
        <p className="muted">Pick a category to jump into Browse with the filter already applied.</p>
        <div className="category-preview-grid category-browser-grid">
          {categories.map((category) => (
            <Link key={category} className="category-preview-item category-browser-item" to={`/customer/browse?category=${encodeURIComponent(category)}`}>
              <span>{category}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
