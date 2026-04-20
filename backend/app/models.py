import json
from datetime import datetime

from .extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30))
    account_type = db.Column(db.String(20))

    businesses = db.relationship("Business", backref="owner", lazy=True)
    bookings = db.relationship("Booking", backref="customer", lazy=True)
    favorites = db.relationship("Favorite", backref="user", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="user", lazy=True, cascade="all, delete-orphan")
    notifications = db.relationship("Notification", backref="recipient", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "account_type": self.account_type,
            "created_at": self.created_at.isoformat(),
        }


class Business(TimestampMixin, db.Model):
    __tablename__ = "businesses"

    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    display_tag = db.Column(db.String(80), unique=True, nullable=False)
    category = db.Column(db.String(80), nullable=False)
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
    opening_time = db.Column(db.String(5), nullable=False)
    closing_time = db.Column(db.String(5), nullable=False)
    closed_days_json = db.Column(db.Text, default="[]", nullable=False)
    is_booking_active = db.Column(db.Boolean, default=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_featured = db.Column(db.Boolean, default=False, nullable=False)

    slots = db.relationship("Slot", backref="business", lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship("Booking", backref="business", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="business", lazy=True, cascade="all, delete-orphan")

    @property
    def gallery_images(self):
        return json.loads(self.gallery_images_json or "[]")

    @property
    def closed_days(self):
        return json.loads(self.closed_days_json or "[]")

    def to_dict(self, include_owner=False, include_counts=False):
        data = {
            "id": self.id,
            "owner_user_id": self.owner_user_id,
            "name": self.name,
            "display_tag": self.display_tag,
            "category": self.category,
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
            "opening_time": self.opening_time,
            "closing_time": self.closing_time,
            "closed_days": self.closed_days,
            "is_booking_active": self.is_booking_active,
            "is_active": self.is_active,
            "is_featured": self.is_featured,
            "created_at": self.created_at.isoformat(),
        }
        if include_owner:
            data["owner"] = self.owner.to_dict()
        if include_counts:
            ratings = [review.rating for review in self.reviews]
            data["review_count"] = len(ratings)
            data["average_rating"] = round(sum(ratings) / len(ratings), 1) if ratings else 0
        return data


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
    customer_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    slot_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(5), nullable=False)
    end_time = db.Column(db.String(5), nullable=False)
    duration_hours = db.Column(db.Integer, nullable=False)
    customer_name = db.Column(db.String(120), nullable=False)
    customer_email = db.Column(db.String(120), nullable=False)
    customer_phone = db.Column(db.String(30), nullable=False)
    status = db.Column(db.String(20), default="confirmed", nullable=False)

    slots = db.relationship("Slot", backref="booking", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "business_id": self.business_id,
            "business_name": self.business.name if self.business else None,
            "customer_user_id": self.customer_user_id,
            "slot_date": self.slot_date.isoformat(),
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_hours": self.duration_hours,
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "customer_phone": self.customer_phone,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
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
            "booking_id": self.booking_id,
            "rating": self.rating,
            "review_text": self.review_text,
            "created_at": self.created_at.isoformat(),
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
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "recipient_user_id": self.recipient_user_id,
            "business_id": self.business_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }
