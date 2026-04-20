from functools import wraps

from flask import session

from ..extensions import db
from ..models import User
from .responses import error


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


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
