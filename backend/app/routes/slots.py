from flask import Blueprint, request

from ..extensions import db
from ..models import Business, Slot
from ..services.slot_service import block_slots_for_dates, build_slot_payloads, generate_slots, slot_has_active_booking
from ..utils.auth import get_current_user, role_required
from ..utils.responses import error, success
from ..utils.validation import WEEKDAY_MAP, parse_date

slots_bp = Blueprint("slots", __name__)


def _get_owned_business(business_id, owner_id):
    return Business.query.filter_by(id=business_id, owner_user_id=owner_id).first()


@slots_bp.post("/businesses/<int:business_id>/slots/generate")
@role_required("Business")
def generate_business_slots(business_id):
    owner = get_current_user()
    business = _get_owned_business(business_id, owner.id)
    if not business:
        return error("Business not found.", ["You can only manage your own business."], 404)

    payload = request.get_json() or {}
    weekdays = payload.get("weekdays") or []
    if not weekdays:
        return error("Weekdays required.", ["Select at least one day to generate slots."], 400)

    try:
        selected_weekdays = [WEEKDAY_MAP[str(day).lower()] if isinstance(day, str) else int(day) for day in weekdays]
        created = generate_slots(
            business,
            parse_date(payload["start_date"]),
            parse_date(payload["end_date"]),
            selected_weekdays,
        )
        db.session.commit()
    except KeyError:
        return error("Weekdays invalid.", ["Use weekday names or indexes 0-6."], 400)
    except ValueError as exc:
        db.session.rollback()
        return error("Could not generate slots.", [str(exc)], 409)

    return success("Slots generated successfully.", {"slots": [slot.to_dict() for slot in created]}, 201)


@slots_bp.get("/businesses/<int:business_id>/slots")
def list_slots(business_id):
    business = Business.query.filter_by(id=business_id, is_active=True).first()
    if not business:
        return error("Business not found.", ["This business is unavailable."], 404)

    slot_date = request.args.get("date")
    current_user = get_current_user()
    include_all = (
        request.args.get("all") == "true"
        and current_user is not None
        and current_user.account_type == "Business"
        and business.owner_user_id == current_user.id
    )
    raw_service_id = request.args.get("service_id")
    try:
        service_id = int(raw_service_id) if raw_service_id not in (None, "") else None
    except ValueError:
        return error("Invalid service.", ["service_id must be a number."], 400)
    slots = build_slot_payloads(business_id, slot_date, service_id=service_id, include_all=include_all)

    message = "Slots fetched successfully."
    if slot_date and not slots:
        message = "No slots available for this date. Please choose another date."
    return success(message, {"slots": slots})


@slots_bp.patch("/slots/<int:slot_id>")
@role_required("Business")
def update_slot(slot_id):
    owner = get_current_user()
    slot = (
        Slot.query.join(Business, Slot.business_id == Business.id)
        .filter(Slot.id == slot_id, Business.owner_user_id == owner.id)
        .first()
    )
    if not slot:
        return error("Slot not found.", ["You can only edit your own slots."], 404)

    payload = request.get_json() or {}
    if slot_has_active_booking(slot):
        return error("Booked slots cannot be changed.", ["Cancel the booking first if needed."], 400)

    status = payload.get("status")
    if status not in {"available", "blocked"}:
        return error("Invalid slot status.", ["Use available or blocked."], 400)
    slot.status = status
    slot.block_reason = payload.get("block_reason") if status == "blocked" else None
    db.session.commit()
    return success("Slot updated successfully.", {"slot": slot.to_dict()})


@slots_bp.post("/businesses/<int:business_id>/closures")
@role_required("Business")
def create_closure(business_id):
    owner = get_current_user()
    business = _get_owned_business(business_id, owner.id)
    if not business:
        return error("Business not found.", ["You can only manage your own business."], 404)

    payload = request.get_json() or {}
    dates = payload.get("dates") or []
    if not dates:
        return error("Dates required.", ["Choose one or more dates to close."], 400)

    updated = block_slots_for_dates(business, dates)
    db.session.commit()
    return success("Closure applied successfully.", {"updated_slots": updated})
