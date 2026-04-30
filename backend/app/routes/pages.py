from flask import Blueprint, redirect, render_template, request, url_for

from ..utils.auth import get_current_user

pages_bp = Blueprint("pages", __name__)


CUSTOMER_HOME = "pages.customer_home"
BUSINESS_HOME = "pages.business_dashboard"


def _home_for(user):
    if not user:
        return "pages.landing"
    if user.account_type == "Customer":
        return CUSTOMER_HOME
    if user.account_type == "Business":
        return BUSINESS_HOME
    return "pages.role_selection"


def _render_page(template_name, title, page_key, required_role=None, **context):
    user = get_current_user()
    if required_role and not user:
        return redirect(url_for("pages.login", next=request.path))
    if required_role and not user.account_type:
        return redirect(url_for("pages.role_selection"))
    if required_role and user.account_type != required_role:
        return redirect(url_for(_home_for(user)))

    return render_template(
        template_name,
        title=title,
        page_key=page_key,
        user=user,
        **context,
    )


@pages_bp.get("/")
def landing():
    user = get_current_user()
    if user and user.account_type:
        return redirect(url_for(_home_for(user)))
    return _render_page("pages/landing.html", "Bookify AI", "landing")


@pages_bp.get("/login")
def login():
    return _render_page("pages/auth.html", "Login", "login", auth_mode="login")


@pages_bp.get("/signup")
def signup():
    return _render_page("pages/auth.html", "Signup", "signup", auth_mode="signup")


@pages_bp.get("/choose-role")
def role_selection():
    user = get_current_user()
    if not user:
        return redirect(url_for("pages.login", next=request.path))
    if user.account_type:
        return redirect(url_for(_home_for(user)))
    return _render_page("pages/role.html", "Choose role", "role")


@pages_bp.get("/customer/home")
def customer_home():
    return _render_page("pages/customer_home.html", "Home", "customer-home", required_role="Customer")


@pages_bp.get("/customer/browse")
def browse():
    return _render_page("pages/browse.html", "Browse", "browse", required_role="Customer")


@pages_bp.get("/customer/bookings")
def customer_bookings():
    return _render_page("pages/customer_bookings.html", "Bookings", "customer-bookings", required_role="Customer")


@pages_bp.get("/customer/settings")
def customer_settings():
    return _render_page("pages/customer_settings.html", "Settings", "customer-settings", required_role="Customer")


@pages_bp.get("/businesses/<int:business_id>")
def business_detail(business_id):
    return _render_page(
        "pages/business_detail.html",
        "Business details",
        "business-detail",
        required_role="Customer",
        business_id=business_id,
    )


@pages_bp.get("/business/dashboard")
def business_dashboard():
    return _render_page("pages/business_dashboard.html", "Dashboard", "business-dashboard", required_role="Business")


@pages_bp.get("/business/profile")
def business_profile():
    return _render_page("pages/business_profile.html", "Business profile", "business-profile", required_role="Business")


@pages_bp.get("/business/slots")
def business_slots():
    return _render_page("pages/business_slots.html", "Slot management", "business-slots", required_role="Business")


@pages_bp.get("/business/bookings")
def business_bookings():
    return _render_page("pages/business_bookings.html", "Business bookings", "business-bookings", required_role="Business")


@pages_bp.get("/business/settings")
def business_settings():
    return _render_page("pages/business_settings.html", "Business settings", "business-settings", required_role="Business")
