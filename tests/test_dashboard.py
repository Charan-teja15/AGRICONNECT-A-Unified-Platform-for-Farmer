def test_dashboard_authenticated_user_isolation(client, auth):
    # Login as Ramesh Kumar (has 3 listings)
    auth.login("demo@agriconnect.in", "demo1234")
    response = client.get("/dashboard")
    assert response.status_code == 200
    assert b"Ramesh Kumar" in response.data
    assert b"Active crop listings" in response.data or b"active_listings" in response.data

    auth.logout()

    # Login as Suresh Naik
    auth.login("suresh@example.in", "demo1234")
    response2 = client.get("/dashboard")
    assert response2.status_code == 200
    assert b"Suresh Naik" in response2.data
    # Should not display Ramesh's email
    assert b"demo@agriconnect.in" not in response2.data
