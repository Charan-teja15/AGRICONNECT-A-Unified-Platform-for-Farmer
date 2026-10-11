from flask import Blueprint, render_template, request, redirect, url_for, flash, abort
from modules import login_required, role_required, get_current_user
from repositories.listing_repository import ListingRepository
from repositories.order_repository import OrderRepository
from repositories.wishlist_repository import WishlistRepository

buyer_bp = Blueprint("buyer", __name__)

@buyer_bp.route("/listing/<int:listing_id>")
@buyer_bp.route("/listings/<int:listing_id>")
def listing_detail(listing_id):
    user = get_current_user()
    listing = ListingRepository.find_by_id(listing_id)
    if not listing:
        abort(404)

    is_wishlisted = False
    if user and user.get("role") == "buyer":
        is_wishlisted = WishlistRepository.is_in_wishlist(user["id"], listing_id)

    return render_template(
        "listing_detail.html",
        listing=listing,
        user=user,
        is_wishlisted=is_wishlisted
    )

@buyer_bp.route("/order/place", methods=["POST"])
@role_required("buyer")
def place_order():
    user = get_current_user()
    listing_id = request.form.get("listing_id")
    quantity_str = request.form.get("quantity")
    offered_price_str = request.form.get("offered_price")
    notes = request.form.get("notes", "").strip()

    if not listing_id:
        flash("Invalid listing.", "danger")
        return redirect(url_for("marketplace"))

    listing = ListingRepository.find_by_id(listing_id)
    if not listing:
        flash("Listing not found.", "danger")
        return redirect(url_for("marketplace"))

    errors = []
    try:
        qty = float(quantity_str)
        if qty <= 0:
            errors.append("Quantity must be greater than zero.")
        elif qty > float(listing["quantity"]):
            errors.append(f"Quantity requested ({qty}) exceeds available stock ({listing['quantity']} {listing['unit']}).")
    except (ValueError, TypeError):
        errors.append("Please enter a valid quantity.")

    try:
        offered_price = float(offered_price_str)
        if offered_price <= 0:
            errors.append("Offered price must be greater than zero.")
    except (ValueError, TypeError):
        errors.append("Please enter a valid price offer.")

    if errors:
        for err in errors:
            flash(err, "danger")
        return redirect(url_for("buyer.listing_detail", listing_id=listing_id))

    OrderRepository.create(
        buyer_id=user["id"],
        listing_id=listing["id"],
        quantity=qty,
        offered_price=offered_price,
        notes=notes
    )

    flash(f"Your order offer for {listing['crop_name']} has been placed successfully!", "success")
    return redirect(url_for("buyer.buyer_orders"))

@buyer_bp.route("/buyer/orders")
@role_required("buyer")
def buyer_orders():
    user = get_current_user()
    orders = OrderRepository.find_by_buyer(user["id"])
    stats = OrderRepository.get_buyer_stats(user["id"])
    return render_template("buyer_orders.html", user=user, orders=orders, stats=stats)

@buyer_bp.route("/order/cancel/<int:order_id>", methods=["POST"])
@role_required("buyer")
def cancel_order(order_id):
    user = get_current_user()
    OrderRepository.cancel_by_buyer(order_id, user["id"])
    flash("Order has been cancelled.", "info")
    return redirect(url_for("buyer.buyer_orders"))

@buyer_bp.route("/farmer/orders")
@role_required("farmer")
def farmer_orders():
    user = get_current_user()
    orders = OrderRepository.find_by_farmer(user["id"])
    return render_template("farmer_orders.html", user=user, orders=orders)

@buyer_bp.route("/order/accept/<int:order_id>", methods=["POST"])
@role_required("farmer")
def accept_order(order_id):
    user = get_current_user()
    order = OrderRepository.find_by_id(order_id)
    if not order or order["farmer_id"] != user["id"]:
        flash("Order not found or unauthorized.", "danger")
        return redirect(url_for("dashboard"))

    OrderRepository.update_status(order_id, "accepted")
    flash("Order accepted successfully!", "success")
    return redirect(url_for("buyer.farmer_orders"))

@buyer_bp.route("/order/reject/<int:order_id>", methods=["POST"])
@role_required("farmer")
def reject_order(order_id):
    user = get_current_user()
    order = OrderRepository.find_by_id(order_id)
    if not order or order["farmer_id"] != user["id"]:
        flash("Order not found or unauthorized.", "danger")
        return redirect(url_for("dashboard"))

    OrderRepository.update_status(order_id, "rejected")
    flash("Order rejected.", "info")
    return redirect(url_for("buyer.farmer_orders"))

@buyer_bp.route("/wishlist/toggle/<int:listing_id>", methods=["POST"])
@role_required("buyer")
def toggle_wishlist(listing_id):
    user = get_current_user()
    added = WishlistRepository.toggle(user["id"], listing_id)
    if added:
        flash("Listing added to your wishlist.", "success")
    else:
        flash("Listing removed from your wishlist.", "info")

    next_url = request.referrer or url_for("buyer.wishlist")
    return redirect(next_url)

@buyer_bp.route("/wishlist")
@buyer_bp.route("/buyer/wishlist")
@role_required("buyer")
def wishlist():
    user = get_current_user()
    items = WishlistRepository.find_by_buyer(user["id"])
    return render_template("wishlist.html", user=user, items=items)
