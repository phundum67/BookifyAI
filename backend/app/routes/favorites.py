from flask import Blueprint

from ..extensions import db
from ..models import Business, Favorite
from ..utils.auth import get_current_user, role_required
from ..utils.responses import error, success

favorites_bp = Blueprint("favorites", __name__)


@favorites_bp.get("/favorites")
@role_required("Customer")
def list_favorites():
    user = get_current_user()
    favorites = Favorite.query.filter_by(user_id=user.id).all()
    businesses = []
    for favorite in favorites:
        business = db.session.get(Business, favorite.business_id)
        if business and business.is_active:
            businesses.append(business.to_dict(include_counts=True))
    return success("Favorites fetched successfully.", {"businesses": businesses})


@favorites_bp.post("/favorites/<int:business_id>")
@role_required("Customer")
def add_favorite(business_id):
    user = get_current_user()
    business = Business.query.filter_by(id=business_id, is_active=True).first()
    if not business:
        return error("Business not found.", ["This business is unavailable."], 404)
    if Favorite.query.filter_by(user_id=user.id, business_id=business_id).first():
        return success("Business already saved.", {"saved": True})

    favorite = Favorite(user_id=user.id, business_id=business_id)
    db.session.add(favorite)
    db.session.commit()
    return success("Business saved successfully.", {"saved": True}, 201)


@favorites_bp.delete("/favorites/<int:business_id>")
@role_required("Customer")
def remove_favorite(business_id):
    user = get_current_user()
    favorite = Favorite.query.filter_by(user_id=user.id, business_id=business_id).first()
    if not favorite:
        return error("Favorite not found.", ["This business is not in your saved list."], 404)
    db.session.delete(favorite)
    db.session.commit()
    return success("Business removed from saved list.", {"saved": False})
