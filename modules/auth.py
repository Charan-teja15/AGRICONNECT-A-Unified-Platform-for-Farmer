from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from repositories.user_repository import UserRepository

auth_bp = Blueprint("auth", __name__)

BUYER_TYPES = ["Trader", "Retailer", "Restaurant/Hotel", "FPO/Cooperative", "Other"]


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip()
        password = request.form.get("password") or ""
        remember = request.form.get("remember")
        user = UserRepository.find_by_email_or_name(email)

        if not user or not check_password_hash(user["password_hash"], password):
            return render_template(
                "login.html",
                errors={"general": "The email/username or password is not correct."},
                form_data={"email": email, "remember": remember}
            ), 401

        session.clear()
        session["user_id"] = user["id"]
        if remember:
            session.permanent = True

        first_name = user["name"].split()[0] if user.get("name") else "User"
        user_role = (user.get("role") or "farmer").strip().lower()

        # Redirect by role to farmer dashboard or buyer dashboard
        default_target = url_for("buyer_dashboard") if user_role == "buyer" else url_for("dashboard")
        next_param = request.form.get("next") or request.args.get("next")

        # Protect cross-role redirect on next parameter
        if next_param:
            if user_role == "buyer" and (next_param.startswith("/dashboard") or next_param.startswith("/crop-advisory") or next_param.startswith("/subsidy-checker")):
                next_url = default_target
            elif user_role == "farmer" and next_param.startswith("/buyer/dashboard"):
                next_url = default_target
            else:
                next_url = next_param
        else:
            next_url = default_target

        flash(f"Welcome back, {first_name}!", "success")
        return redirect(next_url)

    return render_template("login.html")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """
    GET: Displays choice page with two cards ('I am a Farmer' and 'I am a Buyer').
    POST: Preserves backward compatibility by routing form submission to farmer registration.
    """
    if request.method == "POST":
        return _process_farmer_registration(request, fallback_template="register_farmer.html")
    return render_template("register.html")


@auth_bp.route("/register/farmer", methods=["GET", "POST"])
def register_farmer():
    """Farmer registration route. Role is strictly forced to 'farmer' by the server."""
    if request.method == "POST":
        return _process_farmer_registration(request, fallback_template="register_farmer.html")
    return render_template("register_farmer.html")


@auth_bp.route("/register/buyer", methods=["GET", "POST"])
def register_buyer():
    """Buyer registration route. Role is strictly forced to 'buyer' by the server."""
    if request.method == "POST":
        return _process_buyer_registration(request, fallback_template="register_buyer.html")
    return render_template("register_buyer.html")


def _process_farmer_registration(req, fallback_template="register_farmer.html"):
    """Validates and registers a farmer. The server forces role='farmer'."""
    data = {
        "full_name": (req.form.get("full_name") or "").strip(),
        "email": (req.form.get("email") or "").strip(),
        "phone": (req.form.get("phone") or "").strip(),
        "state": (req.form.get("state") or "").strip(),
        "district": (req.form.get("district") or "").strip(),
        "land_size": (req.form.get("land_size") or "").strip(),
        "land_unit": (req.form.get("land_unit") or "acres").strip(),
        "preferred_crop": (req.form.get("preferred_crop") or "").strip(),
    }
    password = req.form.get("password") or ""
    confirm = req.form.get("confirm_password") or ""
    errors = {}

    # Server-side validation with length limits
    if not data["full_name"]:
        errors["full_name"] = "Please enter your full name."
    elif len(data["full_name"]) > 80:
        errors["full_name"] = "Full name cannot exceed 80 characters."

    if not data["email"] or "@" not in data["email"]:
        errors["email"] = "Please enter a valid email address."
    elif len(data["email"]) > 120:
        errors["email"] = "Email address cannot exceed 120 characters."
    elif UserRepository.email_exists(data["email"]):
        errors["email"] = "This email is already registered. Try logging in."

    if not data["state"]:
        errors["state"] = "Please select your state."
    if not data["district"]:
        errors["district"] = "Please enter your district."

    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters long."
    elif len(password) > 128:
        errors["password"] = "Password is too long (maximum 128 characters)."
    if password != confirm:
        errors["confirm_password"] = "The two passwords do not match."

    if data["land_size"]:
        try:
            ls = float(data["land_size"])
            if ls < 0:
                errors["land_size"] = "Land size cannot be negative."
        except ValueError:
            errors["land_size"] = "Land size must be a number."

    if errors:
        # Passwords intentionally omitted from form_data for security
        return render_template(fallback_template, errors=errors, form_data=data), 400

    pwd_hash = generate_password_hash(password)
    # The server strictly sets the role from the route. Never trust role from browser!
    user_id = UserRepository.create(
        name=data["full_name"],
        email=data["email"],
        password_hash=pwd_hash,
        phone=data["phone"],
        state=data["state"],
        district=data["district"],
        land_size=data["land_size"],
        land_unit=data["land_unit"],
        preferred_crop=data["preferred_crop"],
        role="farmer"
    )

    session.clear()
    session["user_id"] = user_id
    flash("Your farmer profile has been created. Welcome to AGRICONNECT!", "success")
    return redirect(url_for("dashboard"))


def _process_buyer_registration(req, fallback_template="register_buyer.html"):
    """Validates and registers a buyer. The server forces role='buyer'."""
    data = {
        "full_name": (req.form.get("full_name") or "").strip(),
        "email": (req.form.get("email") or "").strip(),
        "phone": (req.form.get("phone") or "").strip(),
        "buyer_type": (req.form.get("buyer_type") or "").strip(),
        "organisation_name": (req.form.get("organisation_name") or "").strip(),
        "state": (req.form.get("state") or "").strip(),
        "district": (req.form.get("district") or "").strip(),
        "crops_of_interest": (req.form.get("crops_of_interest") or "").strip(),
    }
    password = req.form.get("password") or ""
    confirm = req.form.get("confirm_password") or ""
    errors = {}

    # Server-side validation with length limits
    if not data["full_name"]:
        errors["full_name"] = "Please enter your full name."
    elif len(data["full_name"]) > 80:
        errors["full_name"] = "Full name cannot exceed 80 characters."

    if not data["email"] or "@" not in data["email"]:
        errors["email"] = "Please enter a valid email address."
    elif len(data["email"]) > 120:
        errors["email"] = "Email address cannot exceed 120 characters."
    elif UserRepository.email_exists(data["email"]):
        errors["email"] = "This email is already registered. Try logging in."

    if not data["buyer_type"]:
        errors["buyer_type"] = "Please select your buyer type."
    elif data["buyer_type"] not in BUYER_TYPES:
        errors["buyer_type"] = f"Buyer type must be one of: {', '.join(BUYER_TYPES)}."

    if len(data["organisation_name"]) > 100:
        errors["organisation_name"] = "Organisation name cannot exceed 100 characters."

    if not data["state"]:
        errors["state"] = "Please select your state."
    if not data["district"]:
        errors["district"] = "Please enter your district."

    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters long."
    elif len(password) > 128:
        errors["password"] = "Password is too long (maximum 128 characters)."
    if password != confirm:
        errors["confirm_password"] = "The two passwords do not match."

    if errors:
        # Passwords intentionally omitted from form_data for security
        return render_template(fallback_template, errors=errors, form_data=data), 400

    pwd_hash = generate_password_hash(password)
    # The server strictly sets the role from the route. Never trust role from browser!
    user_id = UserRepository.create(
        name=data["full_name"],
        email=data["email"],
        password_hash=pwd_hash,
        phone=data["phone"],
        state=data["state"],
        district=data["district"],
        buyer_type=data["buyer_type"],
        organisation_name=data["organisation_name"],
        crops_of_interest=data["crops_of_interest"],
        role="buyer"
    )

    session.clear()
    session["user_id"] = user_id
    flash("Your buyer profile has been created. Welcome to AGRICONNECT!", "success")
    return redirect(url_for("buyer_dashboard"))


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("index"))
