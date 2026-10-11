import sqlite3
import pytest
from repositories.user_repository import UserRepository
from database import migrate_db

def test_farmer_registration(app, client):
    """Verify farmer registration via /register/farmer."""
    res = client.get("/register/farmer")
    assert res.status_code == 200
    assert b"Register as a farmer" in res.data
    assert b"land_size" in res.data

    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/register/farmer",
        data={
            "full_name": "Balram Yadav",
            "email": "balram@test.in",
            "phone": "9848123499",
            "state": "Telangana",
            "district": "Warangal",
            "land_size": "4.5",
            "land_unit": "acres",
            "preferred_crop": "Paddy",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
        follow_redirects=False,
    )
    # Redirects to farmer dashboard
    assert response.status_code == 302
    assert "/dashboard" in response.headers["Location"]

    with app.app_context():
        user = UserRepository.find_by_email("balram@test.in")
        assert user is not None
        assert user["role"] == "farmer"
        assert user["preferred_crop"] == "Paddy"
        assert float(user["land_size"]) == 4.5


def test_buyer_registration(app, client):
    """Verify buyer registration via /register/buyer."""
    res = client.get("/register/buyer")
    assert res.status_code == 200
    assert b"Register as a buyer" in res.data
    assert b"buyer_type" in res.data

    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/register/buyer",
        data={
            "full_name": "Kavitha Traders",
            "email": "kavitha.buyer@test.in",
            "phone": "9848556677",
            "buyer_type": "Retailer",
            "organisation_name": "Kavitha Fresh Stores",
            "state": "Telangana",
            "district": "Warangal",
            "crops_of_interest": "Paddy, Tomato, Cotton",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
        follow_redirects=False,
    )
    # Redirects to buyer dashboard
    assert response.status_code == 302
    assert "/buyer/dashboard" in response.headers["Location"]

    with app.app_context():
        user = UserRepository.find_by_email("kavitha.buyer@test.in")
        assert user is not None
        assert user["role"] == "buyer"
        assert user["buyer_type"] == "Retailer"
        assert user["organisation_name"] == "Kavitha Fresh Stores"
        assert user["crops_of_interest"] == "Paddy, Tomato, Cotton"


def test_duplicate_email_across_roles(client):
    """Reject duplicate emails across both farmer and buyer roles with clear message."""
    client.get("/register/farmer")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Register farmer
    res_f = client.post(
        "/register/farmer",
        data={
            "full_name": "Farmer One",
            "email": "shared@domain.in",
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
        follow_redirects=False,
    )
    assert res_f.status_code == 302

    # Attempt to register buyer with same email
    client.get("/register/buyer")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    res_buyer = client.post(
        "/register/buyer",
        data={
            "full_name": "Buyer One",
            "email": "shared@domain.in",
            "buyer_type": "Trader",
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
    )
    assert res_buyer.status_code == 400
    assert b"already registered" in res_buyer.data

    # Attempt to register farmer with existing seed buyer email
    client.get("/register/farmer")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    res_farmer = client.post(
        "/register/farmer",
        data={
            "full_name": "Another Farmer",
            "email": "buyer@agriconnect.in",
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
    )
    assert res_farmer.status_code == 400
    assert b"already registered" in res_farmer.data


def test_role_forced_from_route(app, client):
    """The server sets role strictly from route. Tampered role values from browser are ignored."""
    client.get("/register/farmer")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Tamper attempt: send role='buyer' to /register/farmer
    client.post(
        "/register/farmer",
        data={
            "full_name": "Tamper Farmer",
            "email": "tamper.farmer@test.in",
            "role": "buyer",  # TAMPERED
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
    )
    with app.app_context():
        farmer_user = UserRepository.find_by_email("tamper.farmer@test.in")
        assert farmer_user["role"] == "farmer"

    # Tamper attempt: send role='farmer' to /register/buyer
    client.get("/register/buyer")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    client.post(
        "/register/buyer",
        data={
            "full_name": "Tamper Buyer",
            "email": "tamper.buyer@test.in",
            "role": "farmer",  # TAMPERED
            "buyer_type": "Trader",
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "csrf_token": csrf,
        },
    )
    with app.app_context():
        buyer_user = UserRepository.find_by_email("tamper.buyer@test.in")
        assert buyer_user["role"] == "buyer"


def test_buyer_blocked_from_creating_listings(client, auth):
    """Buyers cannot create, edit, or delete listings; returns 403."""
    # Login as seeded buyer
    auth.login(email="buyer@agriconnect.in", password="demo1234")

    # Access create listing page
    res_get = client.get("/listings/new")
    assert res_get.status_code == 403
    assert b"Access Restricted" in res_get.data or b"reserved for farmer" in res_get.data

    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Submit create listing
    res_post = client.post(
        "/listings/new",
        data={
            "crop_name": "Illegal Crop Lot",
            "quantity": "50",
            "unit": "quintal",
            "csrf_token": csrf,
        },
    )
    assert res_post.status_code == 403


def test_buyer_blocked_from_advisory_and_subsidy(client, auth):
    """Buyers cannot access crop advisory or subsidy checker; direct access returns 403."""
    auth.login(email="buyer@agriconnect.in", password="demo1234")

    res_adv = client.get("/crop-advisory")
    assert res_adv.status_code == 403
    assert b"Access Restricted" in res_adv.data or b"farmer" in res_adv.data

    res_sub = client.get("/subsidy-checker")
    assert res_sub.status_code == 403
    assert b"Access Restricted" in res_sub.data or b"farmer" in res_sub.data


def test_farmer_blocked_from_buyer_dashboard(client, auth):
    """Farmers cannot access the buyer dashboard; returns 403."""
    # Login as farmer
    auth.login(email="demo@agriconnect.in", password="demo1234")

    res = client.get("/buyer/dashboard")
    assert res.status_code == 403
    assert b"Access Restricted" in res.data or b"buyer" in res.data


def test_login_redirect_by_role(client):
    """Login redirects farmers to /dashboard and buyers to /buyer/dashboard."""
    client.get("/login")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Farmer login
    res_farmer = client.post(
        "/login",
        data={"email": "demo@agriconnect.in", "password": "demo1234", "csrf_token": csrf},
        follow_redirects=False,
    )
    assert res_farmer.status_code == 302
    assert "/dashboard" in res_farmer.headers["Location"]
    assert "/buyer/dashboard" not in res_farmer.headers["Location"]

    # Buyer login
    res_buyer = client.post(
        "/login",
        data={"email": "buyer@agriconnect.in", "password": "demo1234", "csrf_token": csrf},
        follow_redirects=False,
    )
    assert res_buyer.status_code == 302
    assert "/buyer/dashboard" in res_buyer.headers["Location"]


def test_safe_migration_existing_users_stay_farmers():
    """Verify safe database migration adds new columns and preserves existing users as farmers."""
    conn = sqlite3.connect(":memory:")
    # Create old table without role, buyer_type, organisation_name, crops_of_interest
    conn.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            password_hash TEXT NOT NULL,
            state TEXT,
            district TEXT,
            land_size REAL,
            preferred_crop TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT
        );
        """
    )
    conn.execute(
        """
        INSERT INTO users (name, email, password_hash, state, district, land_size, preferred_crop, created_at, updated_at)
        VALUES ('Existing Farmer', 'old@farm.in', 'hash123', 'Telangana', 'Warangal', 3.0, 'Paddy', '01 Jan 2026', '01 Jan 2026');
        """
    )
    conn.commit()

    # Execute migration
    migrate_db(conn)

    # Check that columns were added
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(users);")
    columns = {r[1] for r in cur.fetchall()}
    assert "role" in columns
    assert "buyer_type" in columns
    assert "organisation_name" in columns
    assert "crops_of_interest" in columns

    # Verify existing user remains and defaults to 'farmer'
    cur.execute("SELECT name, email, role, land_size FROM users WHERE email = 'old@farm.in'")
    row = cur.fetchone()
    assert row is not None
    assert row[0] == "Existing Farmer"
    assert row[1] == "old@farm.in"
    assert row[2] == "farmer"
    assert float(row[3]) == 3.0
    conn.close()
