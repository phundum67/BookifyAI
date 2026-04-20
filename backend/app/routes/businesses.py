import json

from flask import Blueprint, request

from ..extensions import db
from ..models import Booking, Business, Favorite, Review
from ..utils.auth import get_current_user, login_required, role_required
from ..utils.responses import error, success
from ..utils.validation import CURRENCY_OPTIONS, validate_business_payload

businesses_bp = Blueprint("businesses", __name__)


def _assign_business_fields(business, payload):
    business.name = payload.get("name", business.name)
    business.display_tag = payload.get("display_tag", business.display_tag)
    business.category = payload.get("category", business.category)
    business.subcategory = payload.get("subcategory") or None
    business.custom_category = payload.get("custom_category") or None
    business.location = payload.get("location", business.location)
    business.phone = payload.get("phone", business.phone)
    business.description = payload.get("description", business.description)
    business.price_per_hour = float(payload["price_per_hour"]) if payload.get("price_per_hour") not in (None, "") else None
    currency_code = payload.get("currency_code") or payload.get("currency") or business.currency_code or business.currency or "INR"
    business.currency_code = currency_code
    business.currency_symbol = payload.get("currency_symbol") or CURRENCY_OPTIONS.get(currency_code, "₹")
    business.currency = business.currency_code
    business.min_booking_hours = int(payload.get("min_booking_hours", business.min_booking_hours or 1))
    business.max_booking_hours = (
        int(payload["max_booking_hours"]) if payload.get("max_booking_hours") not in (None, "") else None
    )
    business.buffer_time_between_slots = int(payload.get("buffer_time_between_slots", business.buffer_time_between_slots or 0))
    business.image_url = payload.get("image_url") or payload.get("profile_image") or None
    business.profile_image = payload.get("profile_image") or payload.get("image_url") or None
    business.gallery_images_json = json.dumps(payload.get("gallery_images") or [])
    business.opening_time = payload.get("opening_time", business.opening_time)
    business.closing_time = payload.get("closing_time", business.closing_time)
    business.closed_days_json = json.dumps(payload.get("closed_days") or [])
    if "is_booking_active" in payload:
        business.is_booking_active = bool(payload.get("is_booking_active"))
    elif business.is_booking_active is None:
        business.is_booking_active = True

    if "is_active" in payload:
        business.is_active = bool(payload.get("is_active"))
    elif business.is_active is None:
        business.is_active = True


@businesses_bp.post("/businesses")
@role_required("Business")
def create_business():
    current_user = get_current_user()
    if Business.query.filter_by(owner_user_id=current_user.id, is_active=True).first():
        return error("Business already exists.", ["Version 1 supports one business per Business account."], 409)

    payload = request.get_json() or {}
    errors = validate_business_payload(payload)
    if Business.query.filter_by(display_tag=payload.get("display_tag")).first():
        errors.append("display_tag must be unique.")
    if errors:
        return error("Could not create business.", errors, 400)

    business = Business(owner_user_id=current_user.id, name="", display_tag="", category="", location="", phone="", description="", opening_time="00:00", closing_time="00:00")
    _assign_business_fields(business, payload)
    db.session.add(business)
    db.session.commit()
    return success("Business created successfully.", {"business": business.to_dict(include_counts=True)}, 201)


@businesses_bp.put("/businesses/<int:business_id>")
@role_required("Business")
def update_business(business_id):
    current_user = get_current_user()
    business = Business.query.filter_by(id=business_id, owner_user_id=current_user.id).first()
    if not business:
        return error("Business not found.", ["You can only edit your own business."], 404)

    payload = request.get_json() or {}
    errors = validate_business_payload(payload)
    duplicate_tag = Business.query.filter(Business.display_tag == payload.get("display_tag"), Business.id != business.id).first()
    if duplicate_tag:
        errors.append("display_tag must be unique.")
    if errors:
        return error("Could not update business.", errors, 400)

    _assign_business_fields(business, payload)
    db.session.commit()
    return success("Business updated successfully.", {"business": business.to_dict(include_counts=True)})


@businesses_bp.get("/businesses")
def list_businesses():
    search = (request.args.get("search") or "").strip().lower()
    category = request.args.get("category")
    location = (request.args.get("location") or "").strip().lower()
    featured_only = request.args.get("featured")

    query = Business.query.filter_by(is_active=True, is_booking_active=True)
    if search:
        query = query.filter(Business.name.ilike(f"%{search}%"))
    if category:
        query = query.filter_by(category=category)
    if location:
        query = query.filter(Business.location.ilike(f"%{location}%"))
    if featured_only == "true":
        query = query.filter_by(is_featured=True)

    businesses = query.order_by(Business.is_featured.desc(), Business.name.asc()).all()
    return success(
        "Businesses fetched successfully.",
        {"businesses": [business.to_dict(include_counts=True) for business in businesses]},
    )


@businesses_bp.get("/businesses/mine")
@role_required("Business")
def get_my_business():
    user = get_current_user()
    business = Business.query.filter_by(owner_user_id=user.id).order_by(Business.created_at.desc()).first()
    return success("Business fetched successfully.", {"business": business.to_dict(include_counts=True) if business else None})


@businesses_bp.get("/businesses/<int:business_id>")
def get_business_details(business_id):
    business = Business.query.filter_by(id=business_id, is_active=True).first()
    if not business:
        return error("Business not found.", ["This business is unavailable."], 404)

    reviews = Review.query.filter_by(business_id=business_id).order_by(Review.created_at.desc()).all()
    rating_values = [review.rating for review in reviews]
    user = get_current_user()
    is_favorite = False
    if user and user.account_type == "Customer":
        is_favorite = Favorite.query.filter_by(user_id=user.id, business_id=business_id).first() is not None

    data = business.to_dict(include_counts=True)
    data["is_favorite"] = is_favorite
    data["reviews_preview"] = [review.to_dict() for review in reviews[:5]]
    data["average_rating"] = round(sum(rating_values) / len(rating_values), 1) if rating_values else 0
    return success("Business fetched successfully.", {"business": data})


@businesses_bp.get("/businesses/<int:business_id>/owner-booking-check")
@login_required
def booking_eligibility(business_id):
    user = get_current_user()
    eligible = False
    if user.account_type == "Customer":
        eligible = (
            Booking.query.filter_by(business_id=business_id, customer_user_id=user.id)
            .filter(Booking.status.in_(["confirmed", "completed"]))
            .first()
            is not None
        )
    return success("Booking eligibility checked.", {"eligible": eligible})
