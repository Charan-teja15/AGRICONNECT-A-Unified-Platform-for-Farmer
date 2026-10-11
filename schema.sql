-- ============================================================================
-- AGRICONNECT: Database Schema for SQLite
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'buyer')),
    state TEXT,
    district TEXT,
    -- Farmer specific fields:
    land_size REAL,
    land_unit TEXT DEFAULT 'acres',
    preferred_crop TEXT,
    -- Buyer specific fields:
    buyer_type TEXT CHECK (buyer_type IS NULL OR buyer_type IN ('Trader', 'Retailer', 'Restaurant/Hotel', 'FPO/Cooperative', 'Other')),
    organisation_name TEXT,
    crops_of_interest TEXT,
    preferred_language TEXT DEFAULT 'en',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- 2. Crop Listings Table
CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crop_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'quintal',
    expected_price REAL,
    state TEXT,
    district TEXT,
    availability_date TEXT,
    description TEXT,
    contact_info TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. Crop Advisory Rules Table (Configurable agricultural guidance)
CREATE TABLE IF NOT EXISTS advisory_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    keywords TEXT NOT NULL,
    crop_name TEXT,
    growth_stage TEXT,
    soil_type TEXT,
    irrigation_condition TEXT,
    recommendation TEXT NOT NULL,
    explanation TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    caution_message TEXT,
    severity TEXT,
    source_reference TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 4. Government Schemes Table (Structured official welfare programmes)
CREATE TABLE IF NOT EXISTS schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'Central',
    category TEXT NOT NULL DEFAULT 'General',
    states TEXT DEFAULT '',
    min_land REAL DEFAULT 0,
    max_land REAL DEFAULT 99999,
    crops TEXT DEFAULT '',
    requires_field_verification INTEGER NOT NULL DEFAULT 1,
    documents TEXT NOT NULL DEFAULT '[]',
    conditions TEXT NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL DEFAULT '',
    official_url TEXT DEFAULT '',
    source_name TEXT DEFAULT 'Government of India',
    last_verified_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 5. Advisory Queries History Table
CREATE TABLE IF NOT EXISTS advisory_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    crop_name TEXT,
    growth_stage TEXT,
    soil_type TEXT,
    symptoms TEXT,
    irrigation TEXT,
    weather TEXT,
    created_at TEXT NOT NULL,
    no_match INTEGER NOT NULL DEFAULT 0,
    result_title TEXT,
    recommendation TEXT,
    summary TEXT,
    rule_name TEXT,
    explanation TEXT,
    matched_conditions TEXT,
    next_steps TEXT,
    caution TEXT,
    severity TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 6. Scheme Match History Table
CREATE TABLE IF NOT EXISTS scheme_match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    submitted_profile TEXT NOT NULL,
    match_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 7. Orders / Buyer Requests Table
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

-- 8. Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(buyer_id, listing_id),
    FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_crop ON listings(crop_name);
CREATE INDEX IF NOT EXISTS idx_listings_state_dist ON listings(state, district);
CREATE INDEX IF NOT EXISTS idx_advisory_queries_user ON advisory_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_scheme_history_user ON scheme_match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_buyer ON wishlist(buyer_id);
