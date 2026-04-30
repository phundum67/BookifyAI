from datetime import datetime
import json
import re


CATEGORY_SUBCATEGORY_MAP = {
    "Sports & Turfs": ["Football Turf", "Badminton", "Basketball", "Volleyball", "Swimming Pool"],
    "Events & Venues": ["Event Hall", "Karaoke", "Camping"],
    "Equipment Rental": [
        "Sound Systems",
        "Chair Rentals",
        "Washing Service",
        "Wedding Decoration Services",
        "Musical Instruments",
        "Bike Rentals",
        "Car Rentals",
        "Lighting Equipment",
        "Photography Equipment",
    ],
    "Stay & Dining": ["Catering Services", "Hotel", "Resort", "Restaurant"],
    "Wellness & Lifestyle": ["Barber Shop", "Salon", "Spa", "Gym"],
    "Entertainment & Leisure": ["Custom Service", "Jamming", "Sound Studio", "Gaming Zone", "Photography Studio", "Pool / Snooker"],
}
CATEGORIES = list(CATEGORY_SUBCATEGORY_MAP.keys())
SPORTS_SUBCATEGORIES = CATEGORY_SUBCATEGORY_MAP["Sports & Turfs"]
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
    raw_categories = payload.get("categories")
    if isinstance(raw_categories, str):
        try:
            raw_categories = json.loads(raw_categories)
        except json.JSONDecodeError:
            raw_categories = [raw_categories] if raw_categories.strip() else []
    if not isinstance(raw_categories, list):
        raw_categories = []

    categories = []
    for item in raw_categories:
        if isinstance(item, str):
            value = item.strip()
            if value and value not in categories:
                categories.append(value)

    category = payload.get("category")
    if not categories and isinstance(category, str) and category.strip():
        categories.append(category.strip())

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

    for field in ["name", "display_tag", "location", "phone", "description", "opening_time", "closing_time"]:
        if not payload.get(field):
            errors.append(f"{field} is required.")

    if not categories:
        errors.append("category is required.")
    elif any(item not in CATEGORIES for item in categories):
        errors.append("Please choose a valid category.")
    if display_tag and not re.fullmatch(r"#\d{4}", display_tag):
        errors.append("display_tag must use the format #1234.")

    if custom_category and len(custom_category) > 80:
        errors.append("Custom category is too long.")
    if subcategory and len(str(subcategory)) > 80:
        errors.append("Subcategory is too long.")

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

    services = payload.get("services") or []
    if isinstance(services, str):
        services = []
    for index, service in enumerate(services, start=1):
        if not isinstance(service, dict):
            continue
        booking_type = (service.get("booking_type") or "hourly").strip().lower()
        if booking_type not in {"hourly", "daily"}:
            errors.append(f"service {index} booking_type must be hourly or daily.")
        if service.get("price") not in (None, ""):
            try:
                if float(service.get("price")) < 0:
                    errors.append(f"service {index} price must be 0 or greater.")
            except (TypeError, ValueError):
                errors.append(f"service {index} price must be numeric.")

    return errors
