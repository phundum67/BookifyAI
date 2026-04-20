from flask import Blueprint

from ..extensions import db
from ..models import Notification
from ..utils.auth import get_current_user, login_required
from ..utils.responses import error, success

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/notifications")
@login_required
def list_notifications():
    user = get_current_user()
    notifications = (
        Notification.query.filter_by(recipient_user_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    unread_count = sum(1 for item in notifications if not item.is_read)
    return success(
        "Notifications fetched successfully.",
        {
            "notifications": [notice.to_dict() for notice in notifications],
            "unread_count": unread_count,
        },
    )


@notifications_bp.patch("/notifications/<int:notification_id>/read")
@login_required
def mark_notification_read(notification_id):
    user = get_current_user()
    notification = Notification.query.filter_by(id=notification_id, recipient_user_id=user.id).first()
    if not notification:
        return error("Notification not found.", ["You can only update your own notifications."], 404)
    notification.is_read = True
    db.session.commit()
    return success("Notification marked as read.", {"notification": notification.to_dict()})
