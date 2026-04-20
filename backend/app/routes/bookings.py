from flask import Blueprint, request

from ..models import Booking, Business
from ..services.booking_service import cancel_booking, create_booking, refresh_completed_bookings
from ..utils.auth import get_current_user, login_required, role_required
from ..utils.responses import error, success

bookings_bp = Blueprint("bookings", __name__)


@bookings_bp.post("/bookings")
@role_required("Customer")
def create_booking_route():
    payload = request.get_json() or {}
    required = ["business_id", "slot_date", "start_time", "duration_hours"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return error("Missing booking fields.", [f"{field} is required." for field in missing], 400)

    try:
        booking, request_meta = create_booking(get_current_user(), payload)
    except ValueError as exc:
        return error("Could not create booking.", [str(exc)], 409)

    return success(
        "Booking created successfully.",
        {"booking": booking.to_dict(), "request_context": request_meta},
        201,
    )


@bookings_bp.get("/bookings/customer")
@role_required("Customer")
def customer_bookings():
    refresh_completed_bookings()
    user = get_current_user()
    bookings = (
        Booking.query.filter_by(customer_user_id=user.id)
        .order_by(Booking.slot_date.desc(), Booking.start_time.desc())
        .all()
    )
    return success("Customer bookings fetched.", {"bookings": [booking.to_dict() for booking in bookings]})


@bookings_bp.get("/bookings/business")
@role_required("Business")
def business_bookings():
    refresh_completed_bookings()
    user = get_current_user()
    business = Business.query.filter_by(owner_user_id=user.id, is_active=True).first()
    if not business:
        return success("No business found.", {"bookings": []})
    bookings = (
        Booking.query.filter_by(business_id=business.id)
        .order_by(Booking.slot_date.asc(), Booking.start_time.asc())
        .all()
    )
    return success("Business bookings fetched.", {"bookings": [booking.to_dict() for booking in bookings]})


@bookings_bp.patch("/bookings/<int:booking_id>/cancel")
@login_required
def cancel_customer_booking(booking_id):
    user = get_current_user()
    if user.account_type == "Customer":
        booking = Booking.query.filter_by(id=booking_id, customer_user_id=user.id).first()
    elif user.account_type == "Business":
        booking = (
            Booking.query.join(Business, Booking.business_id == Business.id)
            .filter(Booking.id == booking_id, Business.owner_user_id == user.id)
            .first()
        )
    else:
        booking = None
    if not booking:
        return error("Booking not found.", ["You can only cancel bookings you own or manage."], 404)
    try:
        cancel_booking(booking)
    except ValueError as exc:
        return error("Could not cancel booking.", [str(exc)], 400)
    return success("Booking cancelled successfully.", {"booking": booking.to_dict()})
