from app.extensions import db
from app.models import Business, User
from app.config import FRONTEND_ORIGIN
from werkzeug.security import generate_password_hash


def test_cors_allows_deployed_frontend_for_api_preflight(client):
    response = client.options(
        "/api/auth/signup",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == FRONTEND_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


def signup_and_role(client, email, role, name="Test User"):
    client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": "password123", "phone": "7000000000"},
    )
    client.patch("/api/auth/role", json={"account_type": role})


def create_business(client):
    payload = {
        "name": "Test Turf",
        "display_tag": "#1234",
        "category": "Sports & Turf",
        "subcategory": "Turf",
        "location": "Test City",
        "phone": "9000000000",
        "description": "A sample business",
        "price_per_hour": 1000,
        "currency": "INR",
        "currency_code": "INR",
        "currency_symbol": "₹",
        "min_booking_hours": 1,
        "max_booking_hours": 3,
        "buffer_time_between_slots": 0,
        "opening_time": "08:00",
        "closing_time": "12:00",
        "closed_days": [],
        "gallery_images": [],
        "is_booking_active": True,
    }
    return client.post("/api/businesses", json=payload)


def test_customer_cannot_create_business(client):
    signup_and_role(client, "customer@test.com", "Customer")
    response = create_business(client)
    assert response.status_code == 403


def test_business_can_create_and_generate_slots(client):
    signup_and_role(client, "owner@test.com", "Business", "Owner")
    business_response = create_business(client)
    assert business_response.status_code == 201
    business_data = business_response.get_json()["data"]["business"]
    assert business_data["currency_code"] == "INR"
    assert business_data["currency_symbol"] == "₹"
    business_id = business_data["id"]
    response = client.post(
        f"/api/businesses/{business_id}/slots/generate",
        json={"start_date": "2030-01-01", "end_date": "2030-01-01", "weekdays": [1]},
    )
    assert response.status_code == 201
    assert len(response.get_json()["data"]["slots"]) == 4


def test_business_display_tag_requires_four_digits(client):
    signup_and_role(client, "tagowner@test.com", "Business", "Owner")
    payload_response = create_business(client)
    assert payload_response.status_code == 201

    client.post("/api/auth/logout")
    signup_and_role(client, "badtagowner@test.com", "Business", "Owner")
    bad_payload = {
        "name": "Bad Tag Turf",
        "display_tag": "abc123",
        "category": "Sports & Turf",
        "subcategory": "Turf",
        "location": "Test City",
        "phone": "9000000000",
        "description": "A sample business",
        "price_per_hour": 1000,
        "currency": "INR",
        "currency_code": "INR",
        "currency_symbol": "₹",
        "min_booking_hours": 1,
        "max_booking_hours": 3,
        "buffer_time_between_slots": 0,
        "opening_time": "08:00",
        "closing_time": "12:00",
        "closed_days": [],
        "gallery_images": [],
        "is_booking_active": True,
    }
    response = client.post("/api/businesses", json=bad_payload)
    assert response.status_code == 400
    assert "display_tag must use the format #1234." in response.get_json()["errors"]


def test_duplicate_slot_generation_is_blocked(client):
    signup_and_role(client, "owner2@test.com", "Business", "Owner")
    business_id = create_business(client).get_json()["data"]["business"]["id"]
    payload = {"start_date": "2030-01-01", "end_date": "2030-01-01", "weekdays": [1]}
    first = client.post(f"/api/businesses/{business_id}/slots/generate", json=payload)
    second = client.post(f"/api/businesses/{business_id}/slots/generate", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409


def test_customer_booking_requires_generated_slots(client):
    signup_and_role(client, "owner3@test.com", "Business", "Owner")
    business_id = create_business(client).get_json()["data"]["business"]["id"]
    client.post(
        f"/api/businesses/{business_id}/slots/generate",
        json={"start_date": "2030-01-01", "end_date": "2030-01-01", "weekdays": [1]},
    )
    client.post("/api/auth/logout")

    signup_and_role(client, "booker@test.com", "Customer", "Booker")
    response = client.post(
        "/api/bookings",
        json={
            "business_id": business_id,
            "slot_date": "2030-01-01",
            "start_time": "08:00",
            "duration_hours": 2,
            "customer_name": "Booker",
            "customer_email": "booker@test.com",
            "customer_phone": "9111111111",
        },
    )
    assert response.status_code == 201
    booking = response.get_json()["data"]["booking"]
    assert booking["status"] == "confirmed"


def test_unavailable_date_returns_clear_message(client):
    signup_and_role(client, "owner4@test.com", "Business", "Owner")
    business_id = create_business(client).get_json()["data"]["business"]["id"]
    response = client.get(f"/api/businesses/{business_id}/slots?date=2030-01-02")
    assert response.status_code == 200
    assert response.get_json()["message"] == "No slots available for this date. Please choose another date."


def test_review_requires_customer_booking(client, app):
    with app.app_context():
        owner = User(
            name="Owner",
            email="ownerx@test.com",
            phone="9000000000",
            account_type="Business",
            password_hash=generate_password_hash("password123"),
        )
        customer = User(
            name="Customer",
            email="customerx@test.com",
            phone="9111111111",
            account_type="Customer",
            password_hash=generate_password_hash("password123"),
        )
        db.session.add_all([owner, customer])
        db.session.flush()
        business = Business(
            owner_user_id=owner.id,
            name="Eligible Place",
            display_tag="#7777",
            category="Karaoke",
            location="Town",
            phone="9000000001",
            description="Description",
            opening_time="09:00",
            closing_time="18:00",
        )
        db.session.add(business)
        db.session.commit()
        business_id = business.id

    client.post("/api/auth/login", json={"email": "customerx@test.com", "password": "password123"})
    forbidden = client.post(f"/api/businesses/{business_id}/reviews", json={"rating": 5, "review_text": "Nice"})
    assert forbidden.status_code == 403


def test_dashboard_shows_next_upcoming_booking(client):
    signup_and_role(client, "owner5@test.com", "Business", "Owner")
    business_id = create_business(client).get_json()["data"]["business"]["id"]
    client.post(
        f"/api/businesses/{business_id}/slots/generate",
        json={"start_date": "2030-01-01", "end_date": "2030-01-01", "weekdays": [1]},
    )
    client.post("/api/auth/logout")
    signup_and_role(client, "booker2@test.com", "Customer", "Booker")
    client.post(
        "/api/bookings",
        json={
            "business_id": business_id,
            "slot_date": "2030-01-01",
            "start_time": "08:00",
            "duration_hours": 1,
            "customer_name": "Booker",
            "customer_email": "booker2@test.com",
            "customer_phone": "9222222222",
        },
    )
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "owner5@test.com", "password": "password123"})
    summary = client.get("/api/dashboard/summary")
    assert summary.status_code == 200
    assert summary.get_json()["data"]["summary"]["next_upcoming_booking"] is not None
