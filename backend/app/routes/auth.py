from flask import Blueprint, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User
from ..utils.auth import (
    CLERK_MANAGED_PASSWORD,
    generate_auth_token,
    get_current_user,
    login_required,
    login_user,
    logout_user,
)
from ..utils.responses import error, success
from ..utils.validation import validate_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/signup")
def signup():
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    phone = (payload.get("phone") or "").strip()

    errors = []
    if not name:
        errors.append("name is required.")
    if not validate_email(email):
        errors.append("A valid email is required.")
    if len(password) < 6:
        errors.append("Password must be at least 6 characters.")
    if errors:
        return error("Could not create account.", errors, 400)
    if User.query.filter_by(email=email).first():
        return error("Email already registered.", ["Please use another email address."], 409)

    user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return success("Signup successful.", {"user": user.to_dict(), "token": generate_auth_token(user)}, 201)


@auth_bp.post("/login")
def login():
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    user = User.query.filter_by(email=email).first()

    if not user or not user.password_hash or user.password_hash == CLERK_MANAGED_PASSWORD:
        return error("Invalid credentials.", ["Email or password is incorrect."], 401)

    if not check_password_hash(user.password_hash, password):
        return error("Invalid credentials.", ["Email or password is incorrect."], 401)

    login_user(user)
    return success("Login successful.", {"user": user.to_dict(), "token": generate_auth_token(user)})


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return success("Logged out successfully.")


@auth_bp.get("/me")
def me():
    user = get_current_user()
    return success("Current user fetched.", {"user": user.to_dict() if user else None})


@auth_bp.patch("/role")
@login_required
def update_role():
    payload = request.get_json() or {}
    role = payload.get("account_type")
    if role not in {"Customer", "Business"}:
        return error("Invalid account type.", ["Please choose Customer or Business."], 400)

    user = get_current_user()
    user.account_type = role
    db.session.commit()
    return success("Account type updated.", {"user": user.to_dict(), "token": generate_auth_token(user)})


@auth_bp.patch("/profile")
@login_required
def update_profile():
    payload = request.get_json() or {}
    user = get_current_user()
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()
    profile_image = payload.get("profile_image")

    errors = []
    if not name:
        errors.append("name is required.")
    if not validate_email(email):
        errors.append("A valid email is required.")
    duplicate = User.query.filter(User.email == email, User.id != user.id).first()
    if duplicate:
        errors.append("Email already registered.")
    if errors:
        return error("Could not update profile.", errors, 400)

    user.name = name
    user.email = email
    user.phone = phone
    if "profile_image" in payload:
        user.profile_image = profile_image or None
    db.session.commit()
    return success("Profile updated successfully.", {"user": user.to_dict(), "token": generate_auth_token(user)})
