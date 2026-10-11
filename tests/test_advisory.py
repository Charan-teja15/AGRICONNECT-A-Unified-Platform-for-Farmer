def test_advisory_page_loads(client):
    response = client.get("/crop-advisory")
    assert response.status_code == 200
    assert b"Crop Advisory" in response.data


def test_advisory_rule_match(client):
    client.get("/crop-advisory")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    # Symptoms indicating nitrogen deficiency
    response = client.post(
        "/crop-advisory",
        data={
            "crop_name": "Paddy",
            "growth_stage": "Vegetative",
            "soil_type": "Sandy",
            "symptoms": "Yellowing on the lower leaves of the crop",
            "irrigation": "Limited irrigation",
            "weather": "Normal",
            "csrf_token": csrf,
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"RULE-NITRO-01" in response.data
    assert b"nitrogen" in response.data or b"Yellowing" in response.data


def test_advisory_no_matching_rule(client):
    client.get("/crop-advisory")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/crop-advisory",
        data={
            "crop_name": "Paddy",
            "growth_stage": "Seedling",
            "soil_type": "Clay",
            "symptoms": "completely alien phenomenon with glowing purple lights",
            "irrigation": "Adequate irrigation",
            "weather": "Normal",
            "csrf_token": csrf,
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"No matching" in response.data or b"consult a qualified" in response.data


def test_advisory_missing_fields_validation(client):
    client.get("/crop-advisory")
    with client.session_transaction() as sess:
        csrf = sess.get("_csrf_token", "")

    response = client.post(
        "/crop-advisory",
        data={
            "crop_name": "",  # missing
            "symptoms": "",
            "csrf_token": csrf,
        },
    )
    assert response.status_code == 400
    assert b"Please provide" in response.data
