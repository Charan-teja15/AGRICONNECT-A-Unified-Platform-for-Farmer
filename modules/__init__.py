from functools import wraps
from flask import session, redirect, url_for, flash, request, render_template
from repositories.user_repository import UserRepository

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id or not UserRepository.find_by_id(user_id):
            flash("Please log in to continue.", "info")
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)
    return wrapped_view


def role_required(required_role):
    """
    Reusable decorator on top of the login-required check.
    Ensures user is logged in and possesses the specified role ('farmer' or 'buyer').
    If the role does not match, returns 403 with a friendly page.
    """
    def decorator(view):
        @wraps(view)
        def wrapped_view(*args, **kwargs):
            user = get_current_user()
            if not user:
                flash("Please log in to continue.", "info")
                return redirect(url_for("login", next=request.path))

            user_role = (user.get("role") or "farmer").strip().lower()
            target_role = required_role.strip().lower()

            if user_role != target_role:
                return render_template(
                    "403.html",
                    message=f"This section is reserved for {target_role} accounts. You are currently logged in as a {user_role}.",
                    user=user,
                    required_role=target_role,
                    current_role=user_role
                ), 403

            return view(*args, **kwargs)
        return wrapped_view
    return decorator


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return UserRepository.find_by_id(user_id)
