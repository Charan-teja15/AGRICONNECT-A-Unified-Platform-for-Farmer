import os
import sqlite3
from pathlib import Path
from flask import g, current_app

def get_db():
    """Retrieve or open a database connection for the current Flask request context."""
    if "db" not in g:
        db_path = current_app.config.get("DATABASE_PATH")
        
        # Ensure parent directory exists if using a file path
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            
        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
        )
        g.db.row_factory = sqlite3.Row
        # Enforce foreign key constraints in SQLite
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db


def close_db(e=None):
    """Close the current request's database connection if open."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False):
    """Execute a parameterized query and return matching rows as dictionaries."""
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]


def execute_db(query, args=(), commit=True):
    """Execute an INSERT, UPDATE, or DELETE query and return the last row ID."""
    db = get_db()
    cur = db.execute(query, args)
    if commit:
        db.commit()
    last_id = cur.lastrowid
    cur.close()
    return last_id


def migrate_db(conn=None):
    """
    Safe migration for the existing database using ALTER TABLE.
    Adds role, land_unit, buyer_type, organisation_name, and crops_of_interest
    without deleting or dropping existing users. Existing users default to 'farmer'.
    """
    should_close = False
    if conn is None:
        try:
            conn = get_db()
        except RuntimeError:
            db_path = current_app.config.get("DATABASE_PATH") if current_app else None
            if not db_path:
                return
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA foreign_keys = ON;")
            should_close = True

    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(users);")
        columns = {row[1] for row in cur.fetchall()}

        if columns and "role" not in columns:
            conn.execute(
                "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'buyer'));"
            )
            conn.execute("UPDATE users SET role = 'farmer' WHERE role IS NULL OR role = '';")

        if columns and "land_unit" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN land_unit TEXT DEFAULT 'acres';")

        if columns and "buyer_type" not in columns:
            conn.execute(
                "ALTER TABLE users ADD COLUMN buyer_type TEXT CHECK (buyer_type IS NULL OR buyer_type IN ('Trader', 'Retailer', 'Restaurant/Hotel', 'FPO/Cooperative', 'Other'));"
            )

        if columns and "organisation_name" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN organisation_name TEXT;")

        if columns and "crops_of_interest" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN crops_of_interest TEXT;")

        if columns and "preferred_language" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en';")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_id INTEGER NOT NULL,
            listing_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            offered_price REAL NOT NULL,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_id INTEGER NOT NULL,
            listing_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(buyer_id, listing_id),
            FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
        );
        """)

        conn.commit()
    finally:
        if should_close:
            conn.close()


def init_db(app=None):
    """Initialize the database tables from schema.sql and apply any migrations."""
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    if app is not None:
        with app.app_context():
            db = get_db()
            db.executescript(schema_sql)
            db.commit()
            migrate_db(db)
    else:
        db = get_db()
        db.executescript(schema_sql)
        db.commit()
        migrate_db(db)


def init_app(app):
    """Register database teardown callback with the Flask application."""
    app.teardown_appcontext(close_db)
