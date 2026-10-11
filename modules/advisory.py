from flask import Blueprint, render_template, request, redirect, url_for
from modules import get_current_user
from services.advisory_engine import CropAdvisoryEngine
from repositories.advisory_repository import AdvisoryRepository

advisory_bp = Blueprint("advisory", __name__)

@advisory_bp.route("/crop-advisory", methods=["GET", "POST"])
@advisory_bp.route("/advisory", methods=["GET", "POST"])
def crop_advisory_view():
    user = get_current_user()
    if user and (user.get("role") or "").strip().lower() == "buyer":
        return render_template(
            "403.html",
            message="Crop Advisory is exclusively available to cultivating farmers. Buyers can browse and search the marketplace.",
            user=user,
            required_role="farmer",
            current_role="buyer"
        ), 403

    if request.method == "POST":
        data = {
            "crop_name": (request.form.get("crop_name") or "").strip(),
            "growth_stage": (request.form.get("growth_stage") or "").strip(),
            "soil_type": (request.form.get("soil_type") or "").strip(),
            "symptoms": (request.form.get("symptoms") or "").strip(),
            "irrigation": (request.form.get("irrigation") or "").strip(),
            "weather": (request.form.get("weather") or "").strip(),
        }

        errors = {}
        required_fields = [
            ("crop_name", "crop name"),
            ("growth_stage", "growth stage"),
            ("soil_type", "soil type"),
            ("symptoms", "symptoms"),
            ("irrigation", "irrigation availability"),
        ]

        for field, label in required_fields:
            if not data.get(field):
                errors[field] = f"Please provide the {label}."

        if errors:
            return render_template(
                "crop_advisory.html",
                errors=errors,
                form_data=data,
                query_data=data
            ), 400

        advisory_result = CropAdvisoryEngine.evaluate(
            crop_name=data["crop_name"],
            growth_stage=data["growth_stage"],
            soil_type=data["soil_type"],
            symptoms=data["symptoms"],
            irrigation=data["irrigation"],
            weather=data["weather"]
        )

        query_id = AdvisoryRepository.save_query(
            user_id=user["id"] if user else None,
            crop_name=data["crop_name"],
            growth_stage=data["growth_stage"],
            soil_type=data["soil_type"],
            symptoms=data["symptoms"],
            irrigation=data["irrigation"],
            weather=data["weather"],
            advisory_result=advisory_result
        )

        return redirect(url_for("advisory_result", query_id=query_id))

    return render_template("crop_advisory.html")


@advisory_bp.route("/crop-advisory/<int:query_id>")
@advisory_bp.route("/advisory/<int:query_id>")
def advisory_result_view(query_id):
    user = get_current_user()
    if user and (user.get("role") or "").strip().lower() == "buyer":
        return render_template(
            "403.html",
            message="Crop Advisory is exclusively available to cultivating farmers. Buyers can browse and search the marketplace.",
            user=user,
            required_role="farmer",
            current_role="buyer"
        ), 403

    row = AdvisoryRepository.find_query_by_id(query_id)
    if not row:
        return render_template("advisory_result.html", query=None, advisory=None), 404

    advisory = {
        "no_match": bool(row.get("no_match")),
        "title": row.get("result_title"),
        "recommendation": row.get("recommendation"),
        "summary": row.get("summary"),
        "rule_name": row.get("rule_name"),
        "explanation": row.get("explanation"),
        "matched_conditions": row.get("matched_conditions") or [],
        "next_steps": row.get("next_steps") or [],
        "caution": row.get("caution"),
        "severity": row.get("severity"),
    }

    return render_template("advisory_result.html", query=row, advisory=advisory)
