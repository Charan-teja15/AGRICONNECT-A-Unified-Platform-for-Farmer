from flask import Blueprint, render_template, request, redirect, url_for, flash, abort
from modules import login_required, role_required, get_current_user
from repositories.listing_repository import ListingRepository

marketplace_bp = Blueprint("marketplace", __name__)

class Pagination:
    def __init__(self, items, page, per_page, total):
        self.items = items
        self.page = page
        self.per_page = per_page
        self.total = total
        self.pages = max(1, (total + per_page - 1) // per_page)
        self.has_prev = page > 1
        self.has_next = page < self.pages
        self.prev_num = page - 1
        self.next_num = page + 1


def validate_listing_form(form):
    data = {
        "crop_name": (form.get("crop_name") or "").strip(),
        "quantity": (form.get("quantity") or "").strip(),
        "unit": (form.get("unit") or "quintal").strip(),
        "expected_price": (form.get("expected_price") or "").strip(),
        "state": (form.get("state") or "").strip(),
        "district": (form.get("district") or "").strip(),
        "availability_date": (form.get("availability_date") or "").strip(),
        "description": (form.get("description") or "").strip(),
        "contact_info": (form.get("contact_info") or "").strip(),
    }
    errors = {}

    if not data["crop_name"]:
        errors["crop_name"] = "Please enter the crop name."
    if not data["quantity"]:
        errors["quantity"] = "Please enter the quantity available."
    else:
        try:
            qty = float(data["quantity"])
            if qty < 0:
                errors["quantity"] = "Quantity cannot be negative."
        except ValueError:
            errors["quantity"] = "Quantity must be a number."

    if data["expected_price"]:
        try:
            p = float(data["expected_price"])
            if p < 0:
                errors["expected_price"] = "Expected price cannot be negative."
        except ValueError:
            errors["expected_price"] = "Expected price must be a number."

    if not data["state"]:
        errors["state"] = "Please select the state."
    if not data["district"]:
        errors["district"] = "Please enter the district."

    return data, errors


@marketplace_bp.route("/marketplace")
def marketplace_view():
    filters = {
        "q": (request.args.get("q") or "").strip(),
        "state": (request.args.get("state") or "").strip(),
        "district": (request.args.get("district") or "").strip(),
        "min_price": (request.args.get("min_price") or "").strip(),
        "max_price": (request.args.get("max_price") or "").strip(),
        "sort": request.args.get("sort") or "newest",
        "mine": request.args.get("mine") or "",
    }

    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    per_page = 9

    current_user = get_current_user()
    user_id_filter = current_user["id"] if (filters["mine"] and current_user) else None

    items, total = ListingRepository.find_all(
        q=filters["q"],
        state=filters["state"],
        district=filters["district"],
        min_price=filters["min_price"],
        max_price=filters["max_price"],
        sort=filters["sort"],
        user_id=user_id_filter,
        page=page,
        per_page=per_page
    )

    uid = current_user["id"] if current_user else None
    for item in items:
        item["is_owner"] = (uid is not None and item.get("user_id") == uid)

    pagination = Pagination(items, page, per_page, total)

    return render_template(
        "marketplace.html",
        listings=items,
        filters=filters,
        result_count=total,
        pagination=pagination
    )


@marketplace_bp.route("/listings/new", methods=["GET", "POST"])
@marketplace_bp.route("/marketplace/create", methods=["GET", "POST"])
@role_required("farmer")
def create_listing_view():
    user = get_current_user()

    if request.method == "POST":
        data, errors = validate_listing_form(request.form)
        if errors:
            return render_template(
                "create_listing.html",
                user=user,
                errors=errors,
                form_data=data
            ), 400

        ListingRepository.create(
            user_id=user["id"],
            crop_name=data["crop_name"],
            quantity=data["quantity"],
            unit=data["unit"],
            expected_price=data["expected_price"],
            state=data["state"],
            district=data["district"],
            availability_date=data["availability_date"],
            description=data["description"],
            contact_info=data["contact_info"]
        )
        flash("Your crop listing has been published.", "success")
        return redirect(url_for("marketplace", mine=1))

    default_contact = user.get("phone") or user.get("email") or ""
    return render_template(
        "create_listing.html",
        user=user,
        form_data={"contact_info": default_contact}
    )


@marketplace_bp.route("/listings/<int:listing_id>/edit", methods=["GET", "POST"])
@marketplace_bp.route("/marketplace/edit/<int:listing_id>", methods=["GET", "POST"])
@role_required("farmer")
def edit_listing_view(listing_id):
    user = get_current_user()
    listing = ListingRepository.find_by_id(listing_id)

    if not listing:
        abort(404)
    if listing["user_id"] != user["id"]:
        flash("You can only edit your own listings.", "danger")
        return redirect(url_for("marketplace"))

    if request.method == "POST":
        data, errors = validate_listing_form(request.form)
        status = request.form.get("status") or "available"

        if errors:
            return render_template(
                "edit_listing.html",
                listing=listing,
                errors=errors,
                form_data=data
            ), 400

        ListingRepository.update(
            listing_id=listing_id,
            crop_name=data["crop_name"],
            quantity=data["quantity"],
            unit=data["unit"],
            expected_price=data["expected_price"],
            state=data["state"],
            district=data["district"],
            availability_date=data["availability_date"],
            description=data["description"],
            contact_info=data["contact_info"],
            status=status
        )
        flash("Your listing has been updated.", "success")
        return redirect(url_for("marketplace", mine=1))

    return render_template("edit_listing.html", listing=listing, form_data=listing)


@marketplace_bp.route("/listings/<int:listing_id>/delete", methods=["POST"])
@marketplace_bp.route("/marketplace/delete/<int:listing_id>", methods=["POST"])
@role_required("farmer")
def delete_listing_view(listing_id):
    user = get_current_user()
    listing = ListingRepository.find_by_id(listing_id)

    if not listing:
        abort(404)
    if listing["user_id"] != user["id"]:
        flash("You can only delete your own listings.", "danger")
        return redirect(url_for("marketplace"))

    ListingRepository.delete(listing_id)
    flash("The listing has been deleted.", "success")
    return redirect(url_for("marketplace", mine=1))
