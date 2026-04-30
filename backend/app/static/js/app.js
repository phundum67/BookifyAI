(function () {
  const API_BASE = "/api";
  const TOKEN_KEY = "bookingAuthToken";
  const page = document.body.dataset.page;
  const currentUser = readJson("app-user");

  const categories = [
    "Barber Shop",
    "Bike Rental",
    "Camping",
    "Car Rental",
    "Event Hall",
    "Gaming Zone",
    "Gym",
    "Hotel",
    "Karaoke",
    "Photography Studio",
    "Pool",
    "Resort",
    "Restaurant",
    "Salon",
    "Sound",
    "Spa",
    "Sports & Turf",
  ];

  const sportsSubcategories = ["Badminton", "Basketball", "Volleyball", "Turf"];
  const currencies = [
    ["INR", "INR"],
    ["USD", "USD"],
    ["EUR", "EUR"],
    ["GBP", "GBP"],
    ["AUD", "AUD"],
    ["CAD", "CAD"],
  ];

  const priceRanges = [
    { label: "All prices", value: "all" },
    { label: "Below 1000", value: "below-1000", min: 0, max: 999 },
    { label: "1000 to 1500", value: "1000-1500", min: 1000, max: 1500 },
    { label: "1500 to 2000", value: "1500-2000", min: 1500, max: 2000 },
    { label: "Above 2000", value: "above-2000", min: 2001 },
  ];

  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='600'%3E%3Crect width='900' height='600' fill='%23ddd6cc'/%3E%3Cpath d='M180 420h540L560 250 455 360l-70-76z' fill='%23f5efe6'/%3E%3Ccircle cx='305' cy='220' r='54' fill='%23faf7f2'/%3E%3C/svg%3E";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    attachGlobalHandlers();
    refreshNotificationBadge();

    const handlers = {
      landing: null,
      login: initAuth,
      signup: initAuth,
      role: initRole,
      "customer-home": initCustomerHome,
      browse: initBrowse,
      "customer-bookings": initCustomerBookings,
      "customer-settings": initCustomerSettings,
      "business-detail": initBusinessDetail,
      "business-dashboard": initBusinessDashboard,
      "business-profile": initBusinessProfile,
      "business-slots": initBusinessSlots,
      "business-bookings": initBusinessBookings,
      "business-settings": initBusinessSettings,
    };

    if (handlers[page]) {
      handlers[page]();
    }
  }

  function readJson(id) {
    const node = document.getElementById(id);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (_error) {
      return null;
    }
  }

  async function api(path, options = {}) {
    const headers = options.headers || {};
    const token = localStorage.getItem(TOKEN_KEY);
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = { message: "Something went wrong.", errors: ["Server did not return JSON."] };
    }

    if (!response.ok) {
      const detail = payload.errors && payload.errors.length ? payload.errors.join(" ") : payload.message;
      throw new Error(detail || "Request failed.");
    }

    if (payload.data && payload.data.token) {
      localStorage.setItem(TOKEN_KEY, payload.data.token);
    }
    return payload;
  }

  function attachGlobalHandlers() {
    document.querySelectorAll("[data-notification-button]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const payload = await api("/notifications");
          const notices = payload.data.notifications || [];
          if (!notices.length) {
            toast("No notifications yet.");
            return;
          }
          toast(notices[0].title);
          if (!notices[0].is_read) {
            await api(`/notifications/${notices[0].id}/read`, { method: "PATCH", body: {} });
            refreshNotificationBadge();
          }
        } catch (error) {
          toast(error.message);
        }
      });
    });

    document.querySelectorAll("#logout-button").forEach((button) => {
      button.addEventListener("click", logout);
    });
  }

  async function refreshNotificationBadge() {
    const badge = document.querySelector("[data-unread-badge]");
    if (!badge || !currentUser) return;
    try {
      const payload = await api("/notifications");
      const count = payload.data.unread_count || 0;
      badge.textContent = count;
      badge.hidden = count === 0;
    } catch (_error) {
      badge.hidden = true;
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch (_error) {
      // Token fallback may already be stale. Clear local state either way.
    }
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/";
  }

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      node.hidden = true;
    }, 3000);
  }

  function setError(id, message) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
  }

  function formatTime(value) {
    if (!value) return "";
    const [hourText, minute = "00"] = value.split(":");
    let hour = Number(hourText);
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
  }

  function to24Hour(value) {
    return value;
  }

  function formatDate(value) {
    if (!value) return "";
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatPrice(business, valueOverride) {
    const price = valueOverride !== undefined ? valueOverride : business && business.price_per_hour;
    if (price === null || price === undefined || price === "") return "Price on request";
    const symbol = (business && business.currency_symbol) || "";
    const code = (business && business.currency_code) || (business && business.currency) || "";
    return `${symbol || code} ${Number(price).toLocaleString()} / hour`.trim();
  }

  function imageFor(business) {
    return business.image_url || business.profile_image || (business.gallery_images && business.gallery_images[0]) || fallbackImage;
  }

  function isVideo(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || "");
  }

  function mediaTag(url, alt) {
    if (isVideo(url)) {
      return `<video src="${escapeAttr(url)}" muted playsinline controls></video>`;
    }
    return `<img src="${escapeAttr(url || fallbackImage)}" alt="${escapeAttr(alt || "Business image")}" loading="lazy">`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function renderChips(container, items, selected, onClick) {
    if (!container) return;
    container.innerHTML = items
      .map((item) => {
        const label = typeof item === "string" ? item : item.label;
        const value = typeof item === "string" ? item : item.value;
        return `<button class="chip ${selected === value ? "active" : ""}" data-chip="${escapeAttr(value)}" type="button">${escapeHtml(label)}</button>`;
      })
      .join("");
    container.querySelectorAll("[data-chip]").forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.chip));
    });
  }

  function renderBusinessCard(business) {
    const rating = business.average_rating ? `${business.average_rating} stars` : "No ratings yet";
    return `
      <article class="business-card">
        <a href="/businesses/${business.id}">
          <div class="business-card-image">
            ${business.is_featured ? '<span class="badge">Featured</span>' : ""}
            <img src="${escapeAttr(imageFor(business))}" alt="${escapeAttr(business.name)}" loading="lazy">
          </div>
        </a>
        <div class="business-card-body">
          <span class="mini-pill">${escapeHtml(business.subcategory || business.category)}</span>
          <h3>${escapeHtml(business.name)}</h3>
          <p class="muted">${escapeHtml(business.location)}</p>
          <div class="meta-row">
            <span class="mini-pill">${escapeHtml(rating)}</span>
            <span class="mini-pill">${escapeHtml(formatPrice(business))}</span>
          </div>
          <a class="btn btn-secondary" href="/businesses/${business.id}">View details</a>
        </div>
      </article>
    `;
  }

  function renderBookingCard(booking, showCustomer) {
    return `
      <article class="booking-card">
        <div class="meta-row">
          <h3>${escapeHtml(showCustomer ? booking.customer_name : booking.business_name)}</h3>
          <span class="status ${escapeAttr(booking.status)}">${escapeHtml(booking.status)}</span>
        </div>
        <p class="muted">${formatDate(booking.slot_date)} · ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</p>
        ${showCustomer ? `<p class="muted">${escapeHtml(booking.customer_phone || "")}</p>` : ""}
        ${booking.status === "confirmed" ? `<button class="btn btn-secondary btn-small" data-cancel-booking="${booking.id}" type="button">Cancel booking</button>` : ""}
      </article>
    `;
  }

  function renderEmpty(message) {
    return `<div class="empty-state small">${escapeHtml(message)}</div>`;
  }

  async function initAuth() {
    const form = document.getElementById("auth-form");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("auth-error", "");
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const path = form.dataset.mode === "signup" ? "/auth/signup" : "/auth/login";
        const payload = await api(path, { method: "POST", body: data });
        const user = payload.data.user;
        if (!user.account_type) {
          window.location.href = "/choose-role";
        } else if (user.account_type === "Business") {
          window.location.href = "/business/dashboard";
        } else {
          window.location.href = "/customer/home";
        }
      } catch (error) {
        setError("auth-error", error.message);
      }
    });
  }

  function initRole() {
    document.querySelectorAll("[data-role-choice]").forEach((button) => {
      button.addEventListener("click", async () => {
        setError("role-error", "");
        try {
          const payload = await api("/auth/role", {
            method: "PATCH",
            body: { account_type: button.dataset.roleChoice },
          });
          window.location.href = payload.data.user.account_type === "Business" ? "/business/dashboard" : "/customer/home";
        } catch (error) {
          setError("role-error", error.message);
        }
      });
    });
  }

  async function initCustomerHome() {
    const categoriesNode = document.getElementById("home-categories");
    renderChips(categoriesNode, categories.slice(0, 8), "", (category) => {
      window.location.href = `/customer/browse?category=${encodeURIComponent(category)}`;
    });

    const container = document.getElementById("featured-businesses");
    try {
      const payload = await api("/businesses?featured=true");
      const businesses = payload.data.businesses || [];
      container.innerHTML = businesses.length
        ? businesses.slice(0, 4).map(renderBusinessCard).join("")
        : renderEmpty("Featured businesses will appear here soon.");
    } catch (error) {
      container.innerHTML = renderEmpty(error.message);
    }
  }

  async function initBrowse() {
    const search = document.getElementById("browse-search");
    const categorySelect = document.getElementById("browse-category");
    const location = document.getElementById("browse-location");
    const results = document.getElementById("browse-results");
    const resultCount = document.getElementById("result-count");
    const categoryGrid = document.getElementById("browse-categories");
    const params = new URLSearchParams(window.location.search);
    let activePrice = "all";
    let allBusinesses = [];

    categorySelect.innerHTML =
      '<option value="">Category</option>' + categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
    search.value = params.get("search") || "";
    categorySelect.value = params.get("category") || "";
    location.value = params.get("location") || "";

    const handlePriceFilter = (value) => {
      activePrice = value;
      renderChips(document.getElementById("price-filters"), priceRanges, activePrice, handlePriceFilter);
      renderResults();
    };
    renderChips(document.getElementById("price-filters"), priceRanges, activePrice, handlePriceFilter);
    renderChips(categoryGrid, categories, categorySelect.value, (category) => {
      categorySelect.value = categorySelect.value === category ? "" : category;
      loadBusinesses();
    });

    document.getElementById("category-toggle").addEventListener("click", () => {
      categoryGrid.classList.toggle("open");
      document.getElementById("category-toggle").textContent = categoryGrid.classList.contains("open") ? "Show less" : "Show more";
    });
    document.getElementById("browse-submit").addEventListener("click", loadBusinesses);
    [search, categorySelect, location].forEach((input) => {
      input.addEventListener("change", loadBusinesses);
    });

    await loadBusinesses();

    async function loadBusinesses() {
      const query = new URLSearchParams();
      if (search.value.trim()) query.set("search", search.value.trim());
      if (categorySelect.value) query.set("category", categorySelect.value);
      if (location.value.trim()) query.set("location", location.value.trim());

      try {
        const payload = await api(`/businesses${query.toString() ? `?${query}` : ""}`);
        allBusinesses = payload.data.businesses || [];
        renderChips(categoryGrid, categories, categorySelect.value, (category) => {
          categorySelect.value = categorySelect.value === category ? "" : category;
          loadBusinesses();
        });
        renderResults();
      } catch (error) {
        results.innerHTML = renderEmpty(error.message);
      }
    }

    function renderResults() {
      const range = priceRanges.find((item) => item.value === activePrice);
      const filtered = allBusinesses.filter((business) => {
        if (!range || range.value === "all") return true;
        const price = Number(business.price_per_hour || 0);
        if (range.min !== undefined && price < range.min) return false;
        if (range.max !== undefined && price > range.max) return false;
        return true;
      });
      resultCount.textContent = `${filtered.length} found`;
      results.innerHTML = filtered.length ? filtered.map(renderBusinessCard).join("") : renderEmpty("No businesses match these filters yet.");
    }
  }

  async function initCustomerBookings() {
    await loadBookings("/bookings/customer", "customer-bookings", false);
  }

  async function initBusinessBookings() {
    await loadBookings("/bookings/business", "business-bookings", true);
  }

  async function loadBookings(path, containerId, showCustomer) {
    const container = document.getElementById(containerId);
    try {
      const payload = await api(path);
      const bookings = payload.data.bookings || [];
      container.innerHTML = bookings.length ? bookings.map((booking) => renderBookingCard(booking, showCustomer)).join("") : renderEmpty("No bookings available yet.");
      container.querySelectorAll("[data-cancel-booking]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            await api(`/bookings/${button.dataset.cancelBooking}/cancel`, { method: "PATCH", body: {} });
            toast("Booking cancelled.");
            loadBookings(path, containerId, showCustomer);
          } catch (error) {
            toast(error.message);
          }
        });
      });
    } catch (error) {
      container.innerHTML = renderEmpty(error.message);
    }
  }

  async function initCustomerSettings() {
    const form = document.getElementById("profile-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("profile-error", "");
      try {
        await api("/auth/profile", { method: "PATCH", body: Object.fromEntries(new FormData(form).entries()) });
        toast("Profile updated.");
      } catch (error) {
        setError("profile-error", error.message);
      }
    });

    const saved = document.getElementById("saved-businesses");
    try {
      const payload = await api("/favorites");
      const businesses = payload.data.businesses || [];
      saved.innerHTML = businesses.length ? businesses.map(renderBusinessCard).join("") : renderEmpty("No saved businesses yet.");
    } catch (error) {
      saved.innerHTML = renderEmpty(error.message);
    }
  }

  async function initBusinessDetail() {
    const id = document.body.dataset.businessId;
    const shell = document.getElementById("business-detail");
    let business;
    let selectedSlot = null;

    try {
      const payload = await api(`/businesses/${id}`);
      business = payload.data.business;
      renderDetail();
      await loadSlots();
    } catch (error) {
      shell.innerHTML = renderEmpty(error.message);
    }

    function renderDetail() {
      const gallery = [imageFor(business), ...(business.gallery_images || [])].filter(Boolean);
      const visibleGallery = gallery.slice(0, 2);
      const remaining = Math.max(gallery.length - 2, 0);
      shell.innerHTML = `
        <div class="detail-hero">
          ${mediaTag(imageFor(business), business.name)}
          <div class="detail-actions">
            <button class="floating-action" onclick="history.back()" aria-label="Back">&lt;</button>
            <div>
              <button id="save-business" class="floating-action" type="button">${business.is_favorite ? "Saved" : "Save"}</button>
              <button id="share-business" class="floating-action" type="button">Share</button>
            </div>
          </div>
        </div>
        <div class="detail-content">
          <section class="card">
            <span class="mini-pill">${escapeHtml(business.subcategory || business.category)}</span>
            <h1>${escapeHtml(business.name)}</h1>
            <p class="muted">${escapeHtml(business.location)}</p>
            <h2>${escapeHtml(formatPrice(business))}</h2>
            <p class="muted">${business.average_rating || 0} average rating</p>
          </section>
          ${
            visibleGallery.length
              ? `<section class="gallery-grid">
                  ${visibleGallery
                    .map((url, index) => `
                      <button class="gallery-tile" data-open-gallery type="button">
                        ${mediaTag(url, business.name)}
                        ${index === visibleGallery.length - 1 && remaining ? `<span class="gallery-more">+${remaining}</span>` : ""}
                      </button>
                    `)
                    .join("")}
                </section>`
              : ""
          }
          <section class="card">
            <h2>About this place</h2>
            <p class="muted">${escapeHtml(business.description)}</p>
            <div class="info-grid">
              <div class="info-tile">Phone: ${escapeHtml(business.phone)}</div>
              <div class="info-tile">Hours: ${formatTime(business.opening_time)} - ${formatTime(business.closing_time)}</div>
              <div class="info-tile">Closed: ${escapeHtml((business.closed_days || []).join(", ") || "None")}</div>
              <div class="info-tile">Duration: ${business.min_booking_hours || 1}h min${business.max_booking_hours ? `, ${business.max_booking_hours}h max` : ""}</div>
            </div>
          </section>
          <section class="card">
            <h2>Booking rules</h2>
            <p class="muted">Choose an available generated slot. Bookings are confirmed instantly when the slot is still available.</p>
          </section>
          <section class="card" id="book-now-section">
            <h2>Book now</h2>
            <label>Date<input id="booking-date" type="date"></label>
            <div id="available-slots" class="booking-slot-grid"></div>
            <label>Duration
              <select id="booking-duration"></select>
            </label>
            <div id="booking-summary" class="empty-state small">Select a date and slot to see your booking summary.</div>
            <button id="confirm-booking" class="btn btn-primary wide" type="button">Confirm booking</button>
          </section>
          <section class="card">
            <h2>Reviews</h2>
            <div id="reviews-list" class="stack"></div>
            <form id="review-form" class="form-stack">
              <label>Rating<select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
              <label>Review<textarea name="review_text" rows="3" placeholder="Share your experience"></textarea></label>
              <button class="btn btn-secondary" type="submit">Submit review</button>
            </form>
          </section>
        </div>
      `;

      document.getElementById("booking-date").value = new Date().toISOString().slice(0, 10);
      fillDurationOptions();
      attachDetailHandlers(gallery);
      renderReviews(business.reviews_preview || []);
    }

    function attachDetailHandlers(gallery) {
      document.getElementById("booking-date").addEventListener("change", loadSlots);
      document.getElementById("booking-duration").addEventListener("change", updateBookingSummary);
      document.getElementById("confirm-booking").addEventListener("click", createBooking);
      document.getElementById("save-business").addEventListener("click", toggleFavorite);
      document.getElementById("share-business").addEventListener("click", shareBusiness);
      document.querySelectorAll("[data-open-gallery]").forEach((button) => {
        button.addEventListener("click", () => toast(`${gallery.length} gallery items available.`));
      });
      document.getElementById("review-form").addEventListener("submit", submitReview);
    }

    function fillDurationOptions() {
      const select = document.getElementById("booking-duration");
      const min = business.min_booking_hours || 1;
      const max = business.max_booking_hours || 5;
      select.innerHTML = "";
      for (let hours = min; hours <= max; hours += 1) {
        select.insertAdjacentHTML("beforeend", `<option value="${hours}">${hours} hour${hours > 1 ? "s" : ""}</option>`);
      }
    }

    async function loadSlots() {
      const date = document.getElementById("booking-date").value;
      const slotNode = document.getElementById("available-slots");
      selectedSlot = null;
      updateBookingSummary();
      try {
        const payload = await api(`/businesses/${id}/slots?date=${date}`);
        const slots = payload.data.slots || [];
        slotNode.innerHTML = slots.length
          ? slots.map((slot) => `<button class="slot-tile available" data-start="${slot.start_time}" type="button">${formatTime(slot.start_time)}</button>`).join("")
          : renderEmpty(payload.message || "No slots available for this date. Please choose another date.");
        slotNode.querySelectorAll("[data-start]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedSlot = button.dataset.start;
            slotNode.querySelectorAll(".slot-tile").forEach((slotButton) => slotButton.classList.remove("selected"));
            button.classList.add("selected");
            updateBookingSummary();
          });
        });
      } catch (error) {
        slotNode.innerHTML = renderEmpty(error.message);
      }
    }

    function updateBookingSummary() {
      const date = document.getElementById("booking-date") && document.getElementById("booking-date").value;
      const duration = Number(document.getElementById("booking-duration") && document.getElementById("booking-duration").value);
      const summary = document.getElementById("booking-summary");
      if (!summary) return;
      if (!selectedSlot) {
        summary.textContent = "Select a date and slot to see your booking summary.";
        return;
      }
      summary.textContent = `${business.name} on ${formatDate(date)} at ${formatTime(selectedSlot)} for ${duration} hour${duration > 1 ? "s" : ""}.`;
    }

    async function createBooking() {
      if (!selectedSlot) {
        toast("Please select a slot first.");
        return;
      }
      const duration = Number(document.getElementById("booking-duration").value);
      try {
        await api("/bookings", {
          method: "POST",
          body: {
            business_id: Number(id),
            slot_date: document.getElementById("booking-date").value,
            start_time: selectedSlot,
            duration_hours: duration,
            customer_name: currentUser.name,
            customer_email: currentUser.email,
            customer_phone: currentUser.phone || "",
          },
        });
        toast("Booking confirmed.");
        window.location.href = "/customer/bookings";
      } catch (error) {
        toast(error.message);
        loadSlots();
      }
    }

    async function toggleFavorite() {
      try {
        if (business.is_favorite) {
          await api(`/favorites/${id}`, { method: "DELETE" });
          business.is_favorite = false;
        } else {
          await api(`/favorites/${id}`, { method: "POST", body: {} });
          business.is_favorite = true;
        }
        document.getElementById("save-business").textContent = business.is_favorite ? "Saved" : "Save";
      } catch (error) {
        toast(error.message);
      }
    }

    async function shareBusiness() {
      const shareData = { title: business.name, text: business.description, url: window.location.href };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast("Link copied.");
      }
    }

    async function submitReview(event) {
      event.preventDefault();
      try {
        await api(`/businesses/${id}/reviews`, {
          method: "POST",
          body: Object.fromEntries(new FormData(event.currentTarget).entries()),
        });
        toast("Review submitted.");
        event.currentTarget.reset();
        const payload = await api(`/businesses/${id}/reviews`);
        renderReviews(payload.data.reviews || []);
      } catch (error) {
        toast(error.message);
      }
    }

    function renderReviews(reviews) {
      const node = document.getElementById("reviews-list");
      node.innerHTML = reviews.length
        ? reviews
            .map(
              (review) => `
                <article class="review-card">
                  <strong>${escapeHtml(review.rating)} stars · ${escapeHtml(review.user_name || "Customer")}</strong>
                  <p class="muted">${escapeHtml(review.review_text)}</p>
                </article>
              `
            )
            .join("")
        : renderEmpty("No reviews yet.");
    }
  }

  async function initBusinessDashboard() {
    try {
      const payload = await api("/dashboard/summary");
      const summary = payload.data.summary;
      const business = payload.data.business;
      if (!summary) {
        document.getElementById("next-booking-card").innerHTML = `
          <p class="eyebrow">Setup needed</p>
          <h2>Create your business profile first.</h2>
          <a class="btn btn-primary btn-small" href="/business/profile">Create profile</a>
        `;
        return;
      }
      renderDashboard(summary, business);
    } catch (error) {
      document.getElementById("next-booking-card").innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
  }

  function renderDashboard(summary, business) {
    const next = summary.next_upcoming_booking;
    document.getElementById("next-booking-card").innerHTML = next
      ? `
        <p class="eyebrow">Next booking</p>
        <h2>${escapeHtml(next.customer_name)}</h2>
        <p>${formatDate(next.slot_date)} · ${formatTime(next.start_time)} - ${formatTime(next.end_time)}</p>
      `
      : `
        <p class="eyebrow">Next booking</p>
        <h2>No upcoming bookings yet.</h2>
        <p class="muted">New customer bookings will appear here first.</p>
      `;

    const stats = [
      ["Today", summary.todays_booking_count],
      ["Total bookings", summary.total_bookings],
      ["Reviews", summary.total_reviews],
      ["Average rating", summary.average_rating || 0],
      ["Estimated earnings", formatPrice(business, summary.estimated_earnings || 0)],
      ["Recent", (summary.recent_bookings || []).length],
    ];
    document.getElementById("dashboard-stats").innerHTML = stats
      .map(([label, value]) => `<article class="stat-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`)
      .join("");

    const recent = summary.recent_bookings || [];
    document.getElementById("recent-business-bookings").innerHTML = recent.length
      ? recent.map((booking) => renderBookingCard(booking, true)).join("")
      : renderEmpty("No recent bookings yet.");
  }

  async function initBusinessProfile() {
    const form = document.getElementById("business-profile-form");
    const categorySelect = document.getElementById("business-category");
    const subcategoryField = document.getElementById("subcategory-field");
    const subcategorySelect = document.getElementById("business-subcategory");
    let businessId = null;

    categorySelect.innerHTML = categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
    subcategorySelect.innerHTML = '<option value="">Main category only</option>' + sportsSubcategories.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
    document.getElementById("currency-code").innerHTML = currencies.map(([code, label]) => `<option value="${code}">${label}</option>`).join("");
    fillTimeSelect(document.getElementById("opening-time"));
    fillTimeSelect(document.getElementById("closing-time"));

    categorySelect.addEventListener("change", () => {
      subcategoryField.hidden = categorySelect.value !== "Sports & Turf";
      if (subcategoryField.hidden) subcategorySelect.value = "";
    });

    form.display_tag.addEventListener("input", () => {
      form.display_tag.value = formatDisplayTag(form.display_tag.value);
      validateDisplayTag(form.display_tag.value);
    });

    try {
      const payload = await api("/businesses/mine");
      const business = payload.data.business;
      if (business) {
        businessId = business.id;
        fillBusinessForm(form, business);
        subcategoryField.hidden = business.category !== "Sports & Turf";
      }
    } catch (error) {
      setError("business-profile-error", error.message);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("business-profile-error", "");
      const displayTagOk = validateDisplayTag(form.display_tag.value);
      if (!displayTagOk) return;
      const payload = businessFormPayload(form);
      try {
        const response = businessId
          ? await api(`/businesses/${businessId}`, { method: "PUT", body: payload })
          : await api("/businesses", { method: "POST", body: payload });
        businessId = response.data.business.id;
        toast("Business profile saved.");
      } catch (error) {
        setError("business-profile-error", error.message);
      }
    });
  }

  function fillTimeSelect(select) {
    if (!select) return;
    for (let hour = 0; hour < 24; hour += 1) {
      const value = `${String(hour).padStart(2, "0")}:00`;
      select.insertAdjacentHTML("beforeend", `<option value="${value}">${formatTime(value)}</option>`);
    }
  }

  function formatDisplayTag(value) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    return digits ? `#${digits}` : "";
  }

  function validateDisplayTag(value) {
    const valid = /^#[0-9]{4}$/.test(value);
    setError("display-tag-error", value && !valid ? "Display tag must be exactly 4 digits, like #1234." : "");
    return valid;
  }

  function fillBusinessForm(form, business) {
    for (const [key, value] of Object.entries(business)) {
      if (form.elements[key] && typeof value !== "object") {
        form.elements[key].value = value ?? "";
      }
    }
    form.currency_code.value = business.currency_code || business.currency || "INR";
    form.closed_days.value = (business.closed_days || []).join(", ");
    form.gallery_images.value = (business.gallery_images || []).join("\n");
    form.is_booking_active.checked = business.is_booking_active;
  }

  function businessFormPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      ...data,
      display_tag: formatDisplayTag(data.display_tag || ""),
      opening_time: to24Hour(data.opening_time),
      closing_time: to24Hour(data.closing_time),
      closed_days: (data.closed_days || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      gallery_images: (data.gallery_images || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      currency_symbol: currencySymbol(data.currency_code),
      is_booking_active: form.is_booking_active.checked,
      price_per_hour: data.price_per_hour || null,
      max_booking_hours: data.max_booking_hours || null,
      min_booking_hours: data.min_booking_hours || 1,
      buffer_time_between_slots: data.buffer_time_between_slots || 0,
    };
  }

  function currencySymbol(code) {
    return {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      AUD: "A$",
      CAD: "C$",
    }[code || "INR"];
  }

  async function initBusinessSlots() {
    const dateInput = document.getElementById("slot-date");
    dateInput.value = new Date().toISOString().slice(0, 10);
    let business = null;

    try {
      const payload = await api("/businesses/mine");
      business = payload.data.business;
      if (!business) {
        document.getElementById("business-slot-grid").innerHTML = renderEmpty("Create your business profile before managing slots.");
        return;
      }
      await loadSlotGrid();
    } catch (error) {
      document.getElementById("business-slot-grid").innerHTML = renderEmpty(error.message);
      return;
    }

    dateInput.addEventListener("change", loadSlotGrid);
    document.getElementById("generate-day-slots").addEventListener("click", async () => {
      await generateSelectedDay();
      await loadSlotGrid();
    });
    document.getElementById("close-day").addEventListener("click", async () => {
      try {
        await api(`/businesses/${business.id}/closures`, { method: "POST", body: { dates: [dateInput.value] } });
        toast("Day closed.");
        await loadSlotGrid();
      } catch (error) {
        toast(error.message);
      }
    });

    async function generateSelectedDay() {
      const weekday = new Date(`${dateInput.value}T00:00:00`).getDay();
      const mondayBased = weekday === 0 ? 6 : weekday - 1;
      try {
        await api(`/businesses/${business.id}/slots/generate`, {
          method: "POST",
          body: { start_date: dateInput.value, end_date: dateInput.value, weekdays: [mondayBased] },
        });
        toast("Slots prepared.");
      } catch (error) {
        toast(error.message.includes("Duplicate") || error.message.includes("Overlapping") ? "Slots are already prepared for this day." : error.message);
      }
    }

    async function loadSlotGrid() {
      const grid = document.getElementById("business-slot-grid");
      const message = document.getElementById("slot-message");
      grid.innerHTML = "";
      message.hidden = true;
      try {
        const payload = await api(`/businesses/${business.id}/slots?date=${dateInput.value}&all=true`);
        const slots = payload.data.slots || [];
        if (!slots.length) {
          message.textContent = "No slots for this date yet. Tap Prepare day to create slots from your opening hours.";
          message.hidden = false;
          return;
        }
        grid.innerHTML = slots
          .map((slot) => `<button class="slot-tile ${slot.status}" data-slot-id="${slot.id}" data-status="${slot.status}" type="button">${formatTime(slot.start_time)}</button>`)
          .join("");
        grid.querySelectorAll("[data-slot-id]").forEach((button) => {
          button.addEventListener("click", () => updateSlot(button));
        });
      } catch (error) {
        message.textContent = error.message;
        message.hidden = false;
      }
    }

    async function updateSlot(button) {
      const status = button.dataset.status;
      if (status === "booked") {
        toast("This slot is already booked.");
        return;
      }
      const next = status === "available" ? "blocked" : "available";
      try {
        await api(`/slots/${button.dataset.slotId}`, {
          method: "PATCH",
          body: { status: next, block_reason: next === "blocked" ? "Blocked by business" : "" },
        });
        await loadSlotGrid();
      } catch (error) {
        toast(error.message);
      }
    }
  }

  function initBusinessSettings() {
    // Global logout handler covers this page.
  }
})();
