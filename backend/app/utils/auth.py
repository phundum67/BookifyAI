from functools import wraps

from flask import current_app, request, session
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from ..extensions import db
from ..models import User
from .responses import error


def _get_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="auth-token")


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
    if auth_header.startswith("Bearer "):
        return get_user_from_token(auth_header.replace("Bearer ", "", 1).strip())

    return None


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
