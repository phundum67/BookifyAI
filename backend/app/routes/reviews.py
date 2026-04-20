from flask import Blueprint, request

from ..extensions import db
from ..models import Booking, Business, Review
from ..services.notifications import create_notification
from ..utils.auth import get_current_user, role_required
from ..utils.responses import error, success

reviews_bp = Blueprint("reviews", __name__)


@reviews_bp.get("/businesses/<int:business_id>/reviews")
def list_reviews(business_id):
    business = Business.query.filter_by(id=business_id, is_active=True).first()
    if not business:
        return error("Business not found.", ["This business is unavailable."], 404)

    reviews = Review.query.filter_by(business_id=business_id).order_by(Review.created_at.desc()).all()
    return success("Reviews fetched successfully.", {"reviews": [review.to_dict() for review in reviews]})


@reviews_bp.post("/businesses/<int:business_id>/reviews")
@role_required("Customer")
def create_review(business_id):
    user = get_current_user()
    business = Business.query.filter_by(id=business_id, is_active=True).first()
    if not business:
        return error("Business not found.", ["This business is unavailable."], 404)

    eligible_booking = (
        Booking.query.filter_by(business_id=business_id, customer_user_id=user.id)
        .filter(Booking.status.in_(["confirmed", "completed"]))
        .first()
    )
    if not eligible_booking:
        return error("Review not allowed.", ["You need at least one booking for this business before reviewing."], 403)

    payload = request.get_json() or {}
    try:
        rating = int(payload.get("rating"))
    except (TypeError, ValueError):
        return error("Invalid rating.", ["Rating must be a number from 1 to 5."], 400)
    review_text = (payload.get("review_text") or "").strip()
    if rating < 1 or rating > 5:
        return error("Invalid rating.", ["Rating must be between 1 and 5."], 400)
    if not review_text:
        return error("Review text required.", ["Please write a short review."], 400)

    review = Review(
        business_id=business_id,
        user_id=user.id,
        booking_id=eligible_booking.id,
        rating=rating,
        review_text=review_text,
    )
    db.session.add(review)
    db.session.add(
        create_notification(
            business.owner_user_id,
            "New review received",
            f"{user.name} left a new review for {business.name}.",
            "new_review",
            business.id,
        )
    )
    db.session.commit()
    return success("Review submitted successfully.", {"review": review.to_dict()}, 201)
