from datetime import datetime
from flask import Blueprint, render_template, request, session
from modules import get_current_user
from services.subsidy_matcher import SubsidyMatcherService
from repositories.scheme_repository import SchemeRepository

subsidies_bp = Blueprint("subsidies", __name__)

@subsidies_bp.route("/subsidy-checker", methods=["GET", "POST"])
@subsidies_bp.route("/subsidies", methods=["GET", "POST"])
def subsidy_checker_view():
    user = get_current_user()
    if user and (user.get("role") or "").strip().lower() == "buyer":
        return render_template(
            "403.html",
            message="Government Subsidy Discovery is exclusively available to cultivating farmers. Buyers can browse and search the marketplace.",
            user=user,
            required_role="farmer",
            current_role="buyer"
        ), 403

    if request.method == "POST":
        criteria = {
            "state": (request.form.get("state") or "").strip(),
            "district": (request.form.get("district") or "").strip(),
            "land_size": (request.form.get("land_size") or "").strip(),
            "landholding_category": (request.form.get("landholding_category") or "").strip(),
            "crop_type": (request.form.get("crop_type") or "").strip(),
        }

        errors = {}
        if not criteria["state"]:
            errors["state"] = "Please select your state."

        if not criteria["land_size"]:
            errors["land_size"] = "Please enter your land size in acres."
        else:
            try:
                ls = float(criteria["land_size"])
                if ls < 0:
                    errors["land_size"] = "Land size cannot be negative."
            except ValueError:
                errors["land_size"] = "Land size must be a number."

        if errors:
            return render_template(
                "subsidy_checker.html",
                errors=errors,
                form_data=criteria
            ), 400

        matched_schemes = SubsidyMatcherService.match(
            state=criteria["state"],
            district=criteria["district"],
            land_size=criteria["land_size"],
            crop_type=criteria["crop_type"]
        )

        session["last_subsidy_check"] = criteria

        if user:
            SchemeRepository.save_match_history(
                user_id=user["id"],
                submitted_profile=criteria,
                match_count=len(matched_schemes)
            )

        total_active_schemes = SchemeRepository.count_active()
        checked_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

        return render_template(
            "subsidy_results.html",
            schemes=matched_schemes,
            criteria=criteria,
            match_count=len(matched_schemes),
            schemes_checked=total_active_schemes,
            checked_at=checked_at
        )

    return render_template("subsidy_checker.html")


@subsidies_bp.route("/subsidy-results")
@subsidies_bp.route("/subsidies/results")
def subsidy_results_view():
    user = get_current_user()
    if user and (user.get("role") or "").strip().lower() == "buyer":
        return render_template(
            "403.html",
            message="Government Subsidy Discovery is exclusively available to cultivating farmers. Buyers can browse and search the marketplace.",
            user=user,
            required_role="farmer",
            current_role="buyer"
        ), 403

    criteria = session.get("last_subsidy_check")
    total_active_schemes = SchemeRepository.count_active()

    if not criteria:
        return render_template(
            "subsidy_results.html",
            schemes=[],
            criteria=None,
            match_count=0,
            schemes_checked=total_active_schemes,
            checked_at=None
        )

    matched_schemes = SubsidyMatcherService.match(
        state=criteria.get("state"),
        district=criteria.get("district"),
        land_size=criteria.get("land_size"),
        crop_type=criteria.get("crop_type")
    )
    checked_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    return render_template(
        "subsidy_results.html",
        schemes=matched_schemes,
        criteria=criteria,
        match_count=len(matched_schemes),
        schemes_checked=total_active_schemes,
        checked_at=checked_at
    )
