import json
from datetime import datetime, timedelta

from ..extensions import db
from ..models import Booking, Business, BusinessService, Notification, Slot
from ..services.notifications import create_notification
from ..utils.request_context import booking_request_context
from ..utils.validation import parse_date, parse_time


ACTIVE_HOURLY_BOOKING_STATUSES = {"confirmed", "pending"}


def _format_clock_12h(value):
    try:
        return datetime.strptime(value, "%H:%M").strftime("%I:%M %p").lstrip("0")
    except (TypeError, ValueError):
        return value or ""


def _short_booking_schedule(booking):
    if (booking.booking_type or "hourly") == "daily":
        duration_days = booking.duration_days or 1
        return f"{booking.slot_date.strftime('%d %b')} • {duration_days} day{'s' if duration_days > 1 else ''}"
    return (
        f"{booking.slot_date.strftime('%d %b')} • "
        f"{_format_clock_12h(booking.start_time)}-{_format_clock_12h(booking.end_time)}"
    )


def _booking_service_label(booking):
    service_name = None
    if getattr(booking, "service", None):
        service_name = booking.service.name
    elif getattr(booking, "service_id", None):
        service_name = f"Service #{booking.service_id}"
    return service_name or (booking.business.name if getattr(booking, "business", None) else "this business")


def refresh_completed_bookings():
    now = datetime.now()
    stale_bookings = Booking.query.filter_by(status="confirmed").all()
    changed = False

    for booking in stale_bookings:
        if (booking.booking_type or "hourly") == "daily":
            duration_days = booking.duration_days or 1
            booking_end_date = booking.slot_date + timedelta(days=max(duration_days, 1) - 1)
            booking_end = datetime.combine(booking_end_date, parse_time(booking.end_time))
        else:
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


def _business_blocks_customer(business, user_id):
    try:
        blocked = json.loads(business.blocked_customers_json or "[]")
    except (TypeError, json.JSONDecodeError):
        blocked = []

    return any(str(value) == str(user_id) for value in blocked if value not in (None, ""))


def _booking_applies_to_service(booking, service):
    if service is None:
        return booking.service_id is None
    return booking.service_id in {None, service.id}


def _slot_is_reserved(slot, bookings):
    slot_start = datetime.combine(slot.slot_date, parse_time(slot.start_time))
    slot_end = datetime.combine(slot.slot_date, parse_time(slot.end_time))

    for booking in bookings:
        booking_start = datetime.combine(booking.slot_date, parse_time(booking.start_time))
        booking_end = datetime.combine(booking.slot_date, parse_time(booking.end_time))
        if slot_start < booking_end and slot_end > booking_start:
            return True
    return False


def _fetch_bookable_slots(business, service, slot_date, start_time, duration_hours, exclude_booking_id=None):
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

    active_bookings = (
        Booking.query.filter_by(business_id=business.id, slot_date=slot_date, booking_type="hourly")
        .filter(Booking.status.in_(ACTIVE_HOURLY_BOOKING_STATUSES))
        .all()
    )
    relevant_bookings = [
        booking
        for booking in active_bookings
        if _booking_applies_to_service(booking, service) and booking.id != exclude_booking_id
    ]

    for slot in selected:
        if slot.status == "blocked":
            raise ValueError("One or more selected slots are no longer available.")
        if _slot_is_reserved(slot, relevant_bookings):
            raise ValueError("One or more selected slots are no longer available.")

    return selected


def _resolve_service(business, payload):
    service_id = payload.get("service_id")
    if service_id in (None, ""):
        return None
    try:
        service_id = int(service_id)
    except (TypeError, ValueError):
        raise ValueError("Selected service is invalid.")

    service = db.session.get(BusinessService, service_id)
    if not service or service.business_id != business.id:
        raise ValueError("Selected service is invalid.")
    return service


def _create_daily_booking(current_user, business, service, payload):
    slot_date = parse_date(payload.get("slot_date"))
    duration_days = int(payload.get("duration_days", 1) or 1)
    if duration_days < 1:
        raise ValueError("Bookings must be at least 1 day.")

    booking_start_date = slot_date
    booking_end_date = slot_date + timedelta(days=duration_days - 1)

    overlapping = (
        Booking.query.filter_by(business_id=business.id, status="confirmed", booking_type="daily")
        .order_by(Booking.slot_date.asc())
        .all()
    )
    for existing in overlapping:
        if service and existing.service_id and existing.service_id != service.id:
            continue
        if service is None and existing.service_id is not None:
            continue
        existing_days = existing.duration_days or 1
        existing_end_date = existing.slot_date + timedelta(days=existing_days - 1)
        if booking_start_date <= existing_end_date and booking_end_date >= existing.slot_date:
            raise ValueError("Those days are already booked for this service.")

    booking = Booking(
        business_id=business.id,
        service_id=service.id if service else None,
        customer_user_id=current_user.id,
        slot_date=slot_date,
        start_time=business.opening_time,
        end_time=business.closing_time,
        duration_hours=max(duration_days * 24, 1),
        duration_days=duration_days,
        booking_type="daily",
        customer_name=payload.get("customer_name") or current_user.name,
        customer_email=payload.get("customer_email") or current_user.email,
        customer_phone=payload.get("customer_phone") or current_user.phone or "",
        customer_profile_image=payload.get("customer_profile_image") or current_user.profile_image,
        status="confirmed",
        notes=(payload.get("notes") or "").strip() or None,
        confirmed_at=datetime.now(),
    )
    db.session.add(booking)
    db.session.flush()
    return booking


def create_booking(current_user, payload):
    request_meta = booking_request_context()
    business = db.session.get(Business, payload.get("business_id"))
    if not business or not business.is_active:
        raise ValueError("Business not found.")
    if not business.is_booking_active:
        raise ValueError("Bookings are currently inactive for this business.")
    if _business_blocks_customer(business, current_user.id):
        raise ValueError("You can no longer book this business.")

    service = _resolve_service(business, payload)
    booking_type = (payload.get("booking_type") or getattr(service, "booking_type", None) or "hourly").strip().lower()
    if booking_type not in {"hourly", "daily"}:
        booking_type = "hourly"

    slots = []
    if booking_type == "daily":
        booking = _create_daily_booking(current_user, business, service, payload)
    else:
        if service and (service.booking_type or "hourly") == "daily":
            raise ValueError("This service must be booked by day.")
        slot_date = parse_date(payload.get("slot_date"))
        start_time = payload.get("start_time")
        duration_hours = int(payload.get("duration_hours", 1))

        _validate_duration(business, duration_hours)
        slots = _fetch_bookable_slots(business, service, slot_date, start_time, duration_hours)

        opening = parse_time(business.opening_time)
        closing = parse_time(business.closing_time)
        booking_start = parse_time(slots[0].start_time)
        booking_end = parse_time(slots[-1].end_time)
        if booking_start < opening or booking_end > closing:
            raise ValueError("Booking must stay within opening and closing hours.")

        booking = Booking(
            business_id=business.id,
            service_id=service.id if service else None,
            customer_user_id=current_user.id,
            slot_date=slot_date,
            start_time=slots[0].start_time,
            end_time=slots[-1].end_time,
            duration_hours=duration_hours,
            duration_days=None,
            booking_type="hourly",
            customer_name=payload.get("customer_name") or current_user.name,
            customer_email=payload.get("customer_email") or current_user.email,
            customer_phone=payload.get("customer_phone") or current_user.phone or "",
            customer_profile_image=payload.get("customer_profile_image") or current_user.profile_image,
            status="confirmed",
            notes=(payload.get("notes") or "").strip() or None,
            confirmed_at=datetime.now(),
        )
        db.session.add(booking)
        db.session.flush()
        for slot in slots:
            slot.status = "booked"
            slot.booking_id = booking.id

        booking.slots = slots

    db.session.add(
        create_notification(
            current_user.id,
            "Booking confirmed",
            f"Your booking for {business.name} is confirmed.",
            "booking_confirmed",
            business.id,
            booking.id,
        )
    )
    db.session.add(
        create_notification(
            business.owner_user_id,
            "New booking received",
            f"{current_user.name} booked {_booking_service_label(booking)} • {_short_booking_schedule(booking)}.",
            "new_booking",
            business.id,
            booking.id,
        )
    )
    db.session.commit()

    return booking, request_meta


def cancel_booking(booking):
    if booking.status == "cancelled":
        raise ValueError("Booking is already cancelled.")

    booking.status = "cancelled"
    booking.cancelled_at = datetime.now()
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
            booking.id,
        )
    )
    db.session.add(
        create_notification(
            booking.business.owner_user_id,
            "Booking cancelled",
            f"{booking.customer_name or 'A customer'} cancelled {_booking_service_label(booking)} • {_short_booking_schedule(booking)}.",
            "booking_cancelled",
            booking.business_id,
            booking.id,
        )
    )
    db.session.commit()
    return booking


def update_booking_status(booking, status):
    normalized = (status or "").strip().lower()
    if normalized not in {"confirmed", "completed", "cancelled"}:
        raise ValueError("Unsupported booking status.")

    if normalized == booking.status:
        return booking

    if normalized == "cancelled":
        return cancel_booking(booking)

    if normalized == "confirmed":
        booking.status = "confirmed"
        booking.confirmed_at = booking.confirmed_at or datetime.now()
        booking.completed_at = None
        booking.cancelled_at = None
        for slot in booking.slots:
            slot.status = "booked"
            slot.booking_id = booking.id
    elif normalized == "completed":
        booking.status = "completed"
        booking.completed_at = datetime.now()

    db.session.commit()
    return booking


def update_booking_notes(booking, notes):
    booking.notes = (notes or "").strip() or None
    db.session.commit()
    return booking


def report_booking_issue(booking, reasons, notes):
    selected_reasons = []
    for item in reasons if isinstance(reasons, list) else []:
        text = str(item or "").strip()
        if text and text not in selected_reasons:
            selected_reasons.append(text)

    note_text = (notes or "").strip()
    if not selected_reasons and not note_text:
        raise ValueError("Please select at least one issue or write a note.")

    reason_text = ", ".join(selected_reasons[:5]) if selected_reasons else "Custom issue"
    detail_text = f" Note: {note_text}" if note_text else ""
    db.session.add(
        create_notification(
            booking.business.owner_user_id,
            "Issue reported",
            (
                f"{booking.customer_name or 'A customer'} reported {_booking_service_label(booking)} • "
                f"{_short_booking_schedule(booking)}. Reason: {reason_text}.{detail_text}"
            ),
            "booking_issue_reported",
            booking.business_id,
            booking.id,
        )
    )
    db.session.commit()
    return booking


def reschedule_booking(booking, payload):
    if booking.status in {"completed", "cancelled"}:
        raise ValueError("Completed or cancelled bookings cannot be rescheduled.")

    service = booking.service
    booking_type = (booking.booking_type or "hourly").strip().lower()

    if booking_type == "daily":
        slot_date = parse_date(payload.get("slot_date"))
        duration_days = int(payload.get("duration_days", booking.duration_days or 1) or 1)
        if duration_days < 1:
            raise ValueError("Bookings must be at least 1 day.")

        booking_start_date = slot_date
        booking_end_date = slot_date + timedelta(days=duration_days - 1)

        overlapping = (
            Booking.query.filter_by(business_id=booking.business_id, booking_type="daily")
            .filter(Booking.status.in_(ACTIVE_HOURLY_BOOKING_STATUSES))
            .all()
        )
        for existing in overlapping:
            if existing.id == booking.id:
                continue
            if service and existing.service_id and existing.service_id != service.id:
                continue
            if service is None and existing.service_id is not None:
                continue
            existing_days = existing.duration_days or 1
            existing_end_date = existing.slot_date + timedelta(days=existing_days - 1)
            if booking_start_date <= existing_end_date and booking_end_date >= existing.slot_date:
                raise ValueError("Those days are already booked for this service.")

        booking.slot_date = slot_date
        booking.duration_days = duration_days
        booking.duration_hours = max(duration_days * 24, 1)
        booking.start_time = booking.business.opening_time
        booking.end_time = booking.business.closing_time
    else:
        previous_slots = list(booking.slots or [])
        slot_date = parse_date(payload.get("slot_date"))
        start_time = payload.get("start_time")
        duration_hours = int(payload.get("duration_hours", booking.duration_hours or 1) or 1)

        _validate_duration(booking.business, duration_hours)
        slots = _fetch_bookable_slots(
            booking.business,
            service,
            slot_date,
            start_time,
            duration_hours,
            exclude_booking_id=booking.id,
        )

        opening = parse_time(booking.business.opening_time)
        closing = parse_time(booking.business.closing_time)
        booking_start = parse_time(slots[0].start_time)
        booking_end = parse_time(slots[-1].end_time)
        if booking_start < opening or booking_end > closing:
            raise ValueError("Booking must stay within opening and closing hours.")

        booking.slot_date = slot_date
        booking.start_time = slots[0].start_time
        booking.end_time = slots[-1].end_time
        booking.duration_hours = duration_hours
        for slot in previous_slots:
            slot.status = "available"
            slot.booking_id = None
            slot.block_reason = None
        for slot in slots:
            slot.status = "booked"
            slot.booking_id = booking.id
        booking.slots = slots

    booking.completed_at = None
    booking.cancelled_at = None
    if booking.status == "pending":
        booking.confirmed_at = None
    else:
        booking.confirmed_at = booking.confirmed_at or datetime.now()

    new_schedule = _short_booking_schedule(booking)

    Notification.query.filter_by(
        recipient_user_id=booking.customer_user_id,
        business_id=booking.business_id,
        type="booking_confirmed",
        is_read=False,
    ).update({"is_read": True})
    db.session.add(
        create_notification(
            booking.customer_user_id,
            "Booking time changed",
            f"{booking.business.name} was rescheduled to {new_schedule}.",
            "booking_rescheduled",
            booking.business_id,
            booking.id,
        )
    )
    db.session.add(
        create_notification(
            booking.business.owner_user_id,
            "Booking rescheduled",
            f"{booking.customer_name or 'A customer'} moved {_booking_service_label(booking)} to {new_schedule}.",
            "booking_rescheduled",
            booking.business_id,
            booking.id,
        )
    )
    db.session.commit()
    return booking


def block_customer_for_business(booking):
    business = booking.business
    blocked_customer_ids = business.blocked_customer_ids
    if booking.customer_user_id not in blocked_customer_ids:
        blocked_customer_ids.append(booking.customer_user_id)
        business.blocked_customers_json = json.dumps(blocked_customer_ids)
        db.session.commit()
    return business


def unblock_customer_for_business(booking):
    business = booking.business
    blocked_customer_ids = [value for value in business.blocked_customer_ids if value != booking.customer_user_id]
    business.blocked_customers_json = json.dumps(blocked_customer_ids)
    db.session.commit()
    return business
