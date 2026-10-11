from flask import Blueprint, render_template
from modules import role_required, get_current_user
from repositories.listing_repository import ListingRepository
from repositories.advisory_repository import AdvisoryRepository
from repositories.order_repository import OrderRepository
from repositories.wishlist_repository import WishlistRepository
from services.subsidy_matcher import SubsidyMatcherService

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/dashboard")
@role_required("farmer")
def dashboard_view():
    user = get_current_user()
    uid = user["id"]

    matched_schemes = SubsidyMatcherService.match(
        state=user.get("state"),
        district=user.get("district"),
        land_size=user.get("land_size"),
        crop_type=user.get("preferred_crop")
    )

    incoming_orders = OrderRepository.find_by_farmer(uid, limit=5)

    stats = {
        "active_listings": ListingRepository.count_active_by_user(uid),
        "available_crops": ListingRepository.count_distinct_available_crops(),
        "advisory_queries": AdvisoryRepository.count_by_user(uid),
        "scheme_matches": len(matched_schemes),
        "incoming_orders_count": len(incoming_orders)
    }

    recent_listings = ListingRepository.find_by_user(uid, limit=5)
    for l in recent_listings:
        l["is_owner"] = True

    recent_advisories = AdvisoryRepository.find_recent_by_user(uid, limit=5)

    fields = ["name", "email", "phone", "state", "district", "land_size", "preferred_crop"]
    filled = sum(1 for f in fields if user.get(f))
    profile_completion = int(round(filled / len(fields) * 100))

    return render_template(
        "dashboard.html",
        user=user,
        stats=stats,
        recent_listings=recent_listings,
        recent_advisories=recent_advisories,
        incoming_orders=incoming_orders,
        profile_completion=profile_completion
    )


@dashboard_bp.route("/buyer/dashboard")
@role_required("buyer")
def buyer_dashboard_view():
    user = get_current_user()
    uid = user["id"]

    order_stats = OrderRepository.get_buyer_stats(uid)
    wishlist_count = WishlistRepository.count_by_buyer(uid)
    recent_orders = OrderRepository.find_by_buyer(uid, limit=5)
    wishlist_items = WishlistRepository.find_by_buyer(uid)

    recent_listings, total_listings = ListingRepository.find_all(page=1, per_page=6)

    buyer_fields = ["name", "email", "phone", "buyer_type", "organisation_name", "state", "district", "crops_of_interest"]
    filled = sum(1 for f in buyer_fields if user.get(f))
    profile_completion = int(round(filled / len(buyer_fields) * 100))

    stats = {
        "total_orders": order_stats["total"],
        "pending_orders": order_stats["pending"],
        "accepted_orders": order_stats["accepted"],
        "wishlist_count": wishlist_count,
        "total_available_listings": total_listings,
        "available_crops": ListingRepository.count_distinct_available_crops(),
    }

    return render_template(
        "buyer_dashboard.html",
        user=user,
        recent_listings=recent_listings,
        recent_orders=recent_orders,
        wishlist_items=wishlist_items,
        total_listings=total_listings,
        stats=stats,
        profile_completion=profile_completion
    )
