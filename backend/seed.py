from datetime import date, timedelta

from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import Booking, Business, Favorite, Notification, Review, Slot, User
from app.services.slot_service import generate_slots


PUBLIC_BASE_URL = "https://phundum67.pythonanywhere.com"


def static_image(path):
    return f"{PUBLIC_BASE_URL}/static/images/{path}"


def reset_and_seed():
    app = create_app()

    with app.app_context():
        db.drop_all()
        db.create_all()

        customer = User(
            name="Demo Customer",
            email="customer@example.com",
            phone="7000000001",
            account_type="Customer",
            password_hash=generate_password_hash("password123"),
        )
        turf_owner = User(
            name="Green Hills Owner",
            email="turfowner@example.com",
            phone="7000000002",
            account_type="Business",
            password_hash=generate_password_hash("password123"),
        )
        karaoke_owner = User(
            name="Lamka Karaoke Owner",
            email="karaokeowner@example.com",
            phone="7000000003",
            account_type="Business",
            password_hash=generate_password_hash("password123"),
        )
        resort_owner = User(
            name="Blue Pool Owner",
            email="resortowner@example.com",
            phone="7000000004",
            account_type="Business",
            password_hash=generate_password_hash("password123"),
        )
        db.session.add_all([customer, turf_owner, karaoke_owner, resort_owner])
        db.session.flush()

        turf = Business(
            owner_user_id=turf_owner.id,
            name="Green Hills Turf",
            display_tag="#1001",
            category="Sports & Turf",
            subcategory="Turf",
            location="Downtown",
            phone="9000000001",
            description="A simple turf venue for evening football and weekend games.",
            price_per_hour=1200,
            currency="INR",
            currency_code="INR",
            currency_symbol="₹",
            min_booking_hours=1,
            max_booking_hours=3,
            opening_time="06:00",
            closing_time="22:00",
            closed_days_json="[]",
            image_url=static_image("green-hills-turf.jpg"),
            profile_image=static_image("green-hills-turf.jpg"),
            gallery_images_json=f'["{static_image("green-hills-turf.jpg")}"]',
            is_booking_active=True,
            is_featured=True,
        )
        karaoke = Business(
            owner_user_id=karaoke_owner.id,
            name="Lamka Karaoke Hub",
            display_tag="#1002",
            category="Karaoke",
            location="Central Market",
            phone="9000000002",
            description="Private karaoke rooms with hourly booking.",
            price_per_hour=900,
            currency="INR",
            currency_code="INR",
            currency_symbol="₹",
            min_booking_hours=1,
            max_booking_hours=4,
            opening_time="11:00",
            closing_time="23:00",
            closed_days_json="[]",
            image_url=static_image("lamka-karaoke-hub.jpg"),
            profile_image=static_image("lamka-karaoke-hub.jpg"),
            gallery_images_json=f'["{static_image("lamka-karaoke-hub.jpg")}"]',
            is_booking_active=True,
            is_featured=True,
        )
        resort = Business(
            owner_user_id=resort_owner.id,
            name="Blue Pool Resort",
            display_tag="#1003",
            category="Resort",
            location="Hill View",
            phone="9000000003",
            description="Poolside resort with hourly access slots for version 1.",
            price_per_hour=1500,
            currency="INR",
            currency_code="INR",
            currency_symbol="₹",
            min_booking_hours=1,
            max_booking_hours=5,
            opening_time="08:00",
            closing_time="20:00",
            closed_days_json="[]",
            image_url=static_image("blue-pool-resort.jpeg"),
            profile_image=static_image("blue-pool-resort.jpeg"),
            gallery_images_json=f'["{static_image("blue-pool-resort.jpeg")}"]',
            is_booking_active=True,
            is_featured=False,
        )
        db.session.add_all([turf, karaoke, resort])
        db.session.flush()

        today = date.today()
        generate_slots(turf, today, today + timedelta(days=5), [0, 1, 2, 3, 4, 5, 6])
        generate_slots(karaoke, today, today + timedelta(days=3), [0, 1, 2, 3, 4, 5, 6])
        generate_slots(resort, today, today + timedelta(days=4), [0, 1, 2, 3, 4, 5, 6])

        future_slots = (
            Slot.query.filter_by(business_id=turf.id, slot_date=today + timedelta(days=1), status="available")
            .order_by(Slot.start_time.asc())
            .limit(2)
            .all()
        )
        if len(future_slots) == 2:
            booking = Booking(
                business_id=turf.id,
                customer_user_id=customer.id,
                slot_date=future_slots[0].slot_date,
                start_time=future_slots[0].start_time,
                end_time=future_slots[1].end_time,
                duration_hours=2,
                customer_name=customer.name,
                customer_email=customer.email,
                customer_phone=customer.phone,
                status="confirmed",
            )
            db.session.add(booking)
            db.session.flush()
            for slot in future_slots:
                slot.status = "booked"
                slot.booking_id = booking.id

        favorite = Favorite(user_id=customer.id, business_id=turf.id)
        review = Review(
            business_id=turf.id,
            user_id=customer.id,
            rating=5,
            review_text="Very easy to book and the turf was in good shape.",
        )
        notifications = [
            Notification(
                recipient_user_id=customer.id,
                business_id=turf.id,
                type="booking_confirmed",
                title="Booking confirmed",
                message="Your Green Hills Turf booking has been confirmed.",
            ),
            Notification(
                recipient_user_id=turf_owner.id,
                business_id=turf.id,
                type="new_booking",
                title="New booking received",
                message="A customer booked Green Hills Turf.",
            ),
        ]
        db.session.add(favorite)
        db.session.add(review)
        db.session.add_all(notifications)
        db.session.commit()

        print("Database reset complete.")
        print("Customer login: customer@example.com / password123")
        print("Business login: turfowner@example.com / password123")


if __name__ == "__main__":
    reset_and_seed()
