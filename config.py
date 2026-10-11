import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Config:
    """Base application configuration."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "agriconnect-college-project-secret-key-2026")
    DATABASE_PATH = os.environ.get("DATABASE_PATH", str(BASE_DIR / "instance" / "agriconnect.db"))
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False  # Set to True only when running over HTTPS
    PERMANENT_SESSION_LIFETIME = 86400 * 30  # 30 days
    APP_NAME = "AGRICONNECT"


class DevelopmentConfig(Config):
    """Development configuration with debug enabled."""
    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    """Test configuration using isolated in-memory or temp SQLite database."""
    DEBUG = False
    TESTING = True
    SECRET_KEY = "test-secret-key"
    DATABASE_PATH = ":memory:"


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
