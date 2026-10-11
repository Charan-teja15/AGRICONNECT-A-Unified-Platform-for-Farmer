import os
import tempfile
import pytest
from app import create_app
import database
from seed_data import seed_database

@pytest.fixture
def app():
    """Create and configure a new Flask app instance for each test."""
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    
    app = create_app("testing")
    app.config["DATABASE_PATH"] = db_path
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        database.init_db()
        seed_database(db_path)

    yield app

    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """A test CLI runner for the app."""
    return app.test_cli_runner()


class AuthActions:
    def __init__(self, client):
        self._client = client

    def login(self, email="demo@agriconnect.in", password="demo1234"):
        # Fetch login to obtain CSRF session token if needed
        res = self._client.get("/login")
        csrf_token = ""
        with self._client.session_transaction() as sess:
            csrf_token = sess.get("_csrf_token", "")
        return self._client.post(
            "/login",
            data={"email": email, "password": password, "csrf_token": csrf_token},
            follow_redirects=True
        )

    def logout(self):
        return self._client.post("/logout", follow_redirects=True)


@pytest.fixture
def auth(client):
    return AuthActions(client)
