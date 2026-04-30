import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { bookingsApi, businessApi, slotsApi } from "../api";
import { formatTime, formatTimeRange } from "../utils/time";

const today = new Date().toISOString().slice(0, 10);
const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getPythonWeekday(dateValue) {
  const jsDay = new Date(`${dateValue}T00:00:00`).getDay();
  return (jsDay + 6) % 7;
}

function getWeekdayName(dateValue) {
  return weekdayNames[new Date(`${dateValue}T00:00:00`).getDay()];
}

function getReadableStatus(status) {
  if (status === "available") return "Open";
  if (status === "blocked") return "Closed";
  return "Booked";
}

function formatReadableDate(dateValue) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

export default function SlotManagementPage() {
  const [business, setBusiness] = useState(null);
  const [dateView, setDateView] = useState(today);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusinessLoading, setIsBusinessLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  const isClosedDay = useMemo(() => {
    if (!business?.closed_days) return false;
    return business.closed_days.includes(getWeekdayName(dateView));
  }, [business, dateView]);

  const slotCounts = useMemo(
    () =>
      slots.reduce(
        (counts, slot) => ({
          ...counts,
          [slot.status]: (counts[slot.status] || 0) + 1,
        }),
        { available: 0, booked: 0, blocked: 0 },
      ),
    [slots],
  );

  const loadBusiness = async () => {
    const response = await businessApi.mine();
    setBusiness(response.data.business);
    return response.data.business;
  };

  const loadBookings = async () => {
    try {
      const response = await bookingsApi.business();
      setBookings(response.data.bookings || []);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const loadSlots = async (businessRecord, date) => {
    if (!businessRecord?.id) {
      setSlots([]);
      return [];
    }

    const response = await slotsApi.list(businessRecord.id, date, true);
    const nextSlots = response.data.slots || [];
    setSlots(nextSlots);
    return nextSlots;
  };

  const prepareSlotsForDate = async (businessRecord, date, options = {}) => {
    if (!businessRecord?.id) {
      setSlots([]);
      return [];
    }

    setIsPreparing(true);
    setError("");
    setSelectedBooking(null);
    setSelectedSlotIds([]);

    try {
      if ((businessRecord.closed_days || []).includes(getWeekdayName(date))) {
        setSlots([]);
        if (!options.silent) {
          setMessage("This day is closed in your business profile.");
        }
        return [];
      }

      const existingSlots = await loadSlots(businessRecord, date);
      if (existingSlots.length) {
        if (!options.silent) setMessage("");
        return existingSlots;
      }

      try {
        await slotsApi.generate(businessRecord.id, {
          start_date: date,
          end_date: date,
          weekdays: [getPythonWeekday(date)],
        });
      } catch (apiError) {
        if (apiError.status !== 409) {
          throw apiError;
        }
      }

      const generatedSlots = await loadSlots(businessRecord, date);
      if (!generatedSlots.length && !options.silent) {
        setMessage("No slots available for this date. Please choose another date.");
      } else if (!options.silent) {
        setMessage("Slots are ready for this date.");
      }
      return generatedSlots;
    } catch (apiError) {
      const detail = apiError.errors?.[0] || apiError.message || "Could not prepare slots for this date.";
      setError(detail);
      setSlots([]);
      return [];
    } finally {
      setIsPreparing(false);
    }
  };

  useEffect(() => {
    loadBusiness()
      .catch((apiError) => setError(apiError.errors?.[0] || apiError.message))
      .finally(() => setIsBusinessLoading(false));
    loadBookings();
  }, []);

  useEffect(() => {
    if (business?.id) {
      prepareSlotsForDate(business, dateView);
    }
  }, [dateView, business?.id]);

  const findBookingForSlot = (slot) =>
    bookings.find((booking) => booking.id === slot.booking_id) ||
    bookings.find(
      (booking) =>
        booking.business_id === slot.business_id &&
        booking.slot_date === slot.slot_date &&
        booking.start_time <= slot.start_time &&
        booking.end_time >= slot.end_time &&
        booking.status !== "cancelled",
    );

  const handleSlotTap = async (slot) => {
    setMessage("");
    setError("");

    if (slot.status === "booked") {
      setSelectedBooking(findBookingForSlot(slot) || { slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time });
      return;
    }

    if (isSelectionMode) {
      setSelectedSlotIds((currentIds) =>
        currentIds.includes(slot.id) ? currentIds.filter((id) => id !== slot.id) : [...currentIds, slot.id],
      );
      return;
    }

    try {
      const nextStatus = slot.status === "blocked" ? "available" : "blocked";
      await slotsApi.update(slot.id, {
        status: nextStatus,
        block_reason: nextStatus === "blocked" ? "Blocked by owner" : "",
      });
      setMessage(nextStatus === "blocked" ? "Slot closed for customers." : "Slot reopened for customers.");
      await loadSlots(business, dateView);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const updateSelectedSlots = async (status) => {
    const selectedSlots = slots.filter((slot) => selectedSlotIds.includes(slot.id) && slot.status !== "booked");
    if (!selectedSlots.length) {
      setError("Select at least one available or blocked slot first.");
      return;
    }

    setMessage("");
    setError("");

    try {
      await Promise.all(
        selectedSlots.map((slot) =>
          slotsApi.update(slot.id, {
            status,
            block_reason: status === "blocked" ? "Blocked by owner" : "",
          }),
        ),
      );
      setSelectedSlotIds([]);
      setIsSelectionMode(false);
      setMessage(status === "blocked" ? "Selected slots closed for customers." : "Selected slots reopened for customers.");
      await loadSlots(business, dateView);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  const closeEntireDay = async () => {
    if (!business?.id) return;

    setMessage("");
    setError("");

    try {
      const preparedSlots = slots.length ? slots : await prepareSlotsForDate(business, dateView, { silent: true });
      if (!preparedSlots.length) {
        setError("No slots exist for this date. Choose an open working day first.");
        return;
      }
      await slotsApi.closures(business.id, { dates: [dateView] });
      setSelectedSlotIds([]);
      setIsSelectionMode(false);
      setMessage("This day is closed. Existing bookings were left unchanged.");
      await loadSlots(business, dateView);
    } catch (apiError) {
      setError(apiError.errors?.[0] || apiError.message);
    }
  };

  if (isBusinessLoading) {
    return (
      <div className="card empty-state-card">
        <h3>Loading slot manager</h3>
        <p className="muted">Preparing your business availability...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="card empty-state-card">
        <h3>Create your business profile first</h3>
        <p className="muted">Set your working hours before managing booking slots.</p>
        <Link className="button" to="/business/profile">
          Set up profile
        </Link>
      </div>
    );
  }

  return (
    <div className="stack slot-manager-v3">
      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="card slot-manager-hero">
        <div>
          <p className="eyebrow">Your hours</p>
          <h2>{business.name}</h2>
          <p className="muted">
            Working hours: {formatTimeRange(business.opening_time, business.closing_time)}
            {business.closed_days?.length ? ` | Closed: ${business.closed_days.join(", ")}` : " | No closed days set"}
          </p>
        </div>
        <Link className="button button-secondary compact-button" to="/business/profile">
          Change hours
        </Link>
      </section>

      <section className="card stack slot-manager-panel">
        <div className="slot-panel-heading">
          <div>
            <p className="eyebrow">Manage day</p>
            <h2>{formatReadableDate(dateView)}</h2>
          </div>
          <span className="badge badge-neutral">{slots.length} slots</span>
        </div>

        <div className="slot-date-row">
          <label className="field slot-date-field">
            <span>Date</span>
            <input type="date" value={dateView} onChange={(event) => setDateView(event.target.value)} />
          </label>
          <div className="slot-top-actions">
            <button
              className={`button button-secondary compact-button ${isSelectionMode ? "is-active-soft" : ""}`}
              type="button"
              onClick={() => {
                setSelectedSlotIds([]);
                setIsSelectionMode((current) => !current);
              }}
            >
              {isSelectionMode ? "Done" : "Select slots"}
            </button>
            <button className="button button-secondary compact-button close-day-button" type="button" onClick={closeEntireDay}>
              Close this day
            </button>
          </div>
        </div>

        <div className="slot-state-legend" aria-label="Slot status legend">
          <span>
            <i className="legend-dot legend-available" /> {slotCounts.available} Open
          </span>
          <span>
            <i className="legend-dot legend-booked" /> {slotCounts.booked} Booked
          </span>
          <span>
            <i className="legend-dot legend-blocked" /> {slotCounts.blocked} Closed
          </span>
        </div>

        <p className="slot-helper-text">
          Tap a green slot to close it. Tap a grey slot to reopen it. Red slots are already booked.
        </p>

        {isSelectionMode ? (
          <div className="bulk-action-bar">
            <span>{selectedSlotIds.length} selected</span>
            <button className="button compact-button" type="button" onClick={() => updateSelectedSlots("blocked")}>
              Close selected
            </button>
            <button className="button button-secondary compact-button" type="button" onClick={() => updateSelectedSlots("available")}>
              Reopen
            </button>
          </div>
        ) : null}

        {isPreparing ? <p className="muted">Loading this day's slots...</p> : null}

        {isClosedDay ? (
          <div className="empty-state-card">
            <h3>Closed day</h3>
            <p className="muted">This weekday is closed in your profile. Choose another date or change your closed days.</p>
          </div>
        ) : null}

        {!isClosedDay && slots.length ? (
          <div className="slot-visual-grid">
            {slots.map((slot) => (
              <button
                key={slot.id}
                className={`slot-tile slot-tile-${slot.status} ${selectedSlotIds.includes(slot.id) ? "is-selected" : ""}`}
                type="button"
                onClick={() => handleSlotTap(slot)}
                aria-label={`${formatTimeRange(slot.start_time, slot.end_time)} ${slot.status}`}
              >
                <strong>{formatTime(slot.start_time)}</strong>
                <span>{getReadableStatus(slot.status)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {!isClosedDay && !isPreparing && !slots.length ? (
          <div className="empty-state-card">
            <h3>No slots available</h3>
            <p className="muted">There are no slots for this day yet. Choose another date or check your working hours.</p>
          </div>
        ) : null}
      </section>

      {selectedBooking ? (
        <section className="card booked-slot-detail">
          <div>
            <p className="eyebrow">Booked slot</p>
            <h3>{selectedBooking.customer_name || "Booking details"}</h3>
            <p className="muted">
              {selectedBooking.slot_date} | {formatTimeRange(selectedBooking.start_time, selectedBooking.end_time)}
            </p>
            {selectedBooking.customer_phone ? <p className="muted">Phone: {selectedBooking.customer_phone}</p> : null}
            {selectedBooking.customer_email ? <p className="muted">Email: {selectedBooking.customer_email}</p> : null}
          </div>
          <span className={`status-badge status-${selectedBooking.status || "booked"}`}>
            {selectedBooking.status || "booked"}
          </span>
        </section>
      ) : null}
    </div>
  );
}
