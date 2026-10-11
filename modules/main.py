from flask import Blueprint, render_template
from repositories.listing_repository import ListingRepository
from repositories.user_repository import UserRepository
from repositories.scheme_repository import SchemeRepository

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    public_stats = {
        "listings": ListingRepository.count_available(),
        "crops": ListingRepository.count_distinct_available_crops(),
        "schemes": SchemeRepository.count_active(),
        "farmers": UserRepository.count_all(),
    }
    featured = ListingRepository.find_featured(limit=3)
    return render_template(
        "index.html",
        public_stats=public_stats,
        featured_listings=featured
    )
