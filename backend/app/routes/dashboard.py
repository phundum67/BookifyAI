from flask import Blueprint

from ..models import Business
from ..services.dashboard_service import get_business_dashboard
from ..utils.auth import get_current_user, role_required
from ..utils.responses import success

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/dashboard/summary")
@role_required("Business")
def dashboard_summary():
    user = get_current_user()
    business = Business.query.filter_by(owner_user_id=user.id, is_active=True).first()
    if not business:
        return success("No business found.", {"summary": None})
    summary = get_business_dashboard(business)
    return success("Dashboard fetched successfully.", {"summary": summary, "business": business.to_dict(include_counts=True)})
