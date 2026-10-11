def test_marketplace_loads(client):
    response = client.get("/marketplace")
    assert response.status_code == 200
    assert b"Marketplace" in response.data
    assert b"Paddy" in response.data or b"Cotton" in response.data


def test_marketplace_search_and_filter(client):
    # Search for Wheat
    response = client.get("/marketplace?q=Wheat")
    assert response.status_code == 200

    # Filter by state
    response = client.get("/marketplace?state=Telangana")
    assert response.status_code == 200
    assert b"Telangana" in response.data

    # Filter by price range
    response = client.get("/marketplace?min_price=2000&max_price=3000")
    assert response.status_code == 200


def test_create_listing_requires_auth(client):
    response = client.get("/listings/new", follow_redirects=False)
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]


def test_create_listing_success(client, auth):
    auth.login()
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/listings/new",
        data={
            "crop_name": "Organic Soybean",
            "quantity": "25",
            "unit": "quintal",
            "expected_price": "4500",
            "state": "Telangana",
            "district": "Warangal",
            "availability_date": "2026-11-15",
            "description": "High oil content organic soybean harvest.",
            "contact_info": "9848012345",
            "csrf_token": csrf,
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"published" in response.data
    assert b"Organic Soybean" in response.data


def test_reject_negative_quantity(client, auth):
    auth.login()
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/listings/new",
        data={
            "crop_name": "Organic Soybean",
            "quantity": "-10",  # invalid
            "unit": "quintal",
            "expected_price": "4500",
            "state": "Telangana",
            "district": "Warangal",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 400
    assert b"negative" in response.data or b"Quantity" in response.data


def test_prevent_unauthorized_edit_of_other_user_listing(client, auth):
    # Login as Suresh Naik (user_id = 3)
    auth.login("suresh@example.in", "demo1234")

    # Try to edit listing 1 (belongs to Ramesh Kumar, user_id = 1)
    response = client.get("/listings/1/edit", follow_redirects=True)
    assert b"only edit your own listings" in response.data


def test_delete_own_listing(client, auth):
    # Login as Ramesh Kumar (user_id = 1)
    auth.login("demo@agriconnect.in", "demo1234")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Listing 1 belongs to user 1
    response = client.post(
        "/listings/1/delete",
        data={"csrf_token": csrf},
        follow_redirects=True
    )
    assert response.status_code == 200
    assert b"deleted" in response.data
