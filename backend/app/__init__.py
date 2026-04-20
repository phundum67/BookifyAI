from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect, text

from .config import Config
from .extensions import db


def ensure_schema_updates():
    inspector = inspect(db.engine)
    if "businesses" not in inspector.get_table_names():
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
    from .routes.bookings import bookings_bp
    from .routes.businesses import businesses_bp
    from .routes.dashboard import dashboard_bp
    from .routes.favorites import favorites_bp
    from .routes.notifications import notifications_bp
    from .routes.reviews import reviews_bp
    from .routes.slots import slots_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
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
