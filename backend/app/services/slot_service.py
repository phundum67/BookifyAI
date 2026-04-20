from datetime import datetime, timedelta

from ..extensions import db
from ..models import Slot
from ..utils.validation import parse_date, parse_time


def combine_slot_parts(slot_date, time_str):
    return datetime.combine(slot_date, parse_time(time_str))


def generate_slots(business, start_date, end_date, selected_weekdays):
    buffer_minutes = business.buffer_time_between_slots or 0
    closed_days = {str(day).lower() for day in business.closed_days}
    weekday_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    current_date = start_date
    created_slots = []

    while current_date <= end_date:
        weekday_name = weekday_names[current_date.weekday()]
        if current_date.weekday() in selected_weekdays and weekday_name not in closed_days:
            start_dt = datetime.combine(current_date, parse_time(business.opening_time))
            close_dt = datetime.combine(current_date, parse_time(business.closing_time))
            existing_slots = (
                Slot.query.filter_by(business_id=business.id, slot_date=current_date)
                .order_by(Slot.start_time.asc())
                .all()
            )

            cursor = start_dt
            proposed = []
            while cursor + timedelta(hours=1) <= close_dt:
                slot_start = cursor
                slot_end = cursor + timedelta(hours=1)
                proposed.append((slot_start, slot_end))
                cursor = slot_end + timedelta(minutes=buffer_minutes)

            for slot_start, slot_end in proposed:
                for existing in existing_slots:
                    existing_start = combine_slot_parts(current_date, existing.start_time)
                    existing_end = combine_slot_parts(current_date, existing.end_time)
                    if slot_start == existing_start and slot_end == existing_end:
                        raise ValueError("Duplicate slot generation detected for the selected date and time.")
                    if slot_start < existing_end and slot_end > existing_start:
                        raise ValueError("Overlapping slot range detected for the selected date.")

                new_slot = Slot(
                    business_id=business.id,
                    slot_date=current_date,
                    start_time=slot_start.strftime("%H:%M"),
                    end_time=slot_end.strftime("%H:%M"),
                    status="available",
                )
                created_slots.append(new_slot)
                db.session.add(new_slot)
        current_date += timedelta(days=1)

    db.session.flush()
    return created_slots


def get_slots_for_business(business_id, slot_date=None):
    query = Slot.query.filter_by(business_id=business_id)
    if slot_date:
        query = query.filter_by(slot_date=parse_date(slot_date))
    return query.order_by(Slot.slot_date.asc(), Slot.start_time.asc()).all()


def block_slots_for_dates(business, dates):
    updated = 0
    for value in dates:
        target_date = parse_date(value)
        slots = Slot.query.filter_by(business_id=business.id, slot_date=target_date).all()
        for slot in slots:
            if slot.status != "booked":
                slot.status = "blocked"
                slot.block_reason = "Temporary closure"
                updated += 1
    db.session.flush()
    return updated
