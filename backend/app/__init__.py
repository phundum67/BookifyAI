import json

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect, text

from .config import Config
from .extensions import db


def ensure_schema_updates():
    inspector = inspect(db.engine)
    table_names = inspector.get_table_names()
    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "profile_image" not in user_columns:
            db.session.execute(text("ALTER TABLE users ADD COLUMN profile_image TEXT"))
            db.session.commit()
        if "clerk_user_id" not in user_columns:
            db.session.execute(text("ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(80)"))
            db.session.commit()

    if "businesses" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("businesses")}
    if "image_url" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN image_url VARCHAR(255)"))
        db.session.commit()
    if "currency_code" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN currency_code VARCHAR(10) DEFAULT 'INR'"))
        db.session.execute(text("UPDATE businesses SET currency_code = COALESCE(currency, 'INR') WHERE currency_code IS NULL"))
        db.session.commit()
    if "currency_symbol" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN currency_symbol VARCHAR(10) DEFAULT '₹'"))
        db.session.execute(
            text(
                """
                UPDATE businesses
                SET currency_symbol = CASE COALESCE(currency_code, currency, 'INR')
                    WHEN 'USD' THEN '$'
                    WHEN 'EUR' THEN '€'
                    WHEN 'GBP' THEN '£'
                    WHEN 'AUD' THEN 'A$'
                    WHEN 'CAD' THEN 'C$'
                    ELSE '₹'
                END
                WHERE currency_symbol IS NULL
                """
            )
        )
        db.session.commit()
    if "categories_json" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN categories_json TEXT DEFAULT '[]'"))
        db.session.commit()
    if "services_json" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN services_json TEXT DEFAULT '[]'"))
        db.session.commit()
    else:
        db.session.execute(text("UPDATE businesses SET services_json = '[]' WHERE services_json IS NULL"))
        db.session.commit()
    if "blocked_customers_json" not in columns:
        db.session.execute(text("ALTER TABLE businesses ADD COLUMN blocked_customers_json TEXT DEFAULT '[]'"))
        db.session.commit()
    else:
        db.session.execute(text("UPDATE businesses SET blocked_customers_json = '[]' WHERE blocked_customers_json IS NULL"))
        db.session.commit()

    if "categories_json" in {column["name"] for column in inspector.get_columns("businesses")}:
        rows = db.session.execute(text("SELECT id, category, categories_json FROM businesses")).mappings()
        for row in rows:
            try:
                categories = json.loads(row["categories_json"] or "[]")
            except (TypeError, json.JSONDecodeError):
                categories = []
            if not isinstance(categories, list):
                categories = []

            normalized = []
            for item in categories:
                if isinstance(item, str) and item.strip() and item.strip() not in normalized:
                    normalized.append(item.strip())

            if not normalized and row["category"]:
                normalized.append(row["category"])

            db.session.execute(
                text("UPDATE businesses SET categories_json = :categories_json WHERE id = :business_id"),
                {"categories_json": json.dumps(normalized), "business_id": row["id"]},
            )
        db.session.commit()

    if "business_services" in table_names and "services_json" in columns:
        service_columns = {column["name"] for column in inspector.get_columns("business_services")}
        if "booking_type" not in service_columns:
            db.session.execute(text("ALTER TABLE business_services ADD COLUMN booking_type VARCHAR(20) DEFAULT 'hourly'"))
            db.session.commit()
        db.session.execute(text("UPDATE business_services SET booking_type = 'hourly' WHERE booking_type IS NULL OR booking_type = ''"))
        db.session.commit()

        rows = db.session.execute(
            text("SELECT id, services_json FROM businesses WHERE services_json IS NOT NULL AND services_json != '[]'")
        ).mappings()
        for row in rows:
            existing_count = db.session.execute(
                text("SELECT COUNT(*) FROM business_services WHERE business_id = :business_id"),
                {"business_id": row["id"]},
            ).scalar()
            if existing_count:
                continue
            try:
                services = json.loads(row["services_json"] or "[]")
            except (TypeError, json.JSONDecodeError):
                services = []
            for service in services if isinstance(services, list) else []:
                if not isinstance(service, dict) or not (service.get("name") or "").strip():
                    continue
                images = service.get("images") or service.get("media") or []
                if not isinstance(images, list):
                    images = []
                price = service.get("price")
                try:
                    price_value = float(price) if price not in (None, "") else None
                except (TypeError, ValueError):
                    price_value = None
                db.session.execute(
                    text(
                        """
                        INSERT INTO business_services
                            (business_id, name, description, price, booking_type, images_json, created_at, updated_at)
                        VALUES
                            (:business_id, :name, :description, :price, :booking_type, :images_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """
                    ),
                    {
                        "business_id": row["id"],
                        "name": (service.get("name") or "").strip(),
                        "description": (service.get("description") or "").strip(),
                        "price": price_value,
                        "booking_type": (service.get("booking_type") or "hourly").strip().lower(),
                        "images_json": json.dumps(images),
                    },
                )
        db.session.commit()

    if "bookings" in table_names:
        booking_columns = {column["name"] for column in inspector.get_columns("bookings")}
        if "service_id" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN service_id INTEGER"))
            db.session.commit()
        if "booking_type" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN booking_type VARCHAR(20) DEFAULT 'hourly'"))
            db.session.commit()
        if "duration_days" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN duration_days INTEGER"))
            db.session.commit()
        if "customer_profile_image" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN customer_profile_image TEXT"))
            db.session.commit()
        if "notes" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN notes TEXT"))
            db.session.commit()
        if "confirmed_at" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN confirmed_at DATETIME"))
            db.session.commit()
        if "completed_at" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN completed_at DATETIME"))
            db.session.commit()
        if "cancelled_at" not in booking_columns:
            db.session.execute(text("ALTER TABLE bookings ADD COLUMN cancelled_at DATETIME"))
            db.session.commit()
        db.session.execute(text("UPDATE bookings SET booking_type = 'hourly' WHERE booking_type IS NULL OR booking_type = ''"))
        db.session.execute(text("UPDATE bookings SET confirmed_at = created_at WHERE status = 'confirmed' AND confirmed_at IS NULL"))
        db.session.execute(text("UPDATE bookings SET completed_at = updated_at WHERE status = 'completed' AND completed_at IS NULL"))
        db.session.execute(text("UPDATE bookings SET cancelled_at = updated_at WHERE status = 'cancelled' AND cancelled_at IS NULL"))
        db.session.commit()

    if "notifications" in table_names:
        notification_columns = {column["name"] for column in inspector.get_columns("notifications")}
        if "booking_id" not in notification_columns:
            db.session.execute(text("ALTER TABLE notifications ADD COLUMN booking_id INTEGER"))
            db.session.commit()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    from .routes.auth import auth_bp
    from .routes.ai import ai_bp
    from .routes.bookings import bookings_bp
    from .routes.businesses import businesses_bp
    from .routes.dashboard import dashboard_bp
    from .routes.favorites import favorites_bp
    from .routes.notifications import notifications_bp
    from .routes.pages import pages_bp
    from .routes.reviews import reviews_bp
    from .routes.slots import slots_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(ai_bp, url_prefix="/api")
    app.register_blueprint(businesses_bp, url_prefix="/api")
    app.register_blueprint(slots_bp, url_prefix="/api")
    app.register_blueprint(bookings_bp, url_prefix="/api")
    app.register_blueprint(favorites_bp, url_prefix="/api")
    app.register_blueprint(reviews_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api")

    @app.route("/api/health")
    def health():
        return {"message": "ok", "data": {"status": "healthy"}}

    with app.app_context():
        from . import models

        db.create_all()
        ensure_schema_updates()

    return app
