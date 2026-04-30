import json

from flask import Blueprint, current_app, request

from ..extensions import db
from ..models import Booking, Business, BusinessService, Favorite, Review
from ..utils.auth import get_current_user, login_required, role_required
from ..utils.responses import error, success
from ..utils.validation import CURRENCY_OPTIONS, validate_business_payload

businesses_bp = Blueprint("businesses", __name__)


def _extract_categories(payload, fallback_category=None, fallback_categories=None):
    raw_categories = payload.get("categories", None)
    if isinstance(raw_categories, str):
        try:
            raw_categories = json.loads(raw_categories)
        except json.JSONDecodeError:
            raw_categories = [raw_categories] if raw_categories.strip() else []

    categories = []
    for item in raw_categories or []:
        if isinstance(item, str):
            value = item.strip()
            if value and value not in categories:
                categories.append(value)

    if categories:
        return categories

    if isinstance(fallback_categories, list):
        for item in fallback_categories:
            if isinstance(item, str):
                value = item.strip()
                if value and value not in categories:
                    categories.append(value)

    category = payload.get("category") or fallback_category
    if not categories and isinstance(category, str) and category.strip():
        categories.append(category.strip())

    return categories


def _service_payload_present(payload):
    return "services" in payload or "services_json" in payload


def _extract_services(payload):
    raw_services = payload.get("services", None)
    if raw_services is None:
        raw_services = payload.get("services_json", None)
    if isinstance(raw_services, str):
        try:
            raw_services = json.loads(raw_services)
        except json.JSONDecodeError:
            raw_services = []

    services = []
    for service in raw_services or []:
        if not isinstance(service, dict):
            continue
        name = (service.get("name") or "").strip()
        if not name:
            continue
        images = service.get("images") or service.get("media") or []
        if not isinstance(images, list):
            images = []
        price = service.get("price")
        booking_type = (service.get("booking_type") or "hourly").strip().lower()
        if booking_type not in {"hourly", "daily"}:
            booking_type = "hourly"
        service_id = service.get("id")
        try:
            service_id = int(service_id) if service_id not in (None, "") else None
        except (TypeError, ValueError):
            service_id = None
        services.append(
            {
                "id": service_id,
                "name": name,
                "description": (service.get("description") or "").strip(),
                "price": float(price) if price not in (None, "") else None,
                "booking_type": booking_type,
                "images": images,
            }
        )
    return services


def _sync_business_services(business, payload):
    if not _service_payload_present(payload):
        current_app.logger.info("Services not included for business %s; existing services preserved.", business.id)
        return

    services = _extract_services(payload)
    current_app.logger.info("Services received for business %s: %s", business.id, len(services))

    existing_by_id = {service.id: service for service in business.service_items}
    incoming_ids = {service["id"] for service in services if service.get("id") in existing_by_id}

    for existing in list(business.service_items):
        if existing.id not in incoming_ids:
            db.session.delete(existing)

    saved_json = []
    for service in services:
        service_id = service.get("id")
        row = existing_by_id.get(service_id) if service_id else None
        if row is None:
            row = BusinessService(business_id=business.id)
            db.session.add(row)
        row.name = service["name"]
        row.description = service["description"]
        row.price = service["price"]
        row.booking_type = service["booking_type"]
        row.images_json = json.dumps(service["images"])
        saved_json.append(
            {
                "name": row.name,
                "description": row.description,
                "price": row.price if row.price is not None else "",
                "booking_type": row.booking_type or "hourly",
                "images": service["images"],
                "media": service["images"],
            }
        )

    business.services_json = json.dumps(saved_json)
    current_app.logger.info("Services saved for business %s: %s", business.id, len(services))


def _assign_business_fields(business, payload):
    categories = _extract_categories(payload, business.category, business.categories)
    business.name = payload.get("name", business.name)
    business.display_tag = payload.get("display_tag", business.display_tag)
    business.category = categories[0] if categories else payload.get("category", business.category)
    business.categories_json = json.dumps(categories)
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
    if "gallery_images" in payload:
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
    db.session.flush()
    _sync_business_services(business, payload)
    db.session.commit()
    current_app.logger.info("Services returned for business %s: %s", business.id, len(business.services))
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
    _sync_business_services(business, payload)
    db.session.commit()
    current_app.logger.info("Services returned for business %s: %s", business.id, len(business.services))
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
    if location:
        query = query.filter(Business.location.ilike(f"%{location}%"))
    if featured_only == "true":
        query = query.filter_by(is_featured=True)

    businesses = query.order_by(Business.is_featured.desc(), Business.name.asc()).all()
    if category:
        businesses = [business for business in businesses if category in business.categories]
    return success(
        "Businesses fetched successfully.",
        {"businesses": [business.to_dict(include_counts=True) for business in businesses]},
    )


@businesses_bp.get("/businesses/mine")
@role_required("Business")
def get_my_business():
    user = get_current_user()
    business = Business.query.filter_by(owner_user_id=user.id).order_by(Business.created_at.desc()).first()
    if business:
        current_app.logger.info("Services returned for business %s: %s", business.id, len(business.services))
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
    current_app.logger.info("Services returned for business %s: %s", business.id, len(data.get("services") or []))
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
