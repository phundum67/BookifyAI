import os


FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "https://bookify-ai-nine.vercel.app",
]
FRONTEND_ORIGIN = FRONTEND_ORIGINS[0]


def get_cors_origins():
    configured_origins = os.environ.get("CORS_ORIGINS") or os.environ.get("CORS_ORIGIN", "")
    origins = [*FRONTEND_ORIGINS]
    origins.extend(origin.strip() for origin in configured_origins.split(",") if origin.strip())
    return list(dict.fromkeys(origins))


def get_clerk_authorized_parties():
    configured = os.environ.get("CLERK_AUTHORIZED_PARTIES", "")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(__file__)), 'booking_app.db')}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    CORS_ORIGINS = get_cors_origins()
    JSON_SORT_KEYS = False
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
    CLERK_JWT_KEY = (os.environ.get("CLERK_JWT_KEY", "") or "").replace("\\n", "\n")
    CLERK_AUTHORIZED_PARTIES = get_clerk_authorized_parties()


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
