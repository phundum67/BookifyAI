import json
from datetime import datetime, timezone

from .extensions import db


def serialize_datetime(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    clerk_user_id = db.Column(db.String(80), unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30))
    profile_image = db.Column(db.Text)
    account_type = db.Column(db.String(20))

    businesses = db.relationship("Business", backref="owner", lazy=True)
    bookings = db.relationship("Booking", backref="customer", lazy=True)
    favorites = db.relationship("Favorite", backref="user", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="user", lazy=True, cascade="all, delete-orphan")
    notifications = db.relationship("Notification", backref="recipient", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "clerk_user_id": self.clerk_user_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "profile_image": self.profile_image,
            "account_type": self.account_type,
            "created_at": serialize_datetime(self.created_at),
        }


class Business(TimestampMixin, db.Model):
    __tablename__ = "businesses"

    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    display_tag = db.Column(db.String(80), unique=True, nullable=False)
    category = db.Column(db.String(80), nullable=False)
    categories_json = db.Column(db.Text, default="[]", nullable=False)
    subcategory = db.Column(db.String(80))
    custom_category = db.Column(db.String(80))
    location = db.Column(db.String(150), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price_per_hour = db.Column(db.Float)
    currency = db.Column(db.String(10))
    currency_code = db.Column(db.String(10), default="INR", nullable=False)
    currency_symbol = db.Column(db.String(10), default="₹", nullable=False)
    min_booking_hours = db.Column(db.Integer, default=1, nullable=False)
    max_booking_hours = db.Column(db.Integer)
    buffer_time_between_slots = db.Column(db.Integer, default=0, nullable=False)
    image_url = db.Column(db.String(255))
    profile_image = db.Column(db.String(255))
    gallery_images_json = db.Column(db.Text, default="[]", nullable=False)
    services_json = db.Column(db.Text, default="[]", nullable=False)
    blocked_customers_json = db.Column(db.Text, default="[]", nullable=False)
    opening_time = db.Column(db.String(5), nullable=False)
    closing_time = db.Column(db.String(5), nullable=False)
    closed_days_json = db.Column(db.Text, default="[]", nullable=False)
    is_booking_active = db.Column(db.Boolean, default=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_featured = db.Column(db.Boolean, default=False, nullable=False)

    slots = db.relationship("Slot", backref="business", lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship("Booking", backref="business", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="business", lazy=True, cascade="all, delete-orphan")
    service_items = db.relationship(
        "BusinessService",
        backref="business",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="BusinessService.id",
    )

    @property
    def gallery_images(self):
        return json.loads(self.gallery_images_json or "[]")

    @property
    def categories(self):
        try:
            categories = json.loads(self.categories_json or "[]")
        except (TypeError, json.JSONDecodeError):
            categories = []

        if not isinstance(categories, list):
            categories = []

        normalized = []
        for item in categories:
            if isinstance(item, str) and item.strip() and item.strip() not in normalized:
                normalized.append(item.strip())

        if not normalized and self.category:
            normalized.append(self.category)

        return normalized

    @property
    def services(self):
        if self.service_items:
            return [service.to_dict() for service in self.service_items]

        try:
            services = json.loads(self.services_json or "[]")
        except (TypeError, json.JSONDecodeError):
            return []
        if not isinstance(services, list):
            return []
        normalized = []
        for service in services:
            if not isinstance(service, dict):
                continue
            media = service.get("media") or service.get("images") or []
            normalized.append(
                {
                    "id": service.get("id"),
                    "business_id": self.id,
                    "name": service.get("name") or "",
                    "description": service.get("description") or "",
                    "price": service.get("price") or "",
                    "booking_type": service.get("booking_type") or "hourly",
                    "images": media if isinstance(media, list) else [],
                    "media": media if isinstance(media, list) else [],
                }
            )
        return normalized

    @property
    def closed_days(self):
        return json.loads(self.closed_days_json or "[]")

    @property
    def blocked_customer_ids(self):
        try:
            values = json.loads(self.blocked_customers_json or "[]")
        except (TypeError, json.JSONDecodeError):
            values = []

        normalized = []
        for value in values if isinstance(values, list) else []:
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                continue
            if parsed not in normalized:
                normalized.append(parsed)
        return normalized

    def to_dict(self, include_owner=False, include_counts=False):
        data = {
            "id": self.id,
            "owner_user_id": self.owner_user_id,
            "name": self.name,
            "display_tag": self.display_tag,
            "category": self.category,
            "categories": self.categories,
            "subcategory": self.subcategory,
            "custom_category": self.custom_category,
            "location": self.location,
            "phone": self.phone,
            "description": self.description,
            "price_per_hour": self.price_per_hour,
            "currency": self.currency_code or self.currency or "INR",
            "currency_code": self.currency_code or self.currency or "INR",
            "currency_symbol": self.currency_symbol or "₹",
            "min_booking_hours": self.min_booking_hours,
            "max_booking_hours": self.max_booking_hours,
            "buffer_time_between_slots": self.buffer_time_between_slots,
            "image_url": self.image_url,
            "profile_image": self.profile_image,
            "gallery_images": self.gallery_images,
            "services": self.services,
            "blocked_customer_ids": self.blocked_customer_ids,
            "opening_time": self.opening_time,
            "closing_time": self.closing_time,
            "closed_days": self.closed_days,
            "is_booking_active": self.is_booking_active,
            "is_active": self.is_active,
            "is_featured": self.is_featured,
            "created_at": serialize_datetime(self.created_at),
        }
        if include_owner:
            data["owner"] = self.owner.to_dict()
        if include_counts:
            ratings = [review.rating for review in self.reviews]
            data["review_count"] = len(ratings)
            data["average_rating"] = round(sum(ratings) / len(ratings), 1) if ratings else 0
        return data


class BusinessService(TimestampMixin, db.Model):
    __tablename__ = "business_services"

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, default="", nullable=False)
    price = db.Column(db.Float)
    booking_type = db.Column(db.String(20), default="hourly", nullable=False)
    images_json = db.Column(db.Text, default="[]", nullable=False)

    @property
    def images(self):
        try:
            images = json.loads(self.images_json or "[]")
        except (TypeError, json.JSONDecodeError):
            return []
        return images if isinstance(images, list) else []

    def to_dict(self):
        images = self.images
        return {
            "id": self.id,
            "business_id": self.business_id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "booking_type": self.booking_type or "hourly",
            "images": images,
            "media": images,
            "created_at": serialize_datetime(self.created_at),
        }


class Slot(TimestampMixin, db.Model):
    __tablename__ = "slots"
    __table_args__ = (
        db.UniqueConstraint("business_id", "slot_date", "start_time", "end_time", name="uq_slot"),
    )

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"), nullable=False)
    slot_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(5), nullable=False)
    end_time = db.Column(db.String(5), nullable=False)
    status = db.Column(db.String(20), default="available", nullable=False)
    block_reason = db.Column(db.String(255))
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "slot_date": self.slot_date.isoformat(),
            "start_time": self.start_time,
            "end_time": self.end_time,
            "status": self.status,
            "block_reason": self.block_reason,
            "booking_id": self.booking_id,
        }


class Booking(TimestampMixin, db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey("business_services.id"))
    customer_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    slot_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(5), nullable=False)
    end_time = db.Column(db.String(5), nullable=False)
    duration_hours = db.Column(db.Integer, nullable=False)
    duration_days = db.Column(db.Integer)
    booking_type = db.Column(db.String(20), default="hourly", nullable=False)
    customer_name = db.Column(db.String(120), nullable=False)
    customer_email = db.Column(db.String(120), nullable=False)
    customer_phone = db.Column(db.String(30), nullable=False)
    customer_profile_image = db.Column(db.Text)
    status = db.Column(db.String(20), default="confirmed", nullable=False)
    notes = db.Column(db.Text)
    confirmed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)

    slots = db.relationship("Slot", backref="booking", lazy=True)
    service = db.relationship("BusinessService", backref="bookings", lazy=True)

    @property
    def total_price(self):
        rate = None
        if self.service and self.service.price not in (None, ""):
            rate = self.service.price
        elif self.business and self.business.price_per_hour not in (None, ""):
            rate = self.business.price_per_hour

        if rate in (None, ""):
            return None

        if (self.booking_type or "hourly") == "daily":
            return float(rate) * float(self.duration_days or 1)
        return float(rate) * float(self.duration_hours or 1)

    @property
    def service_image(self):
        service_images = self.service.images if self.service else []
        if service_images:
            first = service_images[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("uri")
        if self.business:
            return self.business.image_url or self.business.profile_image
        return None

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": f"BK{100000 + self.id}",
            "business_id": self.business_id,
            "business_name": self.business.name if self.business else None,
            "business_phone": self.business.phone if self.business else None,
            "business_location": self.business.location if self.business else None,
            "currency_symbol": self.business.currency_symbol if self.business else "₹",
            "currency_code": self.business.currency_code if self.business else "INR",
            "service_id": self.service_id,
            "service_name": self.service.name if self.service else (self.business.name if self.business else None),
            "service_image": self.service_image,
            "customer_user_id": self.customer_user_id,
            "slot_date": self.slot_date.isoformat(),
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_hours": self.duration_hours,
            "duration_days": self.duration_days,
            "booking_type": self.booking_type or "hourly",
            "total_price": self.total_price,
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "customer_phone": self.customer_phone,
            "customer_profile_image": self.customer_profile_image or (self.customer.profile_image if self.customer else None),
            "customer_is_blocked": self.customer_user_id in self.business.blocked_customer_ids if self.business else False,
            "status": self.status,
            "notes": self.notes or "",
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
            "confirmed_at": serialize_datetime(self.confirmed_at),
            "completed_at": serialize_datetime(self.completed_at),
            "cancelled_at": serialize_datetime(self.cancelled_at),
        }


class Review(TimestampMixin, db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))
    rating = db.Column(db.Integer, nullable=False)
    review_text = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "user_profile_image": self.user.profile_image if self.user else None,
            "booking_id": self.booking_id,
            "rating": self.rating,
            "review_text": self.review_text,
            "created_at": serialize_datetime(self.created_at),
        }


class Favorite(TimestampMixin, db.Model):
    __tablename__ = "favorites"
    __table_args__ = (db.UniqueConstraint("user_id", "business_id", name="uq_favorite"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"), nullable=False)


class Notification(TimestampMixin, db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    recipient_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.id"))
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "recipient_user_id": self.recipient_user_id,
            "business_id": self.business_id,
            "booking_id": self.booking_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": serialize_datetime(self.created_at),
        }
