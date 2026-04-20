from ..models import Notification


def create_notification(recipient_user_id, title, message, notification_type, business_id=None):
    notice = Notification(
        recipient_user_id=recipient_user_id,
        business_id=business_id,
        type=notification_type,
        title=title,
        message=message,
    )
    return notice
