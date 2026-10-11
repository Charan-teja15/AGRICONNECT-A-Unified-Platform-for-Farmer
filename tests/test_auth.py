def test_register_page_loads(client):
    response = client.get("/register")
    assert response.status_code == 200
    assert b"Create your farmer profile" in response.data or b"Register" in response.data


def test_register_successful(client):
    res = client.get("/register")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/register",
        data={
            "full_name": "Venkat Reddy",
            "email": "venkat@test.in",
            "phone": "9848123456",
            "state": "Telangana",
            "district": "Warangal",
            "land_size": "3.5",
            "preferred_crop": "Cotton",
            "password": "Password123",
            "confirm_password": "Password123",
            "csrf_token": csrf,
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Welcome to AGRICONNECT" in response.data or b"Venkat" in response.data


def test_register_duplicate_email(client):
    res = client.get("/register")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/register",
        data={
            "full_name": "Duplicate User",
            "email": "demo@agriconnect.in",  # already exists
            "state": "Telangana",
            "district": "Warangal",
            "password": "Password123",
            "confirm_password": "Password123",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 400
    assert b"already registered" in response.data


def test_login_successful(client, auth):
    response = auth.login("demo@agriconnect.in", "demo1234")
    assert response.status_code == 200
    assert b"Welcome back, Ramesh!" in response.data or b"Ramesh Kumar" in response.data


def test_login_invalid_password(client, auth):
    response = auth.login("demo@agriconnect.in", "wrongpassword")
    assert b"not correct" in response.data


def test_protected_routes_require_login(client):
    response = client.get("/dashboard", follow_redirects=False)
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]

    response = client.get("/profile", follow_redirects=False)
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]

    response = client.get("/listings/new", follow_redirects=False)
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]


def test_logout(client, auth):
    auth.login()
    response = auth.logout()
    assert response.status_code == 200
    assert b"logged out" in response.data
