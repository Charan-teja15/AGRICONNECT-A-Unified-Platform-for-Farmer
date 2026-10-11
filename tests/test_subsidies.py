def test_subsidy_checker_page_loads(client):
    response = client.get("/subsidy-checker")
    assert response.status_code == 200
    assert b"Subsidy" in response.data or b"Check" in response.data


def test_subsidy_matching_pm_kisan(client):
    client.get("/subsidy-checker")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Profile matching central and state schemes
    response = client.post(
        "/subsidy-checker",
        data={
            "state": "Telangana",
            "district": "Warangal",
            "land_size": "2.5",
            "landholding_category": "Small (1\u20132 hectares)",
            "crop_type": "Paddy",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 200
    assert b"PM-KISAN" in response.data
    assert b"Rythu Bandhu" in response.data


def test_subsidy_state_filter_restriction(client):
    client.get("/subsidy-checker")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Karnataka farmer should NOT match Telangana-only scheme as primary
    response = client.post(
        "/subsidy-checker",
        data={
            "state": "Karnataka",
            "district": "Karimnagar",
            "land_size": "1.5",
            "crop_type": "Tomato",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 200
    assert b"PM-KISAN" in response.data


def test_subsidy_negative_land_rejected(client):
    client.get("/subsidy-checker")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/subsidy-checker",
        data={
            "state": "Telangana",
            "land_size": "-5",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 400
    assert b"negative" in response.data or b"land size" in response.data.lower()
