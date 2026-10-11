import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime, date
try:
    from werkzeug.security import generate_password_hash
except ImportError:
    import hashlib
    def generate_password_hash(password):
        salt = "salt1234"
        return "pbkdf2:sha256:260000$" + salt + "$" + hashlib.sha256((salt + password).encode()).hexdigest()
from config import Config

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Config.DATABASE_PATH

DEMO_EMAIL = "demo@agriconnect.in"
DEMO_PASSWORD = "demo1234"

SEED_USERS = [
    ("Ramesh Kumar", DEMO_EMAIL, "9848012345", "Telangana", "Warangal", 2.5, "Paddy", DEMO_PASSWORD),
    ("Lakshmi Devi", "lakshmi@example.in", "9848098765", "Telangana", "Nalgonda", 4.0, "Cotton", "demo1234"),
    ("Suresh Naik", "suresh@example.in", "9848076543", "Karnataka", "Karimnagar", 1.2, "Tomato", "demo1234"),
]

SEED_BUYERS = [
    ("Kavitha Rao", "buyer@agriconnect.in", "9848011223", "Telangana", "Warangal", "Retailer", "Rao Fresh Organics", "Paddy, Tomato, Cotton", "demo1234"),
    ("Rajesh Traders", "trader@agriconnect.in", "9848055667", "Telangana", "Hanamkonda", "Trader", "Rajesh Agri Exports", "Paddy, Wheat, Maize", "demo1234"),
]

SEED_ADVISORY_RULES = [
    {
        "rule_code": "RULE-NITRO-01",
        "title": "Possible nitrogen deficiency in the standing crop",
        "keywords": "yellow,yellowing,pale,chlorosis,light green",
        "crop_name": "",
        "growth_stage": "Vegetative,Flowering",
        "soil_type": "Sandy,Red",
        "irrigation_condition": "Limited irrigation,Rainfed only",
        "recommendation": json.dumps([
            "Yellowing that begins on the older, lower leaves and moves upward is often associated with low nitrogen availability.",
            "Consider a split application of a nitrogen source (for example urea) after a soil or leaf-colour chart check, and avoid applying it just before heavy rain.",
            "Keep a small untreated strip in the field so you can compare recovery over the next 7–10 days.",
        ]),
        "explanation": "Rule RULE-NITRO-01 fired because pale or yellow foliage during vegetative stages indicates nutrient chlorosis.",
        "next_steps": json.dumps([
            "Confirm with a soil test or a leaf colour chart before applying fertiliser.",
            "Apply nitrogen in two splits rather than a single heavy dose.",
            "Irrigate lightly after application so the nutrient reaches the root zone.",
            "Re-check the crop after 7–10 days and record any change.",
        ]),
        "caution_message": "Over-fertilization can burn roots and cause groundwater runoff. Always adhere to recommended doses.",
        "severity": "Monitor closely",
        "source_reference": "ICAR Soil Nutrient Management Bulletin #42",
        "is_active": 1,
    },
    {
        "rule_code": "RULE-WATERLOG-01",
        "title": "Drainage and root-health check after excess water",
        "keywords": "waterlogging,water logged,heavy rain,flood,standing water,wilting",
        "crop_name": "",
        "growth_stage": "",
        "soil_type": "Clay,Black (regur),Alluvial",
        "irrigation_condition": "",
        "recommendation": json.dumps([
            "Standing water for more than 24–48 hours restricts oxygen around the roots and often leads to yellowing and wilting.",
            "Open drainage channels at the field edges and, where possible, create shallow surface drains across the slope.",
            "Avoid walking in or working the field until the surface has firmed up.",
        ]),
        "explanation": "Waterlogged soils suffocate plant root respiration, causing secondary nutrient blockages and fungal vulnerability.",
        "next_steps": json.dumps([
            "Clear outlet channels so water can leave the field.",
            "After drainage, loosen the surface gently to help the roots breathe.",
            "Watch for root rot or fungal patches over the next week.",
            "Delay top-dressing fertiliser until the field has drained.",
        ]),
        "caution_message": "Never apply granular fertiliser directly into standing water.",
        "severity": "Act within 48 hours",
        "source_reference": "State Agronomy Water Drainage Manual",
        "is_active": 1,
    },
    {
        "rule_code": "RULE-PEST-01",
        "title": "Inspect for pest damage before spraying",
        "keywords": "spots,holes,insect,pest,caterpillar,aphid,borer,chewed,larva",
        "crop_name": "",
        "growth_stage": "",
        "soil_type": "",
        "irrigation_condition": "",
        "recommendation": json.dumps([
            "Chewed leaves, holes and visible insects usually indicate pest activity rather than a nutrient problem.",
            "Identify the pest first — pheromone traps and yellow sticky traps help you decide whether spraying is really needed.",
            "If intervention is required, prefer need-based, recommended doses and avoid spraying during flowering when pollinators are active.",
        ]),
        "explanation": "Visual foliar puncture and chewed foliage indicate active insect feeding beyond economic threshold levels.",
        "next_steps": json.dumps([
            "Walk the field in a 'W' pattern and note how many plants in 10 are affected.",
            "Install sticky or pheromone traps to confirm the pest and its numbers.",
            "Consult the label of any pesticide and follow the recommended dose and waiting period.",
            "Contact your local agriculture officer before applying restricted chemicals.",
        ]),
        "caution_message": "Indiscriminate chemical pesticide spraying destroys beneficial predators and honeybees.",
        "severity": "Act soon",
        "source_reference": "National Institute of Plant Health Management (NIPHM)",
        "is_active": 1,
    },
    {
        "rule_code": "RULE-IRRIG-01",
        "title": "Irrigation scheduling for limited water availability",
        "keywords": "dry,drought,moisture stress,cracks,no rain,scarcity",
        "crop_name": "",
        "growth_stage": "Flowering,Fruiting / Pod filling",
        "soil_type": "Sandy,Loamy,Red",
        "irrigation_condition": "Limited irrigation,Rainfed only,No irrigation available",
        "recommendation": json.dumps([
            "Flowering and pod/fruit filling are the stages most sensitive to moisture stress — protecting water at this stage protects yield.",
            "Prioritise irrigation at these critical stages and consider mulching to reduce evaporation.",
            "Where water is very limited, irrigate alternate rows rather than the whole field.",
        ]),
        "explanation": "Critical moisture stress at anthesis and grain filling drastically impacts photosynthetic sink capacity.",
        "next_steps": json.dumps([
            "Mulch between rows with crop residue or straw where available.",
            "Irrigate during the cooler part of the day to reduce evaporation losses.",
            "Remove weeds that compete for the same moisture.",
            "Record rainfall and irrigation dates to plan the next cycle.",
        ]),
        "caution_message": "Do not let drought stress persist through flowering without emergency protective irrigation if accessible.",
        "severity": "Plan irrigation",
        "source_reference": "ICAR Directorate of Water Management",
        "is_active": 1,
    },
    {
        "rule_code": "RULE-HEALTHY-01",
        "title": "No problem indicators reported — continue routine crop care",
        "keywords": "nothing,no issue,healthy,normal,fine,good,none",
        "crop_name": "",
        "growth_stage": "",
        "soil_type": "",
        "irrigation_condition": "",
        "recommendation": json.dumps([
            "No problem indicators were reported. Continue routine monitoring and keep a simple daily record of the crop.",
            "Scout the field at least once a week so any change is noticed early, when it is cheapest to manage.",
        ]),
        "explanation": "Inputs indicated normal healthy growth parameters with no acute agronomic distress markers.",
        "next_steps": json.dumps([
            "Scout the field weekly and note stage, colour and any unusual patches.",
            "Keep the field free of weeds around the crop rows.",
            "Plan the next irrigation and nutrient schedule in advance.",
            "Take photographs so you can compare the crop week by week.",
        ]),
        "caution_message": "Regular field observation is the best preventative strategy against crop failure.",
        "severity": "No action needed",
        "source_reference": "Standard Agronomic Field Scouting Protocol",
        "is_active": 1,
    },
    {
        "rule_code": "RULE-FUNGAL-01",
        "title": "Possible fungal or disease symptom — confirm before spraying",
        "keywords": "powder,rust,blight,rot,mould,fungus,brown patch,black spot",
        "crop_name": "",
        "growth_stage": "",
        "soil_type": "",
        "irrigation_condition": "",
        "recommendation": json.dumps([
            "Powdery growth, rust-coloured pustules, rotting or spreading patches are usually disease symptoms rather than nutrient problems.",
            "Remove and destroy badly affected plant parts, improve air movement, and avoid overhead irrigation late in the day.",
            "Confirm the disease before choosing a fungicide — the right product depends on the organism involved.",
        ]),
        "explanation": "Lesions with concentric rings or fungal mycelia indicate foliar or soil-borne fungal pathogens.",
        "next_steps": json.dumps([
            "Collect a sample of an affected leaf for the agriculture officer or KVK.",
            "Avoid working in the field while the foliage is wet.",
            "Do not over-apply nitrogen, which can encourage soft, susceptible growth.",
            "Follow the recommended waiting period before harvest if you do spray.",
        ]),
        "caution_message": "Ensure personal protective equipment (mask and gloves) when handling fungicides.",
        "severity": "Confirm before spraying",
        "source_reference": "Indian Phytopathological Society Guidelines",
        "is_active": 1,
    },
]

SEED_SCHEMES = [
    {
        "name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "description": "Central income-support scheme providing direct financial assistance to landholding farmer families across India.",
        "level": "Central",
        "category": "Income support",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": json.dumps(["Aadhaar card", "Land ownership records (RoR / Khatauni)", "Bank account details with IFSC", "Mobile number"]),
        "conditions": json.dumps([
            "Family definition and exclusion criteria must be checked on the official portal",
            "Land records must be verified by the local revenue authority",
            "Bank account must be Aadhaar-seeded for DBT transfer"
        ]),
        "instructions": "Apply through the PM-KISAN portal, the nearest Common Service Centre (CSC), or the local agriculture/revenue office.",
        "official_url": "https://pmkisan.gov.in/",
        "source_name": "Ministry of Agriculture & Farmers Welfare, GoI",
        "last_verified_at": "10 Oct 2026",
    },
    {
        "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "description": "Comprehensive crop insurance scheme providing financial support to farmers suffering crop loss or damage arising out of unforeseen natural events.",
        "level": "Central",
        "category": "Crop insurance",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "Paddy,Wheat,Cotton,Sugarcane,Groundnut,Soybean,Maize,Onion,Tomato,Chilli",
        "requires_field_verification": 1,
        "documents": json.dumps(["Land records / tenancy certificate", "Sowing certificate", "Aadhaar card", "Bank passbook", "Crop details (survey number, area sown)"]),
        "conditions": json.dumps([
            "The crop and the area must be notified for the season",
            "Enrolment must happen before the cut-off date announced for the season",
            "Loss must be intimated within the prescribed time limit"
        ]),
        "instructions": "Enrol through the PMFBY portal, your bank branch, a Common Service Centre, or an insurance intermediary before the seasonal cut-off date.",
        "official_url": "https://pmfby.gov.in/",
        "source_name": "Ministry of Agriculture & Farmers Welfare, GoI",
        "last_verified_at": "10 Oct 2026",
    },
    {
        "name": "Soil Health Card Scheme",
        "description": "Promotes balanced nutrient application by issuing soil health cards with crop-wise nutrient dosage recommendations.",
        "level": "Central",
        "category": "Soil health",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 0,
        "documents": json.dumps(["Land records or farmer identity proof", "Field survey number"]),
        "conditions": json.dumps([
            "Soil samples must be collected following the prescribed grid procedure",
            "Card validity and re-testing interval follow state guidelines"
        ]),
        "instructions": "Contact your nearest soil testing laboratory, Krishi Vigyan Kendra (KVK), or block agriculture department office to request soil sampling.",
        "official_url": "https://soilhealth.dac.gov.in/",
        "source_name": "Department of Agriculture & Cooperation, GoI",
        "last_verified_at": "10 Oct 2026",
    },
    {
        "name": "Kisan Credit Card (KCC)",
        "description": "Provides timely and adequate credit to farmers for agricultural inputs and seasonal cultivation requirements at concessional interest rates.",
        "level": "Central",
        "category": "Credit",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": json.dumps(["Identity and address proof", "Land documents", "Crop pattern / cropping details", "Passport-size photographs", "Bank account details"]),
        "conditions": json.dumps([
            "Credit assessment and documentation are completed by the lending bank",
            "Interest subvention depends on timely loan repayment as per RBI/NABARD norms"
        ]),
        "instructions": "Apply at your nearest commercial bank branch, regional rural bank (RRB), or cooperative credit society with land and identity records.",
        "official_url": "https://www.myscheme.gov.in/",
        "source_name": "Reserve Bank of India & NABARD",
        "last_verified_at": "10 Oct 2026",
    },
    {
        "name": "Rythu Bandhu / State Investment Support (illustrative state scheme)",
        "description": "State investment support scheme for agriculture and horticulture crops by way of a grant per acre per season for purchase of inputs.",
        "level": "State",
        "category": "Investment support",
        "states": "Telangana",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": json.dumps(["Pattadar passbook with land details", "Aadhaar card", "Bank account details"]),
        "conditions": json.dumps([
            "Scheme is available only in the configured state (Telangana)",
            "Land should not fall under ineligible forest or non-agricultural categories",
            "Benefit amount and schedule are decided by the state government"
        ]),
        "instructions": "Apply through the state agriculture department portal or the nearest revenue/agriculture office during the notified window.",
        "official_url": "",
        "source_name": "Government of Telangana Agriculture Department",
        "last_verified_at": "10 Oct 2026",
    },
    {
        "name": "Micro Irrigation / Drip & Sprinkler Support (illustrative)",
        "description": "Subsidy support for installation of water-saving micro-irrigation systems such as drip and sprinkler equipment.",
        "level": "Central",
        "category": "Irrigation",
        "states": "",
        "min_land": 0.5,
        "max_land": 99999,
        "crops": "Sugarcane,Banana,Mango,Tomato,Chilli,Cotton,Onion",
        "requires_field_verification": 1,
        "documents": json.dumps(["Land records", "Aadhaar card", "Bank passbook", "Quotation from an empanelled supplier", "Field layout / crop plan"]),
        "conditions": json.dumps([
            "Minimum land holding of 0.5 acres applies as per scheme parameters",
            "Installation must be carried out by an empanelled manufacturer or vendor",
            "Subsidy is released after mandatory physical field verification"
        ]),
        "instructions": "Apply through the state horticulture/agriculture department or the national micro-irrigation portal, then complete installation through an empanelled vendor.",
        "official_url": "https://www.myscheme.gov.in/",
        "source_name": "Per Drop More Crop (PDMC) Mission",
        "last_verified_at": "10 Oct 2026",
    },
]


def seed_database(db_path=None):
    """Seed the SQLite database without duplicating existing records."""
    target_path = db_path or DB_PATH
    Path(target_path).parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(target_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    now = datetime.now().strftime("%d %b %Y")
    today_iso = date.today().isoformat()
    first_of_month = date.today().replace(day=1).isoformat()

    # Ensure schema columns exist via pure sqlite3
    try:
        cur.execute("PRAGMA table_info(users);")
        user_cols = {row[1] for row in cur.fetchall()}
        if "role" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'farmer';")
        if "land_unit" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN land_unit TEXT DEFAULT 'acres';")
        if "buyer_type" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN buyer_type TEXT;")
        if "organisation_name" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN organisation_name TEXT;")
        if "crops_of_interest" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN crops_of_interest TEXT;")
        if "preferred_language" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en';")
        conn.commit()
    except Exception as e:
        print(f"  [!] Schema check notice in seeding: {e}")

    # 1. Seed Users (Farmers and Buyers)
    user_map = {}
    for name, email, phone, state, dist, land, crop, pwd in SEED_USERS:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (email,))
        existing = cur.fetchone()
        if existing:
            user_map[email] = existing[0]
            cur.execute("UPDATE users SET role = 'farmer' WHERE id = ? AND (role IS NULL OR role = '')", (existing[0],))
        else:
            pwd_hash = generate_password_hash(pwd)
            cur.execute(
                """
                INSERT INTO users (name, email, phone, password_hash, role, state, district, land_size, preferred_crop, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'farmer', ?, ?, ?, ?, ?, ?)
                """,
                (name, email, phone, pwd_hash, state, dist, land, crop, now, now)
            )
            user_map[email] = cur.lastrowid
            print(f"  [+] Seeded farmer: {name} ({email})")

    for name, email, phone, state, dist, btype, org, crops, pwd in SEED_BUYERS:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (email,))
        existing = cur.fetchone()
        if existing:
            user_map[email] = existing[0]
        else:
            pwd_hash = generate_password_hash(pwd)
            cur.execute(
                """
                INSERT INTO users (name, email, phone, password_hash, role, state, district, buyer_type, organisation_name, crops_of_interest, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'buyer', ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, email, phone, pwd_hash, state, dist, btype, org, crops, now, now)
            )
            user_map[email] = cur.lastrowid
            print(f"  [+] Seeded buyer: {name} ({email})")

    conn.commit()

    # 2. Seed Crop Listings
    demo_user_id = user_map.get(DEMO_EMAIL, 1)
    lakshmi_user_id = user_map.get("lakshmi@example.in", 2)
    suresh_user_id = user_map.get("suresh@example.in", 3)

    seed_listings = [
        (demo_user_id, "Paddy (Sona Masuri)", 40, "quintal", 2180, "Telangana", "Warangal", first_of_month,
         "Fine-grade Sona Masuri paddy, moisture below 14 percent, machine cleaned and packed in new gunny bags.", "9848012345", "available"),
        (demo_user_id, "Paddy (BPT 5204)", 25, "quintal", 2050, "Telangana", "Warangal", today_iso,
         "Freshly harvested BPT paddy from rabi season, stored in a covered godown.", "9848012345", "available"),
        (lakshmi_user_id, "Cotton (Shankar-6)", 60, "quintal", 7200, "Telangana", "Nalgonda", today_iso,
         "Good staple length cotton, hand-picked and sun dried. Ready for loading within a week.", "lakshmi@example.in", "available"),
        (lakshmi_user_id, "Groundnut", 18, "quintal", 5800, "Telangana", "Nalgonda", today_iso,
         "Bold variety groundnut, cleaned and graded. Suitable for oil extraction.", "lakshmi@example.in", "available"),
        (suresh_user_id, "Tomato (Hybrid)", 30, "quintal", 1600, "Karnataka", "Karimnagar", today_iso,
         "Firm hybrid tomatoes, graded by size, packed in plastic crates of 20 kg.", "9848076543", "available"),
        (suresh_user_id, "Onion (Bellary)", 50, "quintal", 1450, "Karnataka", "Karimnagar", today_iso,
         "Well-cured onions with good skin retention, stored on a raised platform.", "9848076543", "reserved"),
        (demo_user_id, "Maize", 35, "quintal", 1950, "Telangana", "Hanamkonda", today_iso,
         "Yellow maize, moisture checked, suitable for poultry feed.", "9848012345", "available"),
        (lakshmi_user_id, "Chilli (Teja)", 12, "quintal", 13500, "Telangana", "Khammam", today_iso,
         "Teja variety red chilli, sun dried and sorted. High colour value.", "lakshmi@example.in", "available"),
        (suresh_user_id, "Turmeric (Finger)", 20, "quintal", 8600, "Karnataka", "Medak", today_iso,
         "Polished finger turmeric, cured and cleaned, ready for mandi delivery.", "9848076543", "available"),
    ]

    for uid, crop, qty, unit, price, state, dist, date_str, desc, contact, status in seed_listings:
        cur.execute(
            "SELECT id FROM listings WHERE user_id = ? AND crop_name = ?",
            (uid, crop)
        )
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO listings (user_id, crop_name, quantity, unit, expected_price, state, district, availability_date, description, contact_info, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, crop, qty, unit, price, state, dist, date_str, desc, contact, status, now, now)
            )
            print(f"  [+] Seeded listing: {crop} ({qty} {unit})")

    conn.commit()

    # 2b. Seed Buyers
    buyer_ids = []
    for name, email, phone, state, dist, btype, org_name, crops, pwd in SEED_BUYERS:
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if not row:
            pwd_hash = generate_password_hash(pwd)
            cur.execute(
                """
                INSERT INTO users (name, email, phone, password_hash, role, state, district, buyer_type, organisation_name, crops_of_interest, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'buyer', ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, email, phone, pwd_hash, state, dist, btype, org_name, crops, now, now)
            )
            b_id = cur.lastrowid
            buyer_ids.append(b_id)
            print(f"  [+] Seeded buyer: {name} ({email})")
        else:
            buyer_ids.append(row[0])

    conn.commit()

    # 2c. Seed Orders & Wishlist
    if buyer_ids:
        kavitha_id = buyer_ids[0]
        cur.execute("SELECT id FROM listings LIMIT 3")
        listings = [r[0] for r in cur.fetchall()]
        if listings:
            # Order 1: Pending
            cur.execute("SELECT id FROM orders WHERE buyer_id = ? AND listing_id = ?", (kavitha_id, listings[0]))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO orders (buyer_id, listing_id, quantity, offered_price, notes, status, created_at, updated_at)
                    VALUES (?, ?, 10, 2150, 'Interested in 10 quintals of paddy. Can collect directly.', 'pending', ?, ?)
                    """,
                    (kavitha_id, listings[0], now, now)
                )
                print("  [+] Seeded order (pending)")

            # Order 2: Accepted
            if len(listings) > 1:
                cur.execute("SELECT id FROM orders WHERE buyer_id = ? AND listing_id = ?", (kavitha_id, listings[1]))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO orders (buyer_id, listing_id, quantity, offered_price, notes, status, created_at, updated_at)
                        VALUES (?, ?, 5, 2050, 'Ready for immediate dispatch.', 'accepted', ?, ?)
                        """,
                        (kavitha_id, listings[1], now, now)
                    )
                    print("  [+] Seeded order (accepted)")

            # Wishlist item
            if len(listings) > 2:
                cur.execute("SELECT id FROM wishlist WHERE buyer_id = ? AND listing_id = ?", (kavitha_id, listings[2]))
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO wishlist (buyer_id, listing_id, created_at) VALUES (?, ?, ?)",
                        (kavitha_id, listings[2], now)
                    )
                    print("  [+] Seeded wishlist item")

    conn.commit()

    # 3. Seed Advisory Rules
    for r in SEED_ADVISORY_RULES:
        cur.execute("SELECT id FROM advisory_rules WHERE rule_code = ?", (r["rule_code"],))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO advisory_rules (rule_code, title, keywords, crop_name, growth_stage, soil_type, irrigation_condition, recommendation, explanation, next_steps, caution_message, severity, source_reference, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    r["rule_code"], r["title"], r["keywords"], r["crop_name"],
                    r["growth_stage"], r["soil_type"], r["irrigation_condition"],
                    r["recommendation"], r["explanation"], r["next_steps"],
                    r["caution_message"], r["severity"], r["source_reference"], r["is_active"]
                )
            )
            print(f"  [+] Seeded advisory rule: {r['rule_code']}")

    conn.commit()

    # 4. Seed Government Schemes
    for s in SEED_SCHEMES:
        cur.execute("SELECT id FROM schemes WHERE name = ?", (s["name"],))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO schemes (name, description, level, category, states, min_land, max_land, crops, requires_field_verification, documents, conditions, instructions, official_url, source_name, last_verified_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    s["name"], s["description"], s["level"], s["category"], s["states"],
                    s["min_land"], s["max_land"], s["crops"], s["requires_field_verification"],
                    s["documents"], s["conditions"], s["instructions"], s["official_url"],
                    s["source_name"], s["last_verified_at"], 1
                )
            )
            print(f"  [+] Seeded scheme: {s['name']}")

    conn.commit()
    conn.close()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    import sys
    db_file = sys.argv[1] if len(sys.argv) > 1 else DB_PATH
    print(f"Initializing schema at {db_file}...")
    conn = sqlite3.connect(db_file)
    schema_path = BASE_DIR / "schema.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.close()
    print(f"Seeding demo data into {db_file}...")
    seed_database(db_file)
