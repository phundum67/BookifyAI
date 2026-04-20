from datetime import datetime
import re


CATEGORIES = [
    "Barber Shop",
    "Bike Rental",
    "Camping",
    "Car Rental",
    "Event Hall",
    "Gaming Zone",
    "Gym",
    "Hotel",
    "Karaoke",
    "Photography Studio",
    "Pool",
    "Resort",
    "Restaurant",
    "Salon",
    "Spa",
    "Sports & Turf",
]
SPORTS_SUBCATEGORIES = ["Badminton", "Basketball", "Volleyball", "Turf"]
CURRENCY_OPTIONS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "AUD": "A$",
    "CAD": "C$",
}
WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def parse_date(value):
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_time(value):
    return datetime.strptime(value, "%H:%M").time()


def validate_email(value):
    return bool(value and "@" in value and "." in value)


def validate_business_payload(payload):
    errors = []
    category = payload.get("category")
    subcategory = payload.get("subcategory")
    custom_category = payload.get("custom_category")
    display_tag = payload.get("display_tag")
    opening_time = payload.get("opening_time")
    closing_time = payload.get("closing_time")
    price_per_hour = payload.get("price_per_hour")
    currency_code = payload.get("currency_code") or payload.get("currency") or "INR"
    min_booking_hours = int(payload.get("min_booking_hours", 1) or 1)
    max_booking_hours = payload.get("max_booking_hours")
    buffer_minutes = int(payload.get("buffer_time_between_slots", 0) or 0)

    for field in ["name", "display_tag", "category", "location", "phone", "description", "opening_time", "closing_time"]:
        if not payload.get(field):
            errors.append(f"{field} is required.")

    if category and category not in CATEGORIES:
        errors.append("Please choose a valid category.")

    if display_tag and not re.fullmatch(r"#\d{4}", display_tag):
        errors.append("display_tag must use the format #1234.")

    if category == "Sports & Turf" and subcategory and subcategory not in SPORTS_SUBCATEGORIES:
        errors.append("Please choose a valid Sports & Turf subcategory.")

    if category != "Sports & Turf" and subcategory:
        errors.append("Subcategory is only supported for Sports & Turf.")

    if custom_category and len(custom_category) > 80:
        errors.append("Custom category is too long.")

    if opening_time and closing_time:
        try:
            if parse_time(opening_time) >= parse_time(closing_time):
                errors.append("Opening time must be before closing time.")
        except ValueError:
            errors.append("Time values must use HH:MM format.")

    if price_per_hour not in (None, ""):
        try:
            if float(price_per_hour) < 0:
                errors.append("price_per_hour must be 0 or greater.")
        except ValueError:
            errors.append("price_per_hour must be numeric.")

    if currency_code not in CURRENCY_OPTIONS:
        errors.append("Please choose a supported currency.")

    if min_booking_hours < 1:
        errors.append("min_booking_hours must be at least 1.")

    if max_booking_hours not in (None, ""):
        try:
            max_hours = int(max_booking_hours)
            if max_hours < min_booking_hours:
                errors.append("max_booking_hours must be greater than or equal to min_booking_hours.")
        except ValueError:
            errors.append("max_booking_hours must be a whole number.")

    if buffer_minutes < 0:
        errors.append("buffer_time_between_slots must be 0 or greater.")

    return errors
