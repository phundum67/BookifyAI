from datetime import datetime, timedelta

from ..extensions import db
from ..models import Booking, Business, Slot
from ..services.notifications import create_notification
from ..utils.request_context import booking_request_context
from ..utils.validation import parse_date, parse_time


def refresh_completed_bookings():
    now = datetime.now()
    stale_bookings = Booking.query.filter_by(status="confirmed").all()
    changed = False

    for booking in stale_bookings:
        booking_end = datetime.combine(booking.slot_date, parse_time(booking.end_time))
        if booking_end < now:
            booking.status = "completed"
            changed = True
    if changed:
        db.session.commit()


def _validate_duration(business, duration_hours):
    if duration_hours < business.min_booking_hours:
        raise ValueError(f"Bookings must be at least {business.min_booking_hours} hour(s).")
    if business.max_booking_hours and duration_hours > business.max_booking_hours:
        raise ValueError(f"Bookings cannot exceed {business.max_booking_hours} hour(s).")


def _fetch_bookable_slots(business, slot_date, start_time, duration_hours):
    slots = (
        Slot.query.filter_by(business_id=business.id, slot_date=slot_date)
        .order_by(Slot.start_time.asc())
        .all()
    )
    selected = None
    for index, slot in enumerate(slots):
        if slot.start_time == start_time:
            selected = slots[index : index + duration_hours]
            break

    if not selected or len(selected) != duration_hours:
        raise ValueError("Selected duration is not available in generated slots.")

    buffer_minutes = business.buffer_time_between_slots or 0
    expected_slots = []
    cursor = datetime.combine(slot_date, parse_time(start_time))
    for _ in range(duration_hours):
        expected_slots.append(cursor.strftime("%H:%M"))
        cursor = cursor + timedelta(hours=1, minutes=buffer_minutes)

    if [slot.start_time for slot in selected] != expected_slots:
        raise ValueError("Selected duration must use consecutive generated slots.")

    for slot in selected:
        if slot.status != "available":
            raise ValueError("One or more selected slots are no longer available.")

    return selected


def create_booking(current_user, payload):
    request_meta = booking_request_context()
    business = db.session.get(Business, payload.get("business_id"))
    if not business or not business.is_active:
        raise ValueError("Business not found.")
    if not business.is_booking_active:
        raise ValueError("Bookings are currently inactive for this business.")

    slot_date = parse_date(payload.get("slot_date"))
    start_time = payload.get("start_time")
    duration_hours = int(payload.get("duration_hours", 1))

    _validate_duration(business, duration_hours)
    slots = _fetch_bookable_slots(business, slot_date, start_time, duration_hours)

    opening = parse_time(business.opening_time)
    closing = parse_time(business.closing_time)
    booking_start = parse_time(slots[0].start_time)
    booking_end = parse_time(slots[-1].end_time)
    if booking_start < opening or booking_end > closing:
        raise ValueError("Booking must stay within opening and closing hours.")

    booking = Booking(
        business_id=business.id,
        customer_user_id=current_user.id,
        slot_date=slot_date,
        start_time=slots[0].start_time,
        end_time=slots[-1].end_time,
        duration_hours=duration_hours,
        customer_name=payload.get("customer_name") or current_user.name,
        customer_email=payload.get("customer_email") or current_user.email,
        customer_phone=payload.get("customer_phone") or current_user.phone or "",
        status="confirmed",
    )
    db.session.add(booking)
    db.session.flush()

    for slot in slots:
        slot.status = "booked"
        slot.booking_id = booking.id

    db.session.add(
        create_notification(
            current_user.id,
            "Booking confirmed",
            f"Your booking for {business.name} is confirmed.",
            "booking_confirmed",
            business.id,
        )
    )
    db.session.add(
        create_notification(
            business.owner_user_id,
            "New booking received",
            f"{current_user.name} booked {business.name}.",
            "new_booking",
            business.id,
        )
    )
    db.session.commit()

    return booking, request_meta


def cancel_booking(booking):
    if booking.status == "cancelled":
        raise ValueError("Booking is already cancelled.")

    booking.status = "cancelled"
    for slot in booking.slots:
        slot.status = "available"
        slot.booking_id = None
        slot.block_reason = None

    db.session.add(
        create_notification(
            booking.customer_user_id,
            "Booking cancelled",
            f"Your booking for {booking.business.name} has been cancelled.",
            "booking_cancelled",
            booking.business_id,
        )
    )
    db.session.add(
        create_notification(
            booking.business.owner_user_id,
            "Booking cancelled",
            f"A booking for {booking.business.name} has been cancelled.",
            "booking_cancelled",
            booking.business_id,
        )
    )
    db.session.commit()
    return booking
