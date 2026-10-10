"""
=============================================================================
 AGRICONNECT — DEVELOPMENT PREVIEW SERVER  (preview_app.py)
=============================================================================
 IMPORTANT
 ---------
 This file is NOT part of the deliverable frontend and it is NOT the
 production backend. It exists so the templates in /templates can be
 previewed in a browser (college expo demo, design review, screenshots)
 without the real Flask application being finished.

 It implements every endpoint the templates reference, with the same
 endpoint names, field names and context variables documented in
 BACKEND_INTEGRATION.md. When you integrate the templates into your real
 project you can delete this file — or crib the query / rule-engine logic
 from it into your own blueprints.

 Run it:
     pip install flask
     python preview_app.py            # http://localhost:5000
     python preview_app.py --reset    # rebuild the demo SQLite database
=============================================================================
"""

import json
import os
import secrets
import sqlite3
import sys
from datetime import date, datetime

from flask import (Flask, abort, flash, g, redirect, render_template, request,
                   session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "agrconnect_preview.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

# Demo credentials shown on the login page (demo_mode only).
DEMO_EMAIL = "demo@agriconnect.in"
DEMO_PASSWORD = "demo1234"

# --------------------------------------------------------------------------
# Reference data (a real app would keep this in lookup tables)
# --------------------------------------------------------------------------
STATES = ["Andhra Pradesh", "Bihar", "Gujarat", "Karnataka", "Madhya Pradesh",
          "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
          "Telangana", "Uttar Pradesh", "West Bengal"]

DISTRICTS = ["Warangal", "Hanamkonda", "Nalgonda", "Khammam", "Karimnagar",
             "Nizamabad", "Adilabad", "Mahbubnagar", "Ranga Reddy", "Medak"]

CROPS = ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Groundnut",
         "Soybean", "Chilli", "Tomato", "Onion", "Potato", "Turmeric",
         "Banana", "Mango", "Bajra", "Jowar", "Gram", "Mustard"]

UNITS = ["quintal", "kg", "tonne", "bag", "crate", "dozen"]

GROWTH_STAGES = ["Seedling", "Vegetative", "Flowering", "Fruiting / Pod filling",
                 "Maturity / Harvest"]

SOIL_TYPES = ["Sandy", "Loamy", "Clay", "Black (regur)", "Red", "Laterite", "Alluvial"]

IRRIGATION_OPTIONS = ["Adequate irrigation", "Limited irrigation",
                      "Rainfed only", "No irrigation available"]

WEATHER_OPTIONS = ["Normal", "Hot and dry", "Humid", "Heavy rainfall",
                   "Cool / cold", "Not sure"]

LANDHOLDING_CATEGORIES = ["Marginal (below 1 hectare)", "Small (1–2 hectares)",
                          "Semi-medium (2–4 hectares)", "Medium (4–10 hectares)",
                          "Large (above 10 hectares)"]

SORT_OPTIONS = [
    {"value": "newest", "label": "Newest first"},
    {"value": "price_asc", "label": "Price: low to high"},
    {"value": "price_desc", "label": "Price: high to low"},
]

# --------------------------------------------------------------------------
# Rule-based advisory engine (transparent, explainable, no machine learning)
# --------------------------------------------------------------------------
ADVISORY_RULES = [
    {
        "name": "RULE-NITRO-01",
        "title": "Possible nitrogen deficiency in the standing crop",
        "keywords": ["yellow", "yellowing", "pale", "chlorosis", "light green"],
        "crop": None,
        "stage": ["Vegetative", "Flowering"],
        "soil": ["Sandy", "Red"],
        "irrigation": ["Limited irrigation", "Rainfed only"],
        "recommendation": [
            "Yellowing that begins on the older, lower leaves and moves upward is often associated with low nitrogen availability.",
            "Consider a split application of a nitrogen source (for example urea) after a soil or leaf-colour chart check, and avoid applying it just before heavy rain.",
            "Keep a small untreated strip in the field so you can compare recovery over the next 7–10 days.",
        ],
        "next_steps": [
            "Confirm with a soil test or a leaf colour chart before applying fertiliser.",
            "Apply nitrogen in two splits rather than a single heavy dose.",
            "Irrigate lightly after application so the nutrient reaches the root zone.",
            "Re-check the crop after 7–10 days and record any change.",
        ],
        "severity": "Monitor closely",
    },
    {
        "name": "RULE-WATERLOG-01",
        "title": "Drainage and root-health check after excess water",
        "keywords": ["waterlogging", "water logged", "heavy rain", "flood", "standing water", "wilting"],
        "crop": None,
        "stage": None,
        "soil": ["Clay", "Black (regur)", "Alluvial"],
        "irrigation": None,
        "recommendation": [
            "Standing water for more than 24–48 hours restricts oxygen around the roots and often leads to yellowing and wilting.",
            "Open drainage channels at the field edges and, where possible, create shallow surface drains across the slope.",
            "Avoid walking in or working the field until the surface has firmed up.",
        ],
        "next_steps": [
            "Clear outlet channels so water can leave the field.",
            "After drainage, loosen the surface gently to help the roots breathe.",
            "Watch for root rot or fungal patches over the next week.",
            "Delay top-dressing fertiliser until the field has drained.",
        ],
        "severity": "Act within 48 hours",
    },
    {
        "name": "RULE-PEST-01",
        "title": "Inspect for pest damage before spraying",
        "keywords": ["spots", "holes", "insect", "pest", "caterpillar", "aphid", "borer", "chewed", "larva"],
        "crop": None,
        "stage": None,
        "soil": None,
        "irrigation": None,
        "recommendation": [
            "Chewed leaves, holes and visible insects usually indicate pest activity rather than a nutrient problem.",
            "Identify the pest first — pheromone traps and yellow sticky traps help you decide whether spraying is really needed.",
            "If intervention is required, prefer need-based, recommended doses and avoid spraying during flowering when pollinators are active.",
        ],
        "next_steps": [
            "Walk the field in a 'W' pattern and note how many plants in 10 are affected.",
            "Install sticky or pheromone traps to confirm the pest and its numbers.",
            "Consult the label of any pesticide and follow the recommended dose and waiting period.",
            "Contact your local agriculture officer before applying restricted chemicals.",
        ],
        "severity": "Act soon",
    },
    {
        "name": "RULE-IRRIG-01",
        "title": "Irrigation scheduling for limited water availability",
        "keywords": ["dry", "drought", "moisture stress", "cracks", "no rain", "scarcity"],
        "crop": None,
        "stage": ["Flowering", "Fruiting / Pod filling"],
        "soil": ["Sandy", "Loamy", "Red"],
        "irrigation": ["Limited irrigation", "Rainfed only", "No irrigation available"],
        "recommendation": [
            "Flowering and pod/fruit filling are the stages most sensitive to moisture stress — protecting water at this stage protects yield.",
            "Prioritise irrigation at these critical stages and consider mulching to reduce evaporation.",
            "Where water is very limited, irrigate alternate rows rather than the whole field.",
        ],
        "next_steps": [
            "Mulch between rows with crop residue or straw where available.",
            "Irrigate during the cooler part of the day to reduce evaporation losses.",
            "Remove weeds that compete for the same moisture.",
            "Record rainfall and irrigation dates to plan the next cycle.",
        ],
        "severity": "Plan irrigation",
    },
    {
        "name": "RULE-HEALTHY-01",
        "title": "No problem indicators reported — continue routine crop care",
        "keywords": ["nothing", "no issue", "healthy", "normal", "fine", "good", "none"],
        "crop": None, "stage": None, "soil": None, "irrigation": None,
        "recommendation": [
            "No problem indicators were reported. Continue routine monitoring and keep a simple daily record of the crop.",
            "Scout the field at least once a week so any change is noticed early, when it is cheapest to manage.",
        ],
        "next_steps": [
            "Scout the field weekly and note stage, colour and any unusual patches.",
            "Keep the field free of weeds around the crop rows.",
            "Plan the next irrigation and nutrient schedule in advance.",
            "Take photographs so you can compare the crop week by week.",
        ],
        "severity": "No action needed",
    },
    {
        "name": "RULE-FUNGAL-01",
        "title": "Possible fungal or disease symptom — confirm before spraying",
        "keywords": ["powder", "rust", "blight", "rot", "mould", "fungus", "brown patch", "black spot"],
        "crop": None, "stage": None, "soil": None,
        "irrigation": None,
        "recommendation": [
            "Powdery growth, rust-coloured pustules, rotting or spreading patches are usually disease symptoms rather than nutrient problems.",
            "Remove and destroy badly affected plant parts, improve air movement, and avoid overhead irrigation late in the day.",
            "Confirm the disease before choosing a fungicide — the right product depends on the organism involved.",
        ],
        "next_steps": [
            "Collect a sample of an affected leaf for the agriculture officer or KVK.",
            "Avoid working in the field while the foliage is wet.",
            "Do not over-apply nitrogen, which can encourage soft, susceptible growth.",
            "Follow the recommended waiting period before harvest if you do spray.",
        ],
        "severity": "Confirm before spraying",
    },
]

DEFAULT_CAUTION = (
    "This guidance is informational and comes from simplified rules, not from a "
    "laboratory test or a trained AI model. Field conditions vary widely — confirm "
    "with your local agriculture officer, Krishi Vigyan Kendra, or a qualified "
    "agronomist before applying fertilisers or pesticides. AGRICONNECT does not "
    "guarantee any particular agricultural outcome."
)

NO_MATCH_TEXT = (
    "No rule in the configured advisory rule set matched this combination of crop, "
    "stage, soil and symptoms."
)

# --------------------------------------------------------------------------
# Scheme data seeded into SQLite (a real app would let an admin maintain this)
# --------------------------------------------------------------------------
SEED_SCHEMES = [
    {
        "name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "description": "Central income-support scheme for landholding farmer families, "
                       "subject to the exclusion criteria published by the Government of India.",
        "level": "Central", "category": "Income support",
        "states": "", "min_land": 0, "max_land": 99999,
        "crops": "", "requires_field_verification": 1,
        "documents": ["Aadhaar card", "Land ownership records (RoR / Khatauni)",
                      "Bank account details with IFSC", "Mobile number"],
        "conditions": ["Family definition and exclusion criteria must be checked on the official portal",
                       "Land records must be verified by the local revenue authority",
                       "Bank account must be Aadhaar-seeded for DBT transfer"],
        "instructions": "Apply through the PM-KISAN portal, the nearest Common Service Centre, "
                        "or the local agriculture/revenue office. Keep the registration number "
                        "for e-KYC and beneficiary status checks.",
        "official_url": "https://pmkisan.gov.in/",
    },
    {
        "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "description": "Crop insurance cover against notified natural risks for notified crops "
                       "in notified areas, for both loanee and non-loanee farmers.",
        "level": "Central", "category": "Crop insurance",
        "states": "", "min_land": 0, "max_land": 99999,
        "crops": "Paddy,Wheat,Cotton,Sugarcane,Groundnut,Soybean,Maize,Onion,Tomato,Chilli",
        "requires_field_verification": 1,
        "documents": ["Land records / tenancy certificate", "Sowing certificate",
                      "Aadhaar card", "Bank passbook", "Crop details (survey number, area sown)"],
        "conditions": ["The crop and the area must be notified for the season",
                       "Enrolment must happen before the cut-off date announced for the season",
                       "Loss must be intimated within the prescribed time limit"],
        "instructions": "Enrol through the PMFBY portal, your bank, a Common Service Centre, "
                        "or an insurance intermediary before the seasonal cut-off date.",
        "official_url": "https://pmfby.gov.in/",
    },
    {
        "name": "Soil Health Card Scheme",
        "description": "Free soil testing and a soil health card with nutrient status and "
                       "crop-wise fertiliser recommendations for your field.",
        "level": "Central", "category": "Soil health",
        "states": "", "min_land": 0, "max_land": 99999,
        "crops": "", "requires_field_verification": 0,
        "documents": ["Land records or farmer identity proof", "Field survey number"],
        "conditions": ["Soil samples must be collected following the prescribed procedure",
                       "Card validity and re-testing interval follow state guidelines"],
        "instructions": "Contact your nearest soil testing laboratory, Krishi Vigyan Kendra, "
                        "or agriculture department office to have a sample collected and tested.",
        "official_url": "https://soilhealth.dac.gov.in/",
    },
    {
        "name": "Kisan Credit Card (KCC)",
        "description": "Short-term crop loan facility with a revolving credit limit for "
                       "cultivation expenses, extended at concessional interest.",
        "level": "Central", "category": "Credit",
        "states": "", "min_land": 0, "max_land": 99999,
        "crops": "", "requires_field_verification": 1,
        "documents": ["Identity and address proof", "Land documents",
                      "Crop pattern / cropping details", "Passport-size photographs",
                      "Bank account details"],
        "conditions": ["Credit assessment and documentation are done by the lending bank",
                       "Interest subvention depends on timely repayment as per scheme rules"],
        "instructions": "Apply at your nearest bank branch, regional rural bank, or cooperative "
                        "society with land and identity documents.",
        "official_url": "https://www.myscheme.gov.in/",
    },
    {
        "name": "Rythu Bandhu / State Investment Support (illustrative state scheme)",
        "description": "Illustrative state-level investment support scheme for landholding "
                       "farmers. Configuration, amount and eligibility differ by state — this "
                       "record is a demonstration entry for the project database.",
        "level": "State", "category": "Investment support",
        "states": "Telangana", "min_land": 0, "max_land": 99999,
        "crops": "", "requires_field_verification": 1,
        "documents": ["Passbook with land details", "Aadhaar card",
                      "Bank account details"],
        "conditions": ["Scheme is available only in the configured state",
                       "Land should not fall under the ineligible categories notified by the state",
                       "Benefit amount and schedule are decided by the state government"],
        "instructions": "Apply through the state agriculture department portal or the nearest "
                        "revenue/agriculture office during the notified window.",
        "official_url": "",
    },
    {
        "name": "Micro Irrigation / Drip & Sprinkler Support (illustrative)",
        "description": "Illustrative support for micro-irrigation systems that improve water-use "
                       "efficiency. This record demonstrates a scheme with a land-size condition.",
        "level": "Central", "category": "Irrigation",
        "states": "", "min_land": 0.5, "max_land": 99999,
        "crops": "Sugarcane,Banana,Mango,Tomato,Chilli,Cotton,Onion",
        "requires_field_verification": 1,
        "documents": ["Land records", "Aadhaar card", "Bank passbook",
                      "Quotation from an empanelled supplier", "Field layout / crop plan"],
        "conditions": ["Minimum land holding applies as configured in the database",
                       "Installation must be carried out by an empanelled supplier",
                       "Subsidy is released after field verification by the department"],
        "instructions": "Apply through the state horticulture/agriculture department or the "
                        "national micro-irrigation portal, then complete installation through an "
                        "empanelled vendor.",
        "official_url": "https://www.myscheme.gov.in/",
    },
]

# --------------------------------------------------------------------------
# Database helpers
# --------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    state TEXT,
    district TEXT,
    land_size REAL,
    preferred_crop TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
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
    FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS advisory_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    crop_name TEXT, growth_stage TEXT, soil_type TEXT, symptoms TEXT,
    irrigation TEXT, weather TEXT, created_at TEXT,
    no_match INTEGER DEFAULT 0,
    result_title TEXT, recommendation TEXT, summary TEXT,
    rule_name TEXT, explanation TEXT, matched_conditions TEXT,
    next_steps TEXT, caution TEXT, severity TEXT
);
CREATE TABLE IF NOT EXISTS schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT, level TEXT, category TEXT,
    states TEXT, min_land REAL DEFAULT 0, max_land REAL DEFAULT 99999,
    crops TEXT, requires_field_verification INTEGER DEFAULT 1,
    documents TEXT, conditions TEXT, instructions TEXT, official_url TEXT
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


def query(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rows = cur.fetchall()
    cur.close()
    return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid


def init_db(reset=False):
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    db.commit()

    existing = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing == 0:
        seed(db)
    db.close()


def seed(db):
    now = datetime.now().strftime("%d %b %Y")
    demo_hash = generate_password_hash(DEMO_PASSWORD)

    users = [
        ("Ramesh Kumar", DEMO_EMAIL, "9848012345", "Telangana", "Warangal",
         2.5, "Paddy", demo_hash),
        ("Lakshmi Devi", "lakshmi@example.in", "9848098765", "Telangana", "Nalgonda",
         4.0, "Cotton", generate_password_hash("demo1234")),
        ("Suresh Naik", "suresh@example.in", "9848076543", "Karnataka", "Karimnagar",
         1.2, "Tomato", generate_password_hash("demo1234")),
    ]
    for u in users:
        db.execute(
            "INSERT INTO users (name,email,phone,state,district,land_size,"
            "preferred_crop,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (*u, now))
    db.commit()

    listings = [
        (1, "Paddy (Sona Masuri)", 40, "quintal", 2180, "Telangana", "Warangal",
         date.today().replace(day=1).isoformat(),
         "Fine-grade Sona Masuri paddy, moisture below 14 percent, machine cleaned and packed in new gunny bags.",
         "9848012345", "available"),
        (1, "Paddy (BPT 5204)", 25, "quintal", 2050, "Telangana", "Warangal",
         date.today().isoformat(),
         "Freshly harvested BPT paddy from rabi season, stored in a covered godown.",
         "9848012345", "available"),
        (2, "Cotton (Shankar-6)", 60, "quintal", 7200, "Telangana", "Nalgonda",
         date.today().isoformat(),
         "Good staple length cotton, hand-picked and sun dried. Ready for loading within a week.",
         "lakshmi@example.in", "available"),
        (2, "Groundnut", 18, "quintal", 5800, "Telangana", "Nalgonda",
         date.today().isoformat(),
         "Bold variety groundnut, cleaned and graded. Suitable for oil extraction.",
         "lakshmi@example.in", "available"),
        (3, "Tomato (Hybrid)", 30, "quintal", 1600, "Karnataka", "Karimnagar",
         date.today().isoformat(),
         "Firm hybrid tomatoes, graded by size, packed in plastic crates of 20 kg.",
         "9848076543", "available"),
        (3, "Onion (Bellary)", 50, "quintal", 1450, "Karnataka", "Karimnagar",
         date.today().isoformat(),
         "Well-cured onions with good skin retention, stored on a raised platform.",
         "9848076543", "reserved"),
        (1, "Maize", 35, "quintal", 1950, "Telangana", "Hanamkonda",
         date.today().isoformat(),
         "Yellow maize, moisture checked, suitable for poultry feed.",
         "9848012345", "available"),
        (2, "Chilli (Teja)", 12, "quintal", 13500, "Telangana", "Khammam",
         date.today().isoformat(),
         "Teja variety red chilli, sun dried and sorted. High colour value.",
         "lakshmi@example.in", "available"),
        (3, "Turmeric (Finger)", 20, "quintal", 8600, "Karnataka", "Medak",
         date.today().isoformat(),
         "Polished finger turmeric, cured and cleaned, ready for mandi delivery.",
         "9848076543", "available"),
    ]
    for item in listings:
        db.execute(
            "INSERT INTO listings (user_id,crop_name,quantity,unit,expected_price,"
            "state,district,availability_date,description,contact_info,status,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (*item, now))
    db.commit()

    for scheme in SEED_SCHEMES:
        db.execute(
            "INSERT INTO schemes (name,description,level,category,states,min_land,"
            "max_land,crops,requires_field_verification,documents,conditions,"
            "instructions,official_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (scheme["name"], scheme["description"], scheme["level"], scheme["category"],
             scheme["states"], scheme["min_land"], scheme["max_land"], scheme["crops"],
             scheme["requires_field_verification"], json.dumps(scheme["documents"]),
             json.dumps(scheme["conditions"]), scheme["instructions"], scheme["official_url"]))
    db.commit()


# --------------------------------------------------------------------------
# Flask application
# --------------------------------------------------------------------------
app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATE_DIR)
app.secret_key = os.environ.get("AGRICONNECT_SECRET", "agriconnect-preview-key-change-me")
app.config["DATABASE"] = DB_PATH


class CurrentUser:
    """Tiny stand-in for flask_login's current_user."""

    def __init__(self, row=None):
        self.is_authenticated = row is not None
        for field in ("id", "name", "email", "phone", "state", "district",
                      "land_size", "preferred_crop", "created_at", "password_hash"):
            setattr(self, field, row[field] if row is not None else None)

    def __bool__(self):
        return bool(self.is_authenticated)


def load_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return query("SELECT * FROM users WHERE id = ?", (uid,), one=True)


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# --------------------------------------------------------------- CSRF support
def generate_csrf():
    token = session.get("_csrf_token")
    if not token:
        token = secrets.token_hex(24)
        session["_csrf_token"] = token
    return token


app.jinja_env.globals["csrf_token"] = generate_csrf


@app.before_request
def csrf_protect():
    if request.method == "POST":
        expected = session.get("_csrf_token")
        supplied = request.form.get("csrf_token", "")
        if not expected or not supplied or not secrets.compare_digest(expected, supplied):
            flash("Your form session expired. Please submit the form again.", "danger")
            return redirect(request.referrer or url_for("index"))
    return None


# ----------------------------------------------------------- Context processor
@app.context_processor
def inject_globals():
    row = load_user()
    return {
        "current_user": CurrentUser(row),
        "app_name": "AGRICONNECT",
        "current_year": date.today().year,
        "today": datetime.now().strftime("%A, %d %B %Y"),
        "states": STATES,
        "districts": DISTRICTS,
        "crops": CROPS,
        "units": UNITS,
        "growth_stages": GROWTH_STAGES,
        "soil_types": SOIL_TYPES,
        "irrigation_options": IRRIGATION_OPTIONS,
        "weather_options": WEATHER_OPTIONS,
        "categories": LANDHOLDING_CATEGORIES,
        "sort_options": SORT_OPTIONS,
        "history_enabled": True,
        "demo_mode": True,
        "demo_credentials": {"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    }


def login_required(view):
    from functools import wraps

    @wraps(view)
    def wrapper(*args, **kwargs):
        if not load_user():
            flash("Please log in to continue.", "info")
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapper


# ------------------------------------------------------------------ Pagination
class Pagination:
    def __init__(self, items, page, per_page, total):
        self.items = items
        self.page = page
        self.per_page = per_page
        self.total = total
        self.pages = max(1, (total + per_page - 1) // per_page)
        self.has_prev = page > 1
        self.has_next = page < self.pages
        self.prev_num = page - 1
        self.next_num = page + 1


# ==========================================================================
# ROUTES
# ==========================================================================
@app.route("/")
def index():
    db = get_db()
    public_stats = {
        "listings": db.execute("SELECT COUNT(*) FROM listings WHERE status='available'").fetchone()[0],
        "crops": db.execute("SELECT COUNT(DISTINCT crop_name) FROM listings").fetchone()[0],
        "schemes": db.execute("SELECT COUNT(*) FROM schemes").fetchone()[0],
        "farmers": db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
    }
    featured = [dict(r) for r in db.execute(
        "SELECT l.*, u.name AS farmer_name FROM listings l "
        "JOIN users u ON u.id = l.user_id WHERE l.status='available' "
        "ORDER BY l.id DESC LIMIT 3").fetchall()]
    return render_template("index.html", public_stats=public_stats,
                           featured_listings=featured)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip()
        password = request.form.get("password") or ""
        row = query("SELECT * FROM users WHERE email = ? OR name = ?", (email, email), one=True)

        if not row or not check_password_hash(row["password_hash"], password):
            return render_template("login.html",
                                   errors={"general": "The email/username or password is not correct."},
                                   form_data={"email": email, "remember": request.form.get("remember")}), 401

        session.clear()
        session["user_id"] = row["id"]
        if request.form.get("remember"):
            session.permanent = True
        flash("Welcome back, {}!".format(row["name"].split()[0]), "success")
        return redirect(request.form.get("next") or url_for("dashboard"))

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = {k: (request.form.get(k) or "").strip() for k in
                ("full_name", "email", "phone", "state", "district",
                 "land_size", "preferred_crop")}
        password = request.form.get("password") or ""
        confirm = request.form.get("confirm_password") or ""
        errors = {}

        if not data["full_name"]:
            errors["full_name"] = "Please enter your full name."
        if not data["email"] or "@" not in data["email"]:
            errors["email"] = "Please enter a valid email address."
        elif query("SELECT 1 FROM users WHERE email = ?", (data["email"],), one=True):
            errors["email"] = "This email is already registered. Try logging in."
        if not data["state"]:
            errors["state"] = "Please select your state."
        if not data["district"]:
            errors["district"] = "Please enter your district."
        if len(password) < 8:
            errors["password"] = "Password must be at least 8 characters long."
        if password != confirm:
            errors["confirm_password"] = "The two passwords do not match."
        if data["land_size"]:
            try:
                float(data["land_size"])
            except ValueError:
                errors["land_size"] = "Land size must be a number."

        if errors:
            # NOTE: passwords are intentionally NOT returned to the template.
            return render_template("register.html", errors=errors, form_data=data), 400

        execute(
            "INSERT INTO users (name,email,phone,state,district,land_size,"
            "preferred_crop,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (data["full_name"], data["email"], data["phone"] or None, data["state"],
             data["district"], float(data["land_size"]) if data["land_size"] else None,
             data["preferred_crop"] or None, generate_password_hash(password),
             datetime.now().strftime("%d %b %Y")))

        row = query("SELECT * FROM users WHERE email = ?", (data["email"],), one=True)
        session.clear()
        session["user_id"] = row["id"]
        flash("Your farmer profile has been created. Welcome to AGRICONNECT!", "success")
        return redirect(url_for("dashboard"))

    return render_template("register.html")


@app.route("/logout", methods=["POST", "GET"])
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("index"))


@app.route("/dashboard")
@login_required
def dashboard():
    row = load_user()
    user = dict(row)
    uid = user["id"]

    stats = {
        "active_listings": query(
            "SELECT COUNT(*) FROM listings WHERE user_id=? AND status='available'", (uid,), one=True)[0],
        "available_crops": query(
            "SELECT COUNT(DISTINCT crop_name) FROM listings WHERE status='available'", one=True)[0],
        "advisory_queries": query(
            "SELECT COUNT(*) FROM advisory_queries WHERE user_id=?", (uid,), one=True)[0],
        "scheme_matches": len(match_schemes(user.get("state"), user.get("district"),
                                            user.get("land_size"), user.get("preferred_crop"))),
    }

    recent_listings = [dict(r) for r in query(
        "SELECT l.*, u.name AS farmer_name FROM listings l JOIN users u ON u.id=l.user_id "
        "WHERE l.user_id=? ORDER BY l.id DESC LIMIT 5", (uid,))]

    recent_advisories = [dict(r) for r in query(
        "SELECT * FROM advisory_queries WHERE user_id=? ORDER BY id DESC LIMIT 5", (uid,))]

    filled = sum(1 for f in ("name", "email", "phone", "state", "district",
                             "land_size", "preferred_crop") if user.get(f))
    profile_completion = int(round(filled / 7 * 100))

    return render_template("dashboard.html", user=user, stats=stats,
                           recent_listings=recent_listings,
                           recent_advisories=recent_advisories,
                           profile_completion=profile_completion)


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    row = load_user()
    user = dict(row)
    edit_mode = request.args.get("edit") == "1"

    if request.method == "POST":
        data = {k: (request.form.get(k) or "").strip() for k in
                ("full_name", "email", "phone", "state", "district",
                 "land_size", "preferred_crop")}
        errors = {}
        if not data["full_name"]:
            errors["full_name"] = "Please enter your full name."
        if not data["email"] or "@" not in data["email"]:
            errors["email"] = "Please enter a valid email address."
        elif query("SELECT 1 FROM users WHERE email=? AND id<>?", (data["email"], user["id"]), one=True):
            errors["email"] = "That email is already used by another account."
        if not data["state"]:
            errors["state"] = "Please select your state."
        if not data["district"]:
            errors["district"] = "Please enter your district."
        if data["land_size"]:
            try:
                float(data["land_size"])
            except ValueError:
                errors["land_size"] = "Land size must be a number."

        if errors:
            return render_template("profile.html", user=user, errors=errors,
                                   form_data=data, edit_mode=True), 400

        execute("UPDATE users SET name=?, email=?, phone=?, state=?, district=?, "
                "land_size=?, preferred_crop=? WHERE id=?",
                (data["full_name"], data["email"], data["phone"] or None, data["state"],
                 data["district"], float(data["land_size"]) if data["land_size"] else None,
                 data["preferred_crop"] or None, user["id"]))
        flash("Your profile has been updated.", "success")
        return redirect(url_for("profile"))

    filled = sum(1 for f in ("name", "email", "phone", "state", "district",
                             "land_size", "preferred_crop") if user.get(f))
    return render_template("profile.html", user=user, edit_mode=edit_mode,
                           member_since=user.get("created_at"),
                           profile_completion=int(round(filled / 7 * 100)))


@app.route("/marketplace")
def marketplace():
    f = {
        "q": (request.args.get("q") or "").strip(),
        "state": (request.args.get("state") or "").strip(),
        "district": (request.args.get("district") or "").strip(),
        "min_price": (request.args.get("min_price") or "").strip(),
        "max_price": (request.args.get("max_price") or "").strip(),
        "sort": request.args.get("sort") or "newest",
        "mine": request.args.get("mine") or "",
    }
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    per_page = 9

    where, args = [], []
    if f["q"]:
        where.append("(l.crop_name LIKE ? OR l.description LIKE ?)")
        args += ["%%%s%%" % f["q"], "%%%s%%" % f["q"]]
    if f["state"]:
        where.append("l.state = ?"); args.append(f["state"])
    if f["district"]:
        where.append("l.district = ?"); args.append(f["district"])
    if f["min_price"]:
        where.append("l.expected_price >= ?"); args.append(float(f["min_price"]))
    if f["max_price"]:
        where.append("l.expected_price <= ?"); args.append(float(f["max_price"]))
    if f["mine"] and load_user():
        where.append("l.user_id = ?"); args.append(load_user()["id"])

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    order = {"price_asc": "l.expected_price ASC", "price_desc": "l.expected_price DESC"}.get(
        f["sort"], "l.id DESC")

    total = query("SELECT COUNT(*) FROM listings l" + clause, args, one=True)[0]
    rows = query(
        "SELECT l.*, u.name AS farmer_name FROM listings l JOIN users u ON u.id = l.user_id"
        + clause + " ORDER BY " + order + " LIMIT ? OFFSET ?",
        args + [per_page, (page - 1) * per_page])

    uid = load_user()["id"] if load_user() else None
    listings = []
    for r in rows:
        item = dict(r)
        item["is_owner"] = (uid is not None and item["user_id"] == uid)
        listings.append(item)

    return render_template("marketplace.html", listings=listings, filters=f,
                           result_count=total,
                           pagination=Pagination(listings, page, per_page, total))


@app.route("/listings/new", methods=["GET", "POST"])
@login_required
def create_listing():
    user = dict(load_user())
    if request.method == "POST":
        data, errors = validate_listing_form(request.form)
        if errors:
            return render_template("create_listing.html", errors=errors,
                                   form_data=data, user=user), 400
        execute("INSERT INTO listings (user_id,crop_name,quantity,unit,expected_price,"
                "state,district,availability_date,description,contact_info,status,created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (user["id"], data["crop_name"], float(data["quantity"]), data["unit"],
                 float(data["expected_price"]) if data["expected_price"] else None,
                 data["state"], data["district"], data["availability_date"] or None,
                 data["description"] or None, data["contact_info"] or None, "available",
                 datetime.now().strftime("%d %b %Y")))
        flash("Your crop listing has been published.", "success")
        return redirect(url_for("marketplace", mine=1))

    return render_template("create_listing.html", user=user,
                           form_data={"contact_info": user.get("phone") or user.get("email")})


@app.route("/listings/<int:listing_id>/edit", methods=["GET", "POST"])
@login_required
def edit_listing(listing_id):
    user = dict(load_user())
    listing = query("SELECT * FROM listings WHERE id=?", (listing_id,), one=True)
    if not listing:
        abort(404)
    if listing["user_id"] != user["id"]:
        flash("You can only edit your own listings.", "danger")
        return redirect(url_for("marketplace"))

    if request.method == "POST":
        data, errors = validate_listing_form(request.form)
        if errors:
            return render_template("edit_listing.html", listing=dict(listing),
                                   errors=errors, form_data=data), 400
        execute("UPDATE listings SET crop_name=?, quantity=?, unit=?, expected_price=?,"
                " state=?, district=?, availability_date=?, description=?,"
                " contact_info=?, status=? WHERE id=?",
                (data["crop_name"], float(data["quantity"]), data["unit"],
                 float(data["expected_price"]) if data["expected_price"] else None,
                 data["state"], data["district"], data["availability_date"] or None,
                 data["description"] or None, data["contact_info"] or None,
                 request.form.get("status") or "available", listing_id))
        flash("Your listing has been updated.", "success")
        return redirect(url_for("marketplace", mine=1))

    return render_template("edit_listing.html", listing=dict(listing))


@app.route("/listings/<int:listing_id>/delete", methods=["POST"])
@login_required
def delete_listing(listing_id):
    user = dict(load_user())
    listing = query("SELECT * FROM listings WHERE id=?", (listing_id,), one=True)
    if not listing:
        abort(404)
    if listing["user_id"] != user["id"]:
        flash("You can only delete your own listings.", "danger")
        return redirect(url_for("marketplace"))
    execute("DELETE FROM listings WHERE id=?", (listing_id,))
    flash("The listing has been deleted.", "success")
    return redirect(url_for("marketplace", mine=1))


def validate_listing_form(form):
    data = {k: (form.get(k) or "").strip() for k in
            ("crop_name", "quantity", "unit", "expected_price", "state",
             "district", "availability_date", "description", "contact_info")}
    errors = {}
    if not data["crop_name"]:
        errors["crop_name"] = "Please enter the crop name."
    if not data["quantity"]:
        errors["quantity"] = "Please enter the quantity available."
    else:
        try:
            if float(data["quantity"]) < 0:
                errors["quantity"] = "Quantity cannot be negative."
        except ValueError:
            errors["quantity"] = "Quantity must be a number."
    if data["expected_price"]:
        try:
            float(data["expected_price"])
        except ValueError:
            errors["expected_price"] = "Expected price must be a number."
    if not data["state"]:
        errors["state"] = "Please select the state."
    if not data["district"]:
        errors["district"] = "Please enter the district."
    return data, errors


# ---------------------------------------------------------------- Advisory
def run_advisory_engine(data):
    """Transparent rule matching — returns an advisory dict (never a guess)."""
    symptoms = (data.get("symptoms") or "").lower()
    best, best_score = None, 0

    for rule in ADVISORY_RULES:
        score, matched = 0, []
        if any(k in symptoms for k in rule["keywords"]):
            score += 2
            matched.append("Reported symptoms contain an indicator for this rule")
        if rule["crop"] and data.get("crop_name") in rule["crop"]:
            score += 1; matched.append("Crop: {}".format(data.get("crop_name")))
        if rule["stage"] and data.get("growth_stage") in rule["stage"]:
            score += 1; matched.append("Growth stage: {}".format(data.get("growth_stage")))
        if rule["soil"] and data.get("soil_type") in rule["soil"]:
            score += 1; matched.append("Soil type: {}".format(data.get("soil_type")))
        if rule["irrigation"] and data.get("irrigation") in rule["irrigation"]:
            score += 1; matched.append("Irrigation: {}".format(data.get("irrigation")))
        if score > best_score:
            best, best_score = (rule, matched, score), score

    if not best:
        return {
            "no_match": True,
            "title": "No matching advisory rule",
            "summary": NO_MATCH_TEXT,
            "caution": DEFAULT_CAUTION,
        }

    rule, matched, score = best
    return {
        "no_match": False,
        "title": rule["title"],
        "recommendation": rule["recommendation"],
        "rule_name": rule["name"],
        "explanation": "Rule {} matched your answers on {} of its conditions. {}"
                       .format(rule["name"], score,
                               "Higher scores mean more of the rule's conditions were met."),
        "matched_conditions": matched,
        "next_steps": rule["next_steps"],
        "caution": DEFAULT_CAUTION,
        "severity": rule.get("severity"),
    }


@app.route("/crop-advisory", methods=["GET", "POST"])
def crop_advisory():
    user = load_user()
    if request.method == "POST":
        data = {k: (request.form.get(k) or "").strip() for k in
                ("crop_name", "growth_stage", "soil_type", "symptoms", "irrigation", "weather")}
        errors = {}
        for field, label in (("crop_name", "crop name"), ("growth_stage", "growth stage"),
                             ("soil_type", "soil type"), ("symptoms", "symptoms"),
                             ("irrigation", "irrigation availability")):
            if not data[field]:
                errors[field] = "Please provide the {}.".format(label)
        if errors:
            return render_template("crop_advisory.html", errors=errors,
                                   form_data=data), 400

        advisory = run_advisory_engine(data)
        query_id = execute(
            "INSERT INTO advisory_queries (user_id,crop_name,growth_stage,soil_type,"
            "symptoms,irrigation,weather,created_at,no_match,result_title,recommendation,"
            "summary,rule_name,explanation,matched_conditions,next_steps,caution,severity)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (user["id"] if user else None, data["crop_name"], data["growth_stage"],
             data["soil_type"], data["symptoms"], data["irrigation"], data["weather"],
             datetime.now().strftime("%d %b %Y, %I:%M %p"),
             1 if advisory.get("no_match") else 0,
             advisory.get("title"), json.dumps(advisory.get("recommendation") or ""),
             advisory.get("summary"), advisory.get("rule_name"), advisory.get("explanation"),
             json.dumps(advisory.get("matched_conditions") or []),
             json.dumps(advisory.get("next_steps") or []),
             advisory.get("caution"), advisory.get("severity")))
        return redirect(url_for("advisory_result", query_id=query_id))

    return render_template("crop_advisory.html")


@app.route("/crop-advisory/<int:query_id>")
def advisory_result(query_id):
    row = query("SELECT * FROM advisory_queries WHERE id=?", (query_id,), one=True)
    if not row:
        return render_template("advisory_result.html", query=None, advisory=None), 404

    rec = row["recommendation"]
    try:
        rec = json.loads(rec) if rec else None
    except (ValueError, TypeError):
        pass

    advisory = {
        "no_match": bool(row["no_match"]),
        "title": row["result_title"],
        "recommendation": rec,
        "summary": row["summary"],
        "rule_name": row["rule_name"],
        "explanation": row["explanation"],
        "matched_conditions": json.loads(row["matched_conditions"] or "[]"),
        "next_steps": json.loads(row["next_steps"] or "[]"),
        "caution": row["caution"],
        "severity": row["severity"],
    }
    return render_template("advisory_result.html", query=dict(row), advisory=advisory)


# ----------------------------------------------------------------- Subsidies
def match_schemes(state=None, district=None, land_size=None, crop=None):
    """Very small, transparent matcher over the seeded scheme table."""
    try:
        land = float(land_size) if land_size not in (None, "") else None
    except (TypeError, ValueError):
        land = None

    results = []
    for row in query("SELECT * FROM schemes"):
        row = dict(row)
        why, verify, score, possible = [], [], 0, 3

        scheme_states = [s for s in (row["states"] or "").split(",") if s.strip()]
        if not scheme_states:
            why.append("Applicable across India (no state restriction configured)")
            score += 1
        elif state and state in scheme_states:
            why.append("Configured for your state ({})".format(state))
            score += 1
        else:
            verify.append("Scheme is configured for: {}".format(", ".join(scheme_states) or "other states"))

        if land is not None and row["min_land"] <= land <= row["max_land"]:
            why.append("Land size ({:g} acres) is within the configured range".format(land))
            score += 1
        elif land is None:
            verify.append("Add your land size to check the land-based condition")
        else:
            verify.append("Land condition applies (configured range: {:g}–{:g} acres)"
                          .format(row["min_land"], row["max_land"]))

        crops = [c.strip() for c in (row["crops"] or "").split(",") if c.strip()]
        if crop and crops:
            if crop in crops:
                why.append("Your crop ({}) is covered by this scheme".format(crop))
                score += 1
                possible += 1
            else:
                verify.append("Crop coverage is limited to: {}".format(", ".join(crops)))
        elif crops:
            verify.append("Crop coverage is limited to: {}".format(", ".join(crops)))
        else:
            why.append("No crop restriction configured")
            score += 1
            possible += 1

        if row["requires_field_verification"]:
            verify.append("Official field verification is required before approval")

        if not why:
            continue

        ratio = score / max(possible, 1)
        if row["requires_field_verification"] and ratio < 0.99:
            status = "verification_required" if ratio >= 0.6 else "check_conditions"
        else:
            status = "potential_match" if ratio >= 0.75 else "check_conditions"

        results.append({
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "level": row["level"],
            "category": row["category"],
            "geo_applicability": ", ".join(scheme_states) if scheme_states else "All India (as configured)",
            "eligibility_status": status,
            "eligibility_note": ("Your profile broadly matches the basic conditions stored for "
                                 "this scheme. Confirm the remaining conditions with the "
                                 "implementing department."
                                 if status == "potential_match" else
                                 "Some conditions could not be confirmed from your profile. "
                                 "Review the listed conditions before applying."),
            "match_score": int(round(min(ratio, 1) * 100)),
            "why_matched": why,
            "conditions_to_verify": verify,
            "documents_required": json.loads(row["documents"] or "[]"),
            "application_instructions": row["instructions"],
            "official_url": row["official_url"] or "",
        })

    results.sort(key=lambda s: (-s["match_score"], s["name"]))
    return results


@app.route("/subsidy-checker", methods=["GET", "POST"])
def subsidy_checker():
    user = load_user()
    if request.method == "POST":
        criteria = {k: (request.form.get(k) or "").strip() for k in
                    ("state", "district", "land_size", "landholding_category", "crop_type")}
        errors = {}
        if not criteria["state"]:
            errors["state"] = "Please select your state."
        if not criteria["land_size"]:
            errors["land_size"] = "Please enter your land size in acres."
        else:
            try:
                if float(criteria["land_size"]) < 0:
                    errors["land_size"] = "Land size cannot be negative."
            except ValueError:
                errors["land_size"] = "Land size must be a number."
        if errors:
            return render_template("subsidy_checker.html", errors=errors,
                                   form_data=criteria), 400

        schemes = match_schemes(criteria["state"], criteria["district"],
                                criteria["land_size"], criteria["crop_type"])
        session["last_subsidy_check"] = criteria
        return render_template("subsidy_results.html", schemes=schemes, criteria=criteria,
                               match_count=len(schemes),
                               schemes_checked=query("SELECT COUNT(*) FROM schemes", one=True)[0],
                               checked_at=datetime.now().strftime("%d %b %Y, %I:%M %p"))

    return render_template("subsidy_checker.html")


@app.route("/subsidy-results")
def subsidy_results():
    criteria = session.get("last_subsidy_check")
    if not criteria:
        return render_template("subsidy_results.html", schemes=[], criteria=None,
                               match_count=0, schemes_checked=0, checked_at=None)
    schemes = match_schemes(criteria.get("state"), criteria.get("district"),
                            criteria.get("land_size"), criteria.get("crop_type"))
    return render_template("subsidy_results.html", schemes=schemes, criteria=criteria,
                           match_count=len(schemes),
                           schemes_checked=query("SELECT COUNT(*) FROM schemes", one=True)[0],
                           checked_at=datetime.now().strftime("%d %b %Y, %I:%M %p"))


# ------------------------------------------------------------------- Errors
@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


@app.errorhandler(500)
def server_error(error):
    return render_template("500.html"), 500


# --------------------------------------------------------------------- Main
if __name__ == "__main__":
    init_db(reset="--reset" in sys.argv)
    print("\n  AGRICONNECT preview server")
    print("  --------------------------")
    print("  Demo login : {} / {}".format(DEMO_EMAIL, DEMO_PASSWORD))
    print("  Database   : {}\n".format(DB_PATH))
    # --no-reloader keeps a single process bound to the port; the supervisor
    # script (run_preview.sh) restarts the server if it ever stops.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)),
            debug=True, use_reloader=("--reloader" in sys.argv))

# Build the demo database on first import so `flask run` works too.
if not os.path.exists(DB_PATH):
    init_db()
