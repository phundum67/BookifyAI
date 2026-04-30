from datetime import date, datetime

from ..models import Booking, Review
from .booking_service import refresh_completed_bookings


def get_business_dashboard(business):
    refresh_completed_bookings()

    bookings = (
        Booking.query.filter_by(business_id=business.id)
        .order_by(Booking.slot_date.asc(), Booking.start_time.asc())
        .all()
    )
    reviews = Review.query.filter_by(business_id=business.id).order_by(Review.created_at.desc()).all()

    now = datetime.now()
    today_str = date.today().isoformat()
    upcoming = [
        booking
        for booking in bookings
        if booking.status == "confirmed" and datetime.combine(booking.slot_date, datetime.strptime(booking.start_time, "%H:%M").time()) >= now
    ]
    today_bookings = [booking for booking in bookings if booking.slot_date.isoformat() == today_str]
    recent_bookings = sorted(bookings, key=lambda booking: booking.created_at, reverse=True)
    next_upcoming = upcoming[0].to_dict() if upcoming else None
    rating_values = [review.rating for review in reviews]
    estimated_earnings = sum(
        booking.total_price or 0
        for booking in bookings
        if booking.status in {"confirmed", "completed"}
    )

    return {
        "next_upcoming_booking": next_upcoming,
        "todays_bookings": [booking.to_dict() for booking in today_bookings],
        "todays_booking_count": len(today_bookings),
        "total_bookings": len(bookings),
        "recent_bookings": [booking.to_dict() for booking in recent_bookings[:5]],
        "total_reviews": len(reviews),
        "average_rating": round(sum(rating_values) / len(rating_values), 1) if rating_values else 0,
        "estimated_earnings": estimated_earnings,
        "currency": business.currency_code or business.currency or "INR",
        "currency_code": business.currency_code or business.currency or "INR",
        "currency_symbol": business.currency_symbol or "₹",
    }
