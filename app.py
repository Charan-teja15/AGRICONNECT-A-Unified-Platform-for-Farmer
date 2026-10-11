import os
import secrets
from datetime import date, datetime
from pathlib import Path
from flask import (
    Flask, render_template, request, session, redirect,
    url_for as flask_url_for, flash
)

from config import config_by_name
import database
from modules.main import main_bp
from modules.auth import auth_bp
from modules.marketplace import marketplace_bp
from modules.advisory import advisory_bp
from modules.subsidies import subsidies_bp
from modules.dashboard import dashboard_bp
from modules.profile import profile_bp
from modules.buyer import buyer_bp
from modules import get_current_user

# --------------------------------------------------------------------------
# Reference Data
# --------------------------------------------------------------------------
STATES = [
    "Andhra Pradesh", "Bihar", "Gujarat", "Karnataka", "Madhya Pradesh",
    "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
    "Telangana", "Uttar Pradesh", "West Bengal"
]

DISTRICTS = [
    "Warangal", "Hanamkonda", "Nalgonda", "Khammam", "Karimnagar",
    "Nizamabad", "Adilabad", "Mahbubnagar", "Ranga Reddy", "Medak"
]

CROPS = [
    "Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Groundnut",
    "Soybean", "Chilli", "Tomato", "Onion", "Potato", "Turmeric",
    "Banana", "Mango", "Bajra", "Jowar", "Gram", "Mustard"
]

UNITS = ["quintal", "kg", "tonne", "bag", "crate", "dozen"]

GROWTH_STAGES = [
    "Seedling", "Vegetative", "Flowering", "Fruiting / Pod filling",
    "Maturity / Harvest"
]

SOIL_TYPES = [
    "Sandy", "Loamy", "Clay", "Black (regur)", "Red", "Laterite", "Alluvial"
]

IRRIGATION_OPTIONS = [
    "Adequate irrigation", "Limited irrigation",
    "Rainfed only", "No irrigation available"
]

WEATHER_OPTIONS = [
    "Normal", "Hot and dry", "Humid", "Heavy rainfall",
    "Cool / cold", "Not sure"
]

LANDHOLDING_CATEGORIES = [
    "Marginal (below 1 hectare)", "Small (1–2 hectares)",
    "Semi-medium (2–4 hectares)", "Medium (4–10 hectares)",
    "Large (above 10 hectares)"
]

SORT_OPTIONS = [
    {"value": "newest", "label": "Newest first"},
    {"value": "price_asc", "label": "Price: low to high"},
    {"value": "price_desc", "label": "Price: high to low"},
]

BUYER_TYPES = [
    "Trader", "Retailer", "Restaurant/Hotel", "FPO/Cooperative", "Other"
]

DEMO_EMAIL = "demo@agriconnect.in"
DEMO_PASSWORD = "demo1234"


class CurrentUserProxy:
    """Wrapper object providing standard is_authenticated interface to Jinja templates."""
    def __init__(self, user_dict=None):
        self._user = user_dict or {}
        self.is_authenticated = bool(user_dict)
        for key in (
            "id", "name", "email", "phone", "role", "state", "district",
            "land_size", "land_unit", "preferred_crop",
            "buyer_type", "organisation_name", "crops_of_interest",
            "created_at", "updated_at"
        ):
            setattr(self, key, self._user.get(key))
        if not getattr(self, "role", None):
            self.role = "farmer"

    def __bool__(self):
        return self.is_authenticated

    def get(self, key, default=None):
        return self._user.get(key, default)


def create_app(config_name=None):
    """Application factory for AGRICONNECT."""
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    config_class = config_by_name.get(config_name, config_by_name["default"])

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure instance directory exists
    try:
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    except OSError:
        pass

    # Initialize SQLite database hooks
    database.init_app(app)

    # Auto-initialize database tables if file doesn't exist
    db_path = app.config.get("DATABASE_PATH")
    if db_path and db_path != ":memory:" and not os.path.exists(db_path):
        with app.app_context():
            database.init_db()
            try:
                from seed_data import seed_database
                seed_database(db_path)
            except Exception as e:
                app.logger.warning(f"Could not auto-seed database: {e}")

    # Register modular Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(marketplace_bp)
    app.register_blueprint(advisory_bp)
    app.register_blueprint(subsidies_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(buyer_bp)

    # --------------------------------------------------------------------------
    # CSRF Protection
    # --------------------------------------------------------------------------
    def generate_csrf_token():
        token = session.get("_csrf_token")
        if not token:
            token = secrets.token_hex(24)
            session["_csrf_token"] = token
        return token

    app.jinja_env.globals["csrf_token"] = generate_csrf_token

    @app.before_request
    def csrf_protect():
        if app.config.get("TESTING") or app.config.get("WTF_CSRF_ENABLED") is False:
            return None
        if request.method == "POST":
            # Exclude endpoints or handle expired sessions gracefully
            expected = session.get("_csrf_token")
            supplied = request.form.get("csrf_token", "")
            if not expected or not supplied or not secrets.compare_digest(expected, supplied):
                flash("Your form session expired. Please submit the form again.", "danger")
                return redirect(request.referrer or flask_url_for("main.index"))
        return None

    # --------------------------------------------------------------------------
    # URL Mapping Compatibility Helper for Jinja Templates
    # --------------------------------------------------------------------------
    FLAT_ENDPOINT_MAP = {
        "index": "main.index",
        "login": "auth.login",
        "register": "auth.register",
        "register_farmer": "auth.register_farmer",
        "register_buyer": "auth.register_buyer",
        "logout": "auth.logout",
        "dashboard": "dashboard.dashboard_view",
        "farmer_dashboard": "dashboard.dashboard_view",
        "buyer_dashboard": "dashboard.buyer_dashboard_view",
        "profile": "profile.profile_view",
        "marketplace": "marketplace.marketplace_view",
        "create_listing": "marketplace.create_listing_view",
        "edit_listing": "marketplace.edit_listing_view",
        "delete_listing": "marketplace.delete_listing_view",
        "crop_advisory": "advisory.crop_advisory_view",
        "advisory_result": "advisory.advisory_result_view",
        "subsidy_checker": "subsidies.subsidy_checker_view",
        "subsidy_results": "subsidies.subsidy_results_view",
        "listing_detail": "buyer.listing_detail",
        "place_order": "buyer.place_order",
        "buyer_orders": "buyer.buyer_orders",
        "cancel_order": "buyer.cancel_order",
        "farmer_orders": "buyer.farmer_orders",
        "accept_order": "buyer.accept_order",
        "reject_order": "buyer.reject_order",
        "toggle_wishlist": "buyer.toggle_wishlist",
        "wishlist": "buyer.wishlist",
        "buyer_profile": "profile.profile_view",
    }

    def handle_url_build_error(error, endpoint, values):
        target = FLAT_ENDPOINT_MAP.get(endpoint)
        if target:
            return flask_url_for(target, **values)
        raise error

    app.url_build_error_handlers.append(handle_url_build_error)

    def smart_url_for(endpoint, **values):
        target = FLAT_ENDPOINT_MAP.get(endpoint, endpoint)
        return flask_url_for(target, **values)

    def format_number(val):
        if val is None or val == "":
            return ""
        try:
            num = float(val)
            return f"{num:,.0f}"
        except (ValueError, TypeError):
            return str(val)

    app.jinja_env.globals["url_for"] = smart_url_for
    app.jinja_env.filters["initials"] = lambda s: (str(s or "F"))[:2].upper()
    app.jinja_env.filters["format_number"] = format_number

    # --------------------------------------------------------------------------
    # Global Jinja Context Processor
    # --------------------------------------------------------------------------
    @app.context_processor
    def inject_globals():
        user_row = get_current_user()
        return {
            "current_user": CurrentUserProxy(user_row),
            "app_name": "AGRICONNECT",
            "current_year": date.today().year,
            "today": datetime.now().strftime("%A, %d %B %Y"),
            "states": STATES,
            "districts": DISTRICTS,
            "crops": CROPS,
            "units": UNITS,
            "growth_stages": GROWTH_STAGES,
            "soil_types": SOIL_TYPES,
            "irrigation_options": IRRIGATION_OPTIONS,
            "weather_options": WEATHER_OPTIONS,
            "categories": LANDHOLDING_CATEGORIES,
            "sort_options": SORT_OPTIONS,
            "buyer_types": BUYER_TYPES,
            "history_enabled": True,
            "demo_mode": False,
            "demo_credentials": None,
        }

    # --------------------------------------------------------------------------
    # Error Handlers
    # --------------------------------------------------------------------------
    @app.errorhandler(400)
    def bad_request(error):
        return render_template("500.html", error="Bad request"), 400

    @app.errorhandler(403)
    def forbidden(error):
        return render_template("403.html", error="Access forbidden"), 403

    @app.errorhandler(404)
    def not_found(error):
        return render_template("404.html"), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return render_template("500.html", error="Method not allowed"), 405

    @app.errorhandler(500)
    def internal_error(error):
        return render_template("500.html"), 500

    # --------------------------------------------------------------------------
    # CLI Database Management Commands
    # --------------------------------------------------------------------------
    @app.cli.command("init-db")
    def init_db_command():
        """Clear existing data and create new tables."""
        database.init_db()
        print("Initialized database schema.")

    @app.cli.command("seed-db")
    def seed_db_command():
        """Seed demo farmers, listings, advisory rules, and schemes."""
        from seed_data import seed_database
        seed_database(app.config.get("DATABASE_PATH"))
        print("Database seeded successfully.")

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
