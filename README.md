# AGRICONNECT: A Unified Platform for Farmer Market Access, Crop Advisory, and Subsidy Awareness

**Tagline:** *"Connecting Farmers to Markets, Knowledge and Government Support."*

---

## 1. Project Overview & Architecture

**AGRICONNECT** is a comprehensive full-stack agricultural service platform created to solve three fundamental challenges experienced by smallholder and marginal farmers:
1. **Farmer Marketplace:** Direct access to prospective buyers without intermediary exploitation.
2. **Rule-Based Crop Advisory:** Transparent, explainable agronomic guidance addressing crop symptoms, nutrient deficiencies, and drainage issues.
3. **Government Scheme Discovery:** Systematic matching against verified central and state welfare programmes, credit facilities, and insurance policies based on landholding and cropping parameters.

### Modern Hybrid Architecture:
- **Database & Auth Layer:** **Supabase PostgreSQL** with strict Row-Level Security (RLS), automated `updated_at` triggers, and Supabase Auth.
- **Application Layer:** Modular Flask Blueprints / Express with transparent, explainable rule engines.
- **Client Layer:** Server-rendered Jinja2 templates styled with Bootstrap 5, Bootstrap Icons, and optional client-side Supabase JavaScript SDK integration.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGRICONNECT User Interface                      │
│     (HTML5, CSS3, Bootstrap 5, Jinja2 Templates, Bootstrap Icons)      │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
    Server-Rendered Routes & Forms          Direct Client SDK
                    │                                │
┌───────────────────▼────────────────────────┐       │
│         Flask Presentation Layer           │       │
│ (Blueprints: auth, marketplace, advisory,  │       │
│      subsidies, dashboard, profile)        │       │
└───────────────────▲────────────────────────┘       │
                    │                                │
┌───────────────────▼────────────────────────────────▼───────────────────┐
│                    Supabase Backend-as-a-Service                       │
│  ┌────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │         Supabase Auth          │  │    PostgreSQL Database       │  │
│  │ (Email/Password, JWT Sessions) │  │ (RLS Policies on All Tables) │  │
│  └────────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Tables: profiles | marketplace_listings | advisory_rules       │  │
│  │           government_schemes | advisory_history                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase Database Schema

The database is built on PostgreSQL with Row-Level Security (RLS) enabled across all public tables:

### 2.1 Tables Specification

1. **`public.profiles`**
   - `id`: UUID (Primary Key, references `auth.users(id)` ON DELETE CASCADE)
   - `full_name`: TEXT NOT NULL
   - `phone`: TEXT
   - `village`: TEXT
   - `district`: TEXT
   - `state`: TEXT
   - `created_at`: TIMESTAMPTZ DEFAULT now()
   - `updated_at`: TIMESTAMPTZ DEFAULT now()

2. **`public.marketplace_listings`**
   - `id`: UUID (Primary Key, DEFAULT `gen_random_uuid()`)
   - `seller_id`: UUID (NOT NULL, references `auth.users(id)`)
   - `crop_name`: TEXT NOT NULL
   - `category`: TEXT NOT NULL DEFAULT 'Grains & Cereals'
   - `quantity`: NUMERIC NOT NULL CHECK (quantity >= 0)
   - `unit`: TEXT NOT NULL DEFAULT 'quintal'
   - `price_per_unit`: NUMERIC CHECK (price_per_unit >= 0)
   - `district`: TEXT NOT NULL
   - `state`: TEXT NOT NULL
   - `description`: TEXT
   - `status`: TEXT NOT NULL DEFAULT 'active' CHECK (`status` IN ('active', 'reserved', 'sold', 'inactive'))
   - `created_at`: TIMESTAMPTZ DEFAULT now()
   - `updated_at`: TIMESTAMPTZ DEFAULT now()

3. **`public.advisory_rules`**
   - `id`: UUID (Primary Key, DEFAULT `gen_random_uuid()`)
   - `crop_name`: TEXT (Crop or crop category)
   - `growth_stage`: TEXT (Seedling, Vegetative, Flowering, Fruiting, Maturity)
   - `symptom_category`: TEXT NOT NULL (e.g., Leaf Yellowing, Stem Rot, Chewed Leaves)
   - `soil_type`: TEXT (Sandy, Clay, Loamy, Black, Red, Alluvial)
   - `watering_condition`: TEXT (Adequate, Limited, Rainfed only, Excess water)
   - `possible_cause`: TEXT NOT NULL (Scientifically grounded cause)
   - `recommended_action`: TEXT NOT NULL (Step-by-step practical remedies)
   - `prevention_tips`: TEXT NOT NULL (Preventative agronomic measures)
   - `source_url`: TEXT (Official ICAR / extension source)
   - `last_verified_at`: DATE DEFAULT CURRENT_DATE
   - `active`: BOOLEAN NOT NULL DEFAULT true

4. **`public.government_schemes`**
   - `id`: UUID (Primary Key, DEFAULT `gen_random_uuid()`)
   - `scheme_name`: TEXT NOT NULL UNIQUE
   - `description`: TEXT NOT NULL
   - `state`: TEXT NOT NULL DEFAULT 'All-India'
   - `benefits`: TEXT NOT NULL (Explicit financial and technical assistance)
   - `eligibility_rules`: JSONB NOT NULL DEFAULT '{}' (Structured constraints: `min_land_acres`, `max_land_acres`, `farmer_categories`, `crop_eligibility`)
   - `required_documents`: TEXT[] NOT NULL
   - `application_steps`: TEXT NOT NULL
   - `official_url`: TEXT (Official verified portal URL)
   - `source_url`: TEXT (Ministry reference)
   - `last_verified_at`: DATE DEFAULT CURRENT_DATE
   - `active`: BOOLEAN NOT NULL DEFAULT true

5. **`public.advisory_history`**
   - `id`: UUID (Primary Key, DEFAULT `gen_random_uuid()`)
   - `user_id`: UUID (references `auth.users(id)` ON DELETE CASCADE)
   - `crop_name`: TEXT NOT NULL
   - `farmer_inputs`: JSONB NOT NULL
   - `advisory_rule_id`: UUID (references `public.advisory_rules(id)`)
   - `created_at`: TIMESTAMPTZ DEFAULT now()

---

## 3. Row-Level Security (RLS) Policies

All tables have RLS enabled with explicit security policies:

| Table | Operation | Scope / Condition |
|---|---|---|
| `profiles` | `SELECT` | Public / Authenticated read (to display farmer names on listings) |
| `profiles` | `UPDATE` | `auth.uid() = id` (WITH CHECK `auth.uid() = id`) |
| `profiles` | `INSERT` | `auth.uid() = id` or via database trigger `handle_new_user()` |
| `marketplace_listings` | `SELECT` | Public read where `status = 'active'` OR `auth.uid() = seller_id` |
| `marketplace_listings` | `INSERT` | Authenticated users where `auth.uid() = seller_id` |
| `marketplace_listings` | `UPDATE` | `auth.uid() = seller_id` (WITH CHECK `auth.uid() = seller_id`) |
| `marketplace_listings` | `DELETE` | `auth.uid() = seller_id` |
| `advisory_rules` | `SELECT` | Public read where `active = true` |
| `advisory_rules` | `INSERT/UPDATE/DELETE` | Admin role only (Service Role key) |
| `government_schemes` | `SELECT` | Public read where `active = true` |
| `government_schemes` | `INSERT/UPDATE/DELETE` | Admin role only (Service Role key) |
| `advisory_history` | `SELECT` | `auth.uid() = user_id` (Users access only their own history) |
| `advisory_history` | `INSERT` | `auth.uid() = user_id` |

---

## 4. Supabase Setup Instructions (Step-by-Step)

### Step 1: Create a Supabase Project
1. Log in to [Supabase Dashboard](https://app.supabase.com/).
2. Click **New Project** and choose a name (e.g. `agriconnect-db`).
3. Set a strong database password and select your nearest region.

### Step 2: Execute SQL Migrations & Policies
1. In your Supabase project dashboard, navigate to **SQL Editor** (left menu).
2. Click **New Query**.
3. Open `supabase_schema.sql` from the project repository, copy its entire contents, paste into the SQL editor, and click **Run**.
4. *(Optional)* Run `supabase_seed_data.sql` to populate 12 sample marketplace listings.

### Step 3: Retrieve API Credentials
1. Go to **Project Settings > API**.
2. Copy:
   - **Project URL** (`https://your-ref.supabase.co`)
   - **anon / public key** (`eyJ...`)
   - **service_role key** (keep secret; use only for backend admin scripts)
3. Paste these values into your `.env` file:
   ```env
   SUPABASE_URL=https://your-ref.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

---

## 5. Local Execution Guide (Windows & VS Code)

### Step 1: Open in VS Code
1. Launch **Visual Studio Code**.
2. Select **File > Open Folder...** and choose this project directory.
3. Open a terminal (**Terminal > New Terminal**).

### Step 2: Set Up Virtual Environment
```powershell
python -m venv .venv
```

### Step 3: Activate Virtual Environment
- **PowerShell:**
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **Command Prompt (CMD):**
  ```cmd
  .venv\Scripts\activate.bat
  ```

### Step 4: Install Dependencies
```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Step 5: Configure Environment Variables
```powershell
copy .env.example .env
```
*(Open `.env` and fill in your Supabase credentials or leave defaults for local database mode)*

### Step 6: Initialize Local Database (Optional Fallback)
```powershell
python seed_data.py
```

### Step 7: Start the Application
```powershell
python app.py
```
Open your browser at:
```
http://127.0.0.1:5000/
```

### Step 8: Run Automated Tests
```powershell
python -m pytest -v
```

---

## 6. Service Modules & Business Logic

### A. Crop Advisory Engine
- **Transparent Rule-Based Guidance:** Evaluates combinations of Crop Name, Growth Stage, Symptoms, Soil Type, and Watering Condition against active agronomic rules.
- **Scientific Recommendations:** Provides probable causes, concrete step-by-step actions, and prevention strategies based on ICAR guidelines.
- **Mandatory Disclaimer:** Prominently states that results constitute informational extension guidance rather than a guaranteed laboratory diagnosis. Recommends in-person confirmation with a local Krishi Vigyan Kendra (KVK).
- **Graceful Fallback:** If no rule matches, clearly advises consulting a local agriculture extension officer without fabricating advice.

### B. Government Scheme Eligibility Module
- **Structured Matching:** Evaluates farmer profile against structured constraints:
  - Geographic validity (Central schemes vs. State-specific schemes like Rythu Bandhu).
  - Landholding categories (Marginal, Small, Semi-Medium, Medium, Large).
  - Crop coverage (Notified crops vs. Universal food grains).
- **Match Statuses:**
  - `Potential Match`: Basic profile parameters satisfy stored scheme rules.
  - `Additional Verification Required`: Land records, Aadhaar e-KYC, or field inspection mandated.
  - `Check Conditions`: Discrepancy noted (e.g. state or landholding threshold).
- **Official Links:** Displays verified government portal links (`pmkisan.gov.in`, `pmfby.gov.in`, `soilhealth.dac.gov.in`, `agrimachinery.nic.in`) and verification dates.

### C. Farmer Marketplace
- Browse active listings with filters for Crop Name, Category, State, District, and Price Range.
- Farmers manage only their own listings (Edit / Mark as Sold / Delete).
- Strict ownership checks enforced at both the application and database (RLS) layers.

### D. Farmer Dashboard
- Dynamically calculated statistics from live database records:
  - Active listings count owned by the farmer.
  - Recent crop listings with one-click edit/delete triggers.
  - Recent advisory queries.
  - Potentially matching schemes.

---

## 7. Testing & Verification Checklist

| Test Category | Description | Status |
|---|---|---|
| **Supabase Schema** | Tables, foreign keys, triggers, and constraints create without errors | Passed |
| **Row-Level Security** | Unauthorized updates/deletes to listings or profiles are rejected by RLS | Passed |
| **Auth & Sessions** | Farmers can register, log in, view profile, and log out | Passed |
| **Marketplace CRUD** | Listings can be created, searched, filtered, updated, and deleted by owner | Passed |
| **Advisory Evaluation** | Symptoms match active rules; returns cause, actions, and cautions | Passed |
| **Advisory Fallback** | Unknown symptoms return safe extension advisory fallback | Passed |
| **Scheme Matching** | Multi-factor matching respects state and landholding conditions | Passed |
| **Official URLs** | Scheme records contain verified official `.gov.in` / `.nic.in` URLs | Passed |
| **Dashboard Isolation** | Statistics and history are strictly isolated to the logged-in user | Passed |

---

## 8. Troubleshooting Guide

- **Error: `supabase` module not found:** Run `pip install -r requirements.txt`. The application features an automatic fallback that allows local execution even before installing the Supabase client.
- **PowerShell Script Execution Policy Error:** Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` in PowerShell to enable virtual environment activation.
- **RLS Permission Denied Error:** Ensure user is authenticated before inserting into `marketplace_listings` or `advisory_history`. Verify `seller_id` matches `auth.uid()`.
- **Database Connection Error:** Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`. Ensure your Supabase project status is **Active** in the dashboard.
