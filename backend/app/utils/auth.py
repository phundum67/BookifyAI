from functools import wraps

from clerk_backend_api import AuthenticateRequestOptions, Clerk, authenticate_request
from flask import current_app, request, session
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from ..extensions import db
from ..models import User
from .responses import error

CLERK_MANAGED_PASSWORD = "clerk-managed"


def _get_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="auth-token")


def _get_clerk_options():
    secret_key = current_app.config.get("CLERK_SECRET_KEY", "")
    if not secret_key:
        return None

    jwt_key = current_app.config.get("CLERK_JWT_KEY", "") or None
    authorized_parties = current_app.config.get("CLERK_AUTHORIZED_PARTIES") or None
    return AuthenticateRequestOptions(
        secret_key=secret_key,
        jwt_key=jwt_key,
        authorized_parties=authorized_parties,
        accepts_token=["session_token"],
    )


def _get_clerk_client():
    secret_key = current_app.config.get("CLERK_SECRET_KEY", "")
    if not secret_key:
        return None
    return Clerk(bearer_auth=secret_key)


def _get_clerk_primary_email(clerk_user):
    primary_id = getattr(clerk_user, "primary_email_address_id", None)
    for email_address in getattr(clerk_user, "email_addresses", []) or []:
        if getattr(email_address, "id", None) == primary_id:
            return getattr(email_address, "email_address", None)
    email_addresses = getattr(clerk_user, "email_addresses", []) or []
    if email_addresses:
        return getattr(email_addresses[0], "email_address", None)
    return None


def _get_clerk_primary_phone(clerk_user):
    primary_id = getattr(clerk_user, "primary_phone_number_id", None)
    for phone_number in getattr(clerk_user, "phone_numbers", []) or []:
        if getattr(phone_number, "id", None) == primary_id:
            return getattr(phone_number, "phone_number", None)
    phone_numbers = getattr(clerk_user, "phone_numbers", []) or []
    if phone_numbers:
        return getattr(phone_numbers[0], "phone_number", None)
    return None


def _get_clerk_display_name(clerk_user, email):
    first_name = (getattr(clerk_user, "first_name", None) or "").strip()
    last_name = (getattr(clerk_user, "last_name", None) or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name
    if email:
        return email.split("@", 1)[0]
    return "Booklify User"


def _sync_local_user_from_clerk(clerk_user_id):
    clerk_client = _get_clerk_client()
    if not clerk_client or not clerk_user_id:
        return None

    clerk_user = clerk_client.users.get(user_id=clerk_user_id)
    email = (_get_clerk_primary_email(clerk_user) or "").strip().lower()
    if not email:
        return None

    phone = (_get_clerk_primary_phone(clerk_user) or "").strip()
    image_url = getattr(clerk_user, "image_url", None) or getattr(clerk_user, "profile_image_url", None)
    display_name = _get_clerk_display_name(clerk_user, email)

    user = User.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()

    if user:
        if not user.clerk_user_id:
            user.clerk_user_id = clerk_user_id
        if not user.name:
            user.name = display_name
        if not user.phone and phone:
            user.phone = phone
        if not user.profile_image and image_url:
            user.profile_image = image_url
    else:
        user = User(
            clerk_user_id=clerk_user_id,
            name=display_name,
            email=email,
            phone=phone,
            profile_image=image_url,
            password_hash=CLERK_MANAGED_PASSWORD,
        )
        db.session.add(user)

    db.session.commit()
    return user


def generate_auth_token(user):
    return _get_serializer().dumps({"user_id": user.id})


def get_user_from_token(token):
    try:
        payload = _get_serializer().loads(token, max_age=60 * 60 * 24 * 30)
    except (BadSignature, SignatureExpired):
        return None
    return db.session.get(User, payload.get("user_id"))


def get_current_user():
    user_id = session.get("user_id")
    if user_id:
        return db.session.get(User, user_id)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "", 1).strip()
    legacy_user = get_user_from_token(token)
    if legacy_user:
        return legacy_user

    clerk_options = _get_clerk_options()
    if not clerk_options:
        return None

    try:
        state = authenticate_request(request, clerk_options)
    except Exception as exc:  # pragma: no cover - defensive auth fallback
        current_app.logger.warning("Clerk authentication failed: %s", exc)
        return None

    if not getattr(state, "is_signed_in", False):
        return None

    payload = getattr(state, "payload", {}) or {}
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        return None

    user = User.query.filter_by(clerk_user_id=clerk_user_id).first()
    if user:
        return user

    return _sync_local_user_from_clerk(clerk_user_id)


def login_user(user):
    session["user_id"] = user.id


def logout_user():
    session.clear()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return error("Authentication required.", ["Please log in to continue."], 401)
        return view(*args, **kwargs)

    return wrapped


def role_required(role):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = get_current_user()
            if not user:
                return error("Authentication required.", ["Please log in to continue."], 401)
            if user.account_type != role:
                return error(
                    "Permission denied.",
                    [f"Only {role} accounts can access this action."],
                    403,
                )
            return view(*args, **kwargs)

        return wrapped

    return decorator
