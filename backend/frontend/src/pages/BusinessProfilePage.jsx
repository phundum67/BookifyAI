import { useEffect, useState } from "react";

import { businessApi } from "../api";
import { GalleryUpload, ImageUploadBox } from "../components/ImageUploadBox";
import { categories, sportsSubcategories, weekdays } from "../data/categories";
import { currencyOptions, getCurrencyByCode } from "../data/currencies";
import { timeOptions } from "../utils/time";

const defaultForm = {
  name: "",
  display_tag: "",
  category: "",
  subcategory: "",
  custom_category: "",
  location: "",
  phone: "",
  description: "",
  price_per_hour: "",
  currency: "INR",
  currency_code: "INR",
  currency_symbol: "₹",
  min_booking_hours: 1,
  max_booking_hours: "",
  buffer_time_between_slots: 0,
  image_url: "",
  profile_image: "",
  gallery_images: [],
  opening_time: "09:00",
  closing_time: "18:00",
  closed_days: [],
  is_booking_active: true,
  is_active: true,
};

export default function BusinessProfilePage() {
  const [business, setBusiness] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [displayTagError, setDisplayTagError] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validateDisplayTag = (value) => {
    if (!value) {
      return "Display tag is required.";
    }
    if (!/^#\d{4}$/.test(value)) {
      return "Use exactly 4 digits, like #1234.";
    }
    return "";
  };

  const loadMine = async () => {
    try {
      const response = await businessApi.mine();
      const record = response.data.business;
      setBusiness(record);
      if (record) {
        setForm({
          ...defaultForm,
          ...record,
          gallery_images: record.gallery_images || [],
          closed_days: record.closed_days || [],
        });
        setGalleryText((record.gallery_images || []).join("\n"));
      }
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  useEffect(() => {
    loadMine();
  }, []);

  const handleChange = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleDisplayTagChange = (value) => {
    const hasInvalidCharacters = /[^#\d]/.test(value);
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted = digits ? `#${digits}` : value.startsWith("#") ? "#" : "";
    setForm((previous) => ({ ...previous, display_tag: formatted }));

    if (hasInvalidCharacters) {
      setDisplayTagError("Only numbers are allowed after #.");
      return;
    }
    if (digits.length > 0 && digits.length < 4) {
      setDisplayTagError("Use exactly 4 digits.");
      return;
    }
    setDisplayTagError(validateDisplayTag(formatted));
  };

  const handleCurrencyChange = (code) => {
    const currency = getCurrencyByCode(code);
    setForm((previous) => ({
      ...previous,
      currency: currency.code,
      currency_code: currency.code,
      currency_symbol: currency.symbol,
    }));
  };

  const handleMainImageChange = (value) => {
    setForm((previous) => ({
      ...previous,
      image_url: value,
      profile_image: value,
    }));
  };

  const handleGalleryChange = (values) => {
    setForm((previous) => ({ ...previous, gallery_images: values }));
    setGalleryText(values.join("\n"));
  };

  const toggleClosedDay = (value) => {
    setForm((previous) => ({
      ...previous,
      closed_days: previous.closed_days.includes(value)
        ? previous.closed_days.filter((day) => day !== value)
        : [...previous.closed_days, value],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.name || !form.display_tag || !form.category || !form.location || !form.phone || !form.description) {
      setError("Please fill in the required business fields.");
      return;
    }
    const tagError = validateDisplayTag(form.display_tag);
    if (tagError) {
      setDisplayTagError(tagError);
      setError("Please fix the display tag.");
      return;
    }
    if (!form.currency_code) {
      setError("Please select a currency.");
      return;
    }
    if (form.opening_time >= form.closing_time) {
      setError("Opening time must be before closing time.");
      return;
    }

    const payload = {
      ...form,
      gallery_images: galleryText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      if (business) {
        await businessApi.update(business.id, payload);
        setMessage("Business profile updated.");
      } else {
        await businessApi.create(payload);
        setMessage("Business profile created.");
      }
      await loadMine();
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <section className="card stack">
        <div className="section-heading">
          <h2>{business ? "Edit business profile" : "Create business profile"}</h2>
        </div>
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <div className="filter-grid">
          <label className="field">
            <span>Business name</span>
            <input value={form.name} onChange={(event) => handleChange("name", event.target.value)} />
          </label>
          <label className="field">
            <span>Display tag / ID</span>
            <input
              className={displayTagError ? "input-invalid" : ""}
              value={form.display_tag}
              onChange={(event) => handleDisplayTagChange(event.target.value)}
              onBlur={() => setDisplayTagError(validateDisplayTag(form.display_tag))}
              placeholder="Example: #1234, #2323"
              inputMode="numeric"
              maxLength={5}
            />
            {displayTagError ? <small className="field-error">{displayTagError}</small> : null}
          </label>
          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => handleChange("category", event.target.value)}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          {form.category === "Sports & Turf" ? (
            <label className="field">
              <span>Subcategory</span>
              <select value={form.subcategory || ""} onChange={(event) => handleChange("subcategory", event.target.value)}>
                <option value="">Select subcategory</option>
                {sportsSubcategories.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Custom category</span>
            <input value={form.custom_category || ""} onChange={(event) => handleChange("custom_category", event.target.value)} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={(event) => handleChange("location", event.target.value)} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={(event) => handleChange("phone", event.target.value)} />
          </label>
          <label className="field">
            <span>Price per hour</span>
            <input type="number" value={form.price_per_hour || ""} onChange={(event) => handleChange("price_per_hour", event.target.value)} />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={form.currency_code || form.currency || "INR"} onChange={(event) => handleCurrencyChange(event.target.value)}>
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Min booking hours</span>
            <input type="number" min="1" value={form.min_booking_hours} onChange={(event) => handleChange("min_booking_hours", event.target.value)} />
          </label>
          <label className="field">
            <span>Max booking hours</span>
            <input type="number" min="1" value={form.max_booking_hours || ""} onChange={(event) => handleChange("max_booking_hours", event.target.value)} />
          </label>
          <label className="field">
            <span>Buffer time between slots (minutes)</span>
            <input type="number" min="0" value={form.buffer_time_between_slots} onChange={(event) => handleChange("buffer_time_between_slots", event.target.value)} />
          </label>
          <label className="field">
            <span>Opening time</span>
            <select value={form.opening_time} onChange={(event) => handleChange("opening_time", event.target.value)}>
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Closing time</span>
            <select value={form.closing_time} onChange={(event) => handleChange("closing_time", event.target.value)}>
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="upload-section-grid">
          <ImageUploadBox label="Business cover image" value={form.image_url || form.profile_image || ""} onChange={handleMainImageChange} />
          <GalleryUpload label="Gallery images and videos" values={form.gallery_images || []} onChange={handleGalleryChange} />
        </div>

        <label className="field">
          <span>Short description</span>
          <textarea value={form.description} onChange={(event) => handleChange("description", event.target.value)} />
        </label>

        <div className="field">
          <span>Closed days</span>
          <div className="checkbox-grid">
            {weekdays.map((day) => (
              <label key={day.value} className="check-item">
                <input
                  type="checkbox"
                  checked={form.closed_days.includes(day.value)}
                  onChange={() => toggleClosedDay(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="check-item">
            <input
              type="checkbox"
              checked={form.is_booking_active}
              onChange={(event) => handleChange("is_booking_active", event.target.checked)}
            />
            Booking active
          </label>
          <label className="check-item">
            <input type="checkbox" checked={form.is_active} onChange={(event) => handleChange("is_active", event.target.checked)} />
            Business active
          </label>
        </div>

        <button className="button" type="submit">
          {business ? "Save changes" : "Create business"}
        </button>
      </section>
    </form>
  );
}
