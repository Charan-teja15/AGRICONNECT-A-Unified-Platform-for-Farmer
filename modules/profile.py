from flask import Blueprint, render_template, request, redirect, url_for, flash
from modules import login_required, get_current_user
from repositories.user_repository import UserRepository

profile_bp = Blueprint("profile", __name__)

BUYER_TYPES = ["Trader", "Retailer", "Restaurant/Hotel", "FPO/Cooperative", "Other"]

@profile_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile_view():
    user = get_current_user()
    user_role = (user.get("role") or "farmer").strip().lower()
    edit_mode = request.args.get("edit") == "1"

    if request.method == "POST":
        errors = {}

        if user_role == "buyer":
            data = {
                "full_name": (request.form.get("full_name") or "").strip(),
                "email": (request.form.get("email") or "").strip(),
                "phone": (request.form.get("phone") or "").strip(),
                "state": (request.form.get("state") or "").strip(),
                "district": (request.form.get("district") or "").strip(),
                "buyer_type": (request.form.get("buyer_type") or "").strip(),
                "organisation_name": (request.form.get("organisation_name") or "").strip(),
                "crops_of_interest": (request.form.get("crops_of_interest") or "").strip(),
            }

            if not data["full_name"]:
                errors["full_name"] = "Please enter your full name."
            elif len(data["full_name"]) > 80:
                errors["full_name"] = "Full name cannot exceed 80 characters."

            if not data["email"] or "@" not in data["email"]:
                errors["email"] = "Please enter a valid email address."
            elif len(data["email"]) > 120:
                errors["email"] = "Email cannot exceed 120 characters."
            elif UserRepository.email_exists(data["email"], exclude_id=user["id"]):
                errors["email"] = "That email is already used by another account."

            if not data["buyer_type"]:
                errors["buyer_type"] = "Please select your buyer type."
            elif data["buyer_type"] not in BUYER_TYPES:
                errors["buyer_type"] = f"Buyer type must be one of: {', '.join(BUYER_TYPES)}."

            if not data["state"]:
                errors["state"] = "Please select your state."
            if not data["district"]:
                errors["district"] = "Please enter your district."

            if len(data["organisation_name"]) > 100:
                errors["organisation_name"] = "Organisation name cannot exceed 100 characters."

            if errors:
                return render_template(
                    "profile.html",
                    user=user,
                    errors=errors,
                    form_data=data,
                    edit_mode=True
                ), 400

            UserRepository.update(
                user_id=user["id"],
                name=data["full_name"],
                email=data["email"],
                phone=data["phone"],
                state=data["state"],
                district=data["district"],
                buyer_type=data["buyer_type"],
                organisation_name=data["organisation_name"],
                crops_of_interest=data["crops_of_interest"]
            )

        else:
            # Farmer profile update
            data = {
                "full_name": (request.form.get("full_name") or "").strip(),
                "email": (request.form.get("email") or "").strip(),
                "phone": (request.form.get("phone") or "").strip(),
                "state": (request.form.get("state") or "").strip(),
                "district": (request.form.get("district") or "").strip(),
                "land_size": (request.form.get("land_size") or "").strip(),
                "land_unit": (request.form.get("land_unit") or "acres").strip(),
                "preferred_crop": (request.form.get("preferred_crop") or "").strip(),
            }

            if not data["full_name"]:
                errors["full_name"] = "Please enter your full name."
            elif len(data["full_name"]) > 80:
                errors["full_name"] = "Full name cannot exceed 80 characters."

            if not data["email"] or "@" not in data["email"]:
                errors["email"] = "Please enter a valid email address."
            elif len(data["email"]) > 120:
                errors["email"] = "Email cannot exceed 120 characters."
            elif UserRepository.email_exists(data["email"], exclude_id=user["id"]):
                errors["email"] = "That email is already used by another account."

            if not data["state"]:
                errors["state"] = "Please select your state."
            if not data["district"]:
                errors["district"] = "Please enter your district."

            if data["land_size"]:
                try:
                    ls = float(data["land_size"])
                    if ls < 0:
                        errors["land_size"] = "Land size cannot be negative."
                except ValueError:
                    errors["land_size"] = "Land size must be a number."

            if errors:
                return render_template(
                    "profile.html",
                    user=user,
                    errors=errors,
                    form_data=data,
                    edit_mode=True
                ), 400

            UserRepository.update(
                user_id=user["id"],
                name=data["full_name"],
                email=data["email"],
                phone=data["phone"],
                state=data["state"],
                district=data["district"],
                land_size=data["land_size"],
                land_unit=data["land_unit"],
                preferred_crop=data["preferred_crop"]
            )

        flash("Your profile has been updated.", "success")
        return redirect(url_for("profile"))

    if user_role == "buyer":
        fields = ["name", "email", "phone", "state", "district", "buyer_type", "organisation_name", "crops_of_interest"]
    else:
        fields = ["name", "email", "phone", "state", "district", "land_size", "preferred_crop"]

    filled = sum(1 for f in fields if user.get(f))
    profile_completion = int(round(filled / len(fields) * 100))

    return render_template(
        "profile.html",
        user=user,
        edit_mode=edit_mode,
        member_since=user.get("created_at"),
        profile_completion=profile_completion
    )
