import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { bookingsApi, businessApi, favoritesApi, reviewsApi, slotsApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { getBusinessGallery, getBusinessPrimaryImage, isVideoSource } from "../utils/businessMedia";
import { formatBusinessPrice } from "../utils/currency";
import { addHours, formatTime, formatTimeRange } from "../utils/time";

const todayString = new Date().toISOString().slice(0, 10);

function formatClosedDays(days = []) {
  if (!days.length) return "No regular closed days listed";
  return days.map((day) => `${day.slice(0, 1).toUpperCase()}${day.slice(1)}`).join(", ");
}

export default function BusinessDetailPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewEligible, setReviewEligible] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, review_text: "" });
  const [bookingForm, setBookingForm] = useState({ customer_name: "", customer_email: "", customer_phone: "" });
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadBusiness = async () => {
    try {
      const response = await businessApi.get(businessId);
      setBusiness(response.data.business);
      const viewed = JSON.parse(localStorage.getItem("recentBusinesses") || "[]");
      const nextViewed = [response.data.business, ...viewed.filter((item) => item.id !== response.data.business.id)].slice(0, 5);
      localStorage.setItem("recentBusinesses", JSON.stringify(nextViewed));
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const loadSlots = async (date) => {
    try {
      const response = await slotsApi.list(businessId, date);
      setSlots(response.data.slots || []);
      setBookingMessage(response.data.slots?.length ? "" : response.message);
    } catch (apiError) {
      setBookingMessage(apiError.errors?.[0] || apiError.message);
      setSlots([]);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await reviewsApi.list(businessId);
      setReviews(response.data.reviews || []);
    } catch (apiError) {
      setReviewError(apiError.errors?.[0] || apiError.message);
    }
  };

  useEffect(() => {
    loadBusiness();
    loadReviews();
  }, [businessId]);

  useEffect(() => {
    loadSlots(selectedDate);
    setSelectedStartTime("");
    setIsConfirming(false);
  }, [selectedDate, businessId]);

  useEffect(() => {
    if (user) {
      setBookingForm({
        customer_name: user.name || "",
        customer_email: user.email || "",
        customer_phone: user.phone || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (user?.account_type === "Customer") {
      businessApi
        .availabilityCheck(businessId)
        .then((response) => setReviewEligible(response.data.eligible))
        .catch(() => setReviewEligible(false));
    }
  }, [businessId, user]);

  const toggleFavorite = async () => {
    setError("");
    setActionMessage("");
    if (!user || user.account_type !== "Customer") {
      setError("Only logged-in Customer accounts can save businesses.");
      return;
    }
    try {
      setIsSavingFavorite(true);
      if (business.is_favorite) {
        await favoritesApi.remove(business.id);
        setBusiness((previous) => ({ ...previous, is_favorite: false }));
        setActionMessage("Removed from saved businesses.");
      } else {
        await favoritesApi.add(business.id);
        setBusiness((previous) => ({ ...previous, is_favorite: true }));
        setActionMessage("Saved to your businesses.");
      }
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    } finally {
      setIsSavingFavorite(false);
    }
  };

  const handleShare = async () => {
    setError("");
    setActionMessage("");
    const shareUrl = window.location.href;
    const shareData = {
      title: business.name,
      text: `View ${business.name} on Smart Booking.`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Business link copied.");
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setError("Could not share this business right now.");
      }
    }
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    setError("");
    setBookingSuccess(null);
    if (!user || user.account_type !== "Customer") {
      setError("Only Customer accounts can create bookings.");
      return;
    }
    if (!selectedStartTime) {
      setError("Please select a start slot.");
      return;
    }
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    try {
      const response = await bookingsApi.create({
        business_id: Number(businessId),
        slot_date: selectedDate,
        start_time: selectedStartTime,
        duration_hours: Number(durationHours),
        ...bookingForm,
      });
      setBookingSuccess(response.data.booking);
      setBookingMessage(response.message);
      setSelectedStartTime("");
      setIsConfirming(false);
      await loadSlots(selectedDate);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message || "That slot is no longer available. Please choose another slot.");
      setIsConfirming(false);
      await loadSlots(selectedDate);
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewError("");
    try {
      await reviewsApi.create(businessId, {
        rating: Number(reviewForm.rating),
        review_text: reviewForm.review_text,
      });
      setReviewForm({ rating: 5, review_text: "" });
      await loadReviews();
      await loadBusiness();
    } catch (apiError) {
      setReviewError(apiError.errors?.[0] || apiError.message);
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/customer/home");
  };

  if (error && !business) {
    return (
      <div className="screen-center">
        <div className="card stack">
          <div className="alert error">{error}</div>
          <Link className="button" to="/">
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  if (!business) {
    return <div className="screen-center">Loading business details...</div>;
  }

  const businessImages = getBusinessGallery(business);
  const previewMedia = businessImages.slice(0, 2);
  const remainingMediaCount = Math.max(businessImages.length - previewMedia.length, 0);
  const primaryMedia = getBusinessPrimaryImage(business);
  const selectedEndTime = addHours(selectedStartTime, durationHours);
  const reviewPreview = reviews.slice(0, 3);
  const selectedIndex = slots.findIndex((slot) => slot.start_time === selectedStartTime);
  const selectedRangeIds =
    selectedIndex >= 0 ? slots.slice(selectedIndex, selectedIndex + Number(durationHours || 1)).map((slot) => slot.id) : [];

  return (
    <div className="page-wrap stack detail-page-v2">
      <section className="detail-cover-card">
        <div className="detail-cover-media">
          <button className="detail-back-button" type="button" onClick={handleGoBack} aria-label="Go back">
            &lt;
          </button>
          {isVideoSource(primaryMedia) ? (
            <video className="detail-cover-photo" src={primaryMedia} muted playsInline preload="metadata" />
          ) : (
            <img className="detail-cover-photo" src={primaryMedia} alt={`${business.name} banner`} />
          )}
          <div className="detail-cover-actions">
            <button className="detail-icon-button" type="button" onClick={toggleFavorite}>
              {isSavingFavorite ? "Saving" : business.is_favorite ? "Saved" : "Save"}
            </button>
            <button className="detail-icon-button" type="button" onClick={handleShare}>
              Share
            </button>
          </div>
        </div>
        <div className="detail-cover-content">
          <div className="business-card-topline">
            <span className="badge">{business.category}</span>
            {business.subcategory ? <span className="badge">{business.subcategory}</span> : null}
            {business.is_featured ? <span className="badge badge-solid">Featured</span> : null}
          </div>
          <h1>{business.name}</h1>
          <p className="muted">{business.location}</p>
          <div className="detail-price-row">
            <strong>{formatBusinessPrice(business)}</strong>
            <span className="muted">{business.average_rating || 0} average rating</span>
          </div>
        </div>
      </section>

      {businessImages.length > 1 ? (
        <section className={`detail-media-preview ${remainingMediaCount > 0 ? "has-more" : ""}`} aria-label="Business photos and videos">
          {previewMedia.map((media, index) => (
            <button
              key={`${media}-${index}`}
              className="detail-media-tile"
              type="button"
              onClick={() => setIsGalleryOpen(true)}
              aria-label={`Open ${business.name} media gallery`}
            >
              {isVideoSource(media) ? (
                <>
                  <video src={media} muted playsInline preload="metadata" />
                  <span className="media-type-badge">Video</span>
                </>
              ) : (
                <img src={media} alt={`${business.name} gallery ${index + 1}`} />
              )}
              {remainingMediaCount > 0 && index === 1 ? (
                <span className="detail-media-count-overlay">+{remainingMediaCount}</span>
              ) : null}
            </button>
          ))}
        </section>
      ) : null}

      {isGalleryOpen ? (
        <div className="media-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`${business.name} media gallery`}>
          <section className="media-viewer-panel">
            <div className="media-viewer-header">
              <div>
                <p className="eyebrow">Gallery</p>
                <h2>{business.name}</h2>
              </div>
              <button className="media-viewer-close" type="button" onClick={() => setIsGalleryOpen(false)} aria-label="Close gallery">
                &times;
              </button>
            </div>
            <div className="media-viewer-grid">
              {businessImages.map((media, index) => (
                <div key={`${media}-viewer-${index}`} className="media-viewer-item">
                  {isVideoSource(media) ? (
                    <video src={media} controls playsInline preload="metadata" />
                  ) : (
                    <img src={media} alt={`${business.name} media ${index + 1}`} />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}
      {actionMessage ? <div className="alert success">{actionMessage}</div> : null}
      {bookingSuccess ? (
        <section className="card stack success-card">
          <p className="eyebrow">Booking confirmed</p>
          <h2>{business.name}</h2>
          <p>
            {bookingSuccess.slot_date} | {formatTimeRange(bookingSuccess.start_time, bookingSuccess.end_time)}
          </p>
          <span className={`status-badge status-${bookingSuccess.status}`}>{bookingSuccess.status}</span>
        </section>
      ) : null}
      {bookingMessage && !bookingSuccess ? <div className="alert success">{bookingMessage}</div> : null}

      <section className="card stack detail-info-card">
        <div className="section-heading">
          <h2>About this place</h2>
        </div>
        <p>{business.description}</p>
        <div className="detail-grid">
          <span className="detail-stat">Phone: {business.phone}</span>
          <span className="detail-stat">
            Hours: {formatTimeRange(business.opening_time, business.closing_time)}
          </span>
          <span className="detail-stat">Closed: {formatClosedDays(business.closed_days)}</span>
          <span className="detail-stat">
            Duration: {business.min_booking_hours || 1}h min{business.max_booking_hours ? `, ${business.max_booking_hours}h max` : ""}
          </span>
        </div>
      </section>

      <section className="card stack detail-rules-card">
        <div className="section-heading">
          <h2>Booking rules</h2>
          <span className="badge badge-solid">Instant booking</span>
        </div>
        <p className="muted">Bookings are confirmed instantly when the selected time is available. Please contact the business directly if your plans change.</p>
      </section>

      <section className="two-column detail-columns">
        <div className="card stack booking-panel">
          <div className="section-heading">
            <h2>Available slots</h2>
          </div>
          <label className="field">
            <span>Date</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
          <div className="slot-grid slot-grid-v2">
            {slots.map((slot) => (
              <button
                key={slot.id}
                className={`slot-button slot-button-v2 ${selectedStartTime === slot.start_time ? "active" : ""} ${
                  selectedRangeIds.includes(slot.id) ? "in-selected-range" : ""
                } ${slot.status !== "available" ? "is-unavailable" : ""}`}
                onClick={() => {
                  setSelectedStartTime(slot.start_time);
                  setIsConfirming(false);
                }}
                disabled={slot.status !== "available"}
                type="button"
              >
                <strong>{formatTime(slot.start_time)}</strong>
                <span>{formatTime(slot.end_time)}</span>
              </button>
            ))}
          </div>
          {!slots.length ? <p className="muted">No slots available for this date. Please choose another date.</p> : null}
        </div>

        <form className="card stack booking-panel" onSubmit={handleBooking}>
          <div className="section-heading">
            <h2>Book now</h2>
          </div>
          <label className="field">
            <span>Duration in hours</span>
            <input
              type="number"
              min={business.min_booking_hours || 1}
              max={business.max_booking_hours || 12}
              value={durationHours}
              onChange={(event) => {
                setDurationHours(event.target.value);
                setIsConfirming(false);
              }}
            />
          </label>
          <div className="booking-summary-card">
            <span className="muted small-text">Selected booking</span>
            <strong>{selectedStartTime ? `${selectedDate}, ${formatTimeRange(selectedStartTime, selectedEndTime)}` : "Choose a slot to see the summary"}</strong>
            <span>{durationHours || 1} hour(s)</span>
          </div>
          <label className="field">
            <span>Name</span>
            <input value={bookingForm.customer_name} onChange={(event) => setBookingForm((previous) => ({ ...previous, customer_name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={bookingForm.customer_email} onChange={(event) => setBookingForm((previous) => ({ ...previous, customer_email: event.target.value }))} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={bookingForm.customer_phone} onChange={(event) => setBookingForm((previous) => ({ ...previous, customer_phone: event.target.value }))} />
          </label>
          {isConfirming ? (
            <div className="booking-confirm-box">
              <strong>Review before confirming</strong>
              <p className="muted small-text">We will reserve your selected time instantly if it is still available.</p>
            </div>
          ) : null}
          <button className="button" type="submit">
            {isConfirming ? "Confirm booking" : "Review booking"}
          </button>
        </form>
      </section>

      <section className="card stack review-section-v2">
        <div className="section-heading">
          <div>
            <h2>Reviews</h2>
            <p className="muted small-text">{business.average_rating || 0} average rating from {business.review_count || reviews.length} review(s)</p>
          </div>
        </div>
        {reviewError ? <div className="alert error">{reviewError}</div> : null}
        <div className="review-preview-grid">
          {reviewPreview.length ? (
            reviewPreview.map((review) => (
              <article key={review.id} className="review-item review-card-v2">
                <div className="section-heading">
                  <strong>{review.user_name}</strong>
                  <span className="badge">{review.rating} / 5</span>
                </div>
                <p>{review.review_text}</p>
                <span className="muted small-text">{new Date(review.created_at).toLocaleDateString()}</span>
              </article>
            ))
          ) : (
            <p className="muted">No reviews yet. Reviews from booked customers will appear here.</p>
          )}
        </div>
        {user?.account_type === "Customer" ? (
          <form className="review-form" onSubmit={handleReviewSubmit}>
            <label className="field">
              <span>Rating</span>
              <select value={reviewForm.rating} onChange={(event) => setReviewForm((previous) => ({ ...previous, rating: event.target.value }))}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} star{value > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Review</span>
              <textarea
                value={reviewForm.review_text}
                onChange={(event) => setReviewForm((previous) => ({ ...previous, review_text: event.target.value }))}
                placeholder={reviewEligible ? "Share a short review" : "You need a booking for this business to review it."}
                disabled={!reviewEligible}
              />
            </label>
            <button className="button" type="submit" disabled={!reviewEligible}>
              Submit review
            </button>
          </form>
        ) : (
          <p className="muted">Log in as a Customer account to save this business, book it, or leave a review.</p>
        )}
      </section>
    </div>
  );
}
