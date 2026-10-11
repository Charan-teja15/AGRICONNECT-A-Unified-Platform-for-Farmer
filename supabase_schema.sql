-- ============================================================================
-- AGRICONNECT: Supabase PostgreSQL Schema & Row-Level Security (RLS) Setup
-- ============================================================================
-- Run this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- 2.1 Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    village TEXT,
    district TEXT,
    state TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Marketplace Listings Table
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Grains & Cereals',
    quantity NUMERIC NOT NULL CHECK (quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'quintal',
    price_per_unit NUMERIC CHECK (price_per_unit >= 0),
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'sold', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Advisory Rules Table (Rule-Based Agricultural Expert System)
CREATE TABLE IF NOT EXISTS public.advisory_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_name TEXT,
    growth_stage TEXT,
    symptom_category TEXT NOT NULL,
    soil_type TEXT,
    watering_condition TEXT,
    possible_cause TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    prevention_tips TEXT NOT NULL,
    source_url TEXT,
    last_verified_at DATE NOT NULL DEFAULT CURRENT_DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Government Schemes Table
CREATE TABLE IF NOT EXISTS public.government_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'All-India',
    benefits TEXT NOT NULL,
    eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    required_documents TEXT[] NOT NULL DEFAULT '{}',
    application_steps TEXT NOT NULL,
    official_url TEXT,
    source_url TEXT,
    last_verified_at DATE NOT NULL DEFAULT CURRENT_DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.5 Advisory History Table (Farmer Audit Trail)
CREATE TABLE IF NOT EXISTS public.advisory_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    farmer_inputs JSONB NOT NULL,
    advisory_rule_id UUID REFERENCES public.advisory_rules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_marketplace_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_crop ON public.marketplace_listings(crop_name);
CREATE INDEX IF NOT EXISTS idx_marketplace_location ON public.marketplace_listings(state, district);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON public.marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_advisory_rules_crop ON public.advisory_rules(crop_name);
CREATE INDEX IF NOT EXISTS idx_advisory_rules_symptom ON public.advisory_rules(symptom_category);
CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.government_schemes(state);
CREATE INDEX IF NOT EXISTS idx_advisory_history_user ON public.advisory_history(user_id);

-- ============================================================================
-- 4. TIMESTAMP UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_marketplace_updated_at ON public.marketplace_listings;
CREATE TRIGGER set_marketplace_updated_at
    BEFORE UPDATE ON public.marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. AUTH USER CREATION HOOK (AUTOMATIC PROFILE CREATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, village, district, state)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'village',
        NEW.raw_user_meta_data->>'district',
        NEW.raw_user_meta_data->>'state'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_history ENABLE ROW LEVEL SECURITY;

-- 6.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Public can view basic farmer profiles" ON public.profiles;
CREATE POLICY "Public can view basic farmer profiles"
    ON public.profiles
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 6.2 MARKETPLACE LISTINGS POLICIES
DROP POLICY IF EXISTS "Anyone can browse active crop listings" ON public.marketplace_listings;
CREATE POLICY "Anyone can browse active crop listings"
    ON public.marketplace_listings
    FOR SELECT
    USING (status = 'active' OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Authenticated farmers can create listings" ON public.marketplace_listings;
CREATE POLICY "Authenticated farmers can create listings"
    ON public.marketplace_listings
    FOR INSERT
    WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update only their own listings" ON public.marketplace_listings;
CREATE POLICY "Sellers can update only their own listings"
    ON public.marketplace_listings
    FOR UPDATE
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete only their own listings" ON public.marketplace_listings;
CREATE POLICY "Sellers can delete only their own listings"
    ON public.marketplace_listings
    FOR DELETE
    USING (auth.uid() = seller_id);

-- 6.3 ADVISORY RULES POLICIES
DROP POLICY IF EXISTS "Anyone can view active advisory rules" ON public.advisory_rules;
CREATE POLICY "Anyone can view active advisory rules"
    ON public.advisory_rules
    FOR SELECT
    USING (active = true);

-- 6.4 GOVERNMENT SCHEMES POLICIES
DROP POLICY IF EXISTS "Anyone can view active government schemes" ON public.government_schemes;
CREATE POLICY "Anyone can view active government schemes"
    ON public.government_schemes
    FOR SELECT
    USING (active = true);

-- 6.5 ADVISORY HISTORY POLICIES
DROP POLICY IF EXISTS "Users can view their own advisory queries" ON public.advisory_history;
CREATE POLICY "Users can view their own advisory queries"
    ON public.advisory_history
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can record their own advisory queries" ON public.advisory_history;
CREATE POLICY "Users can record their own advisory queries"
    ON public.advisory_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- 7. SEED DATA (REALISTIC & VERIFIED EXTENSION DATA)
-- ============================================================================

-- 7.1 SEED ADVISORY RULES (Scientific Extension Guidelines)
INSERT INTO public.advisory_rules (
    crop_name, growth_stage, symptom_category, soil_type, watering_condition,
    possible_cause, recommended_action, prevention_tips, source_url, last_verified_at, active
) VALUES
(
    'Paddy (Rice)', 'Vegetative', 'Leaf Yellowing / Chlorosis', 'Sandy Loam', 'Rainfed only',
    'Nitrogen (N) deficiency, often exacerbated by leaching in coarse soils under uneven rainfall.',
    'Apply urea in split doses (e.g. 25-30 kg/acre top dressing) when soil is moist, following a leaf color chart (LCC) check. Avoid application immediately before heavy downpours.',
    'Incorporate well-decomposed farmyard manure (FYM) or green manure (Dhaincha) during land preparation to increase soil organic matter and nutrient retention capacity.',
    'https://icar.org.in/', CURRENT_DATE, true
),
(
    'Paddy (Rice)', 'Flowering', 'Stem Rot / Standing Water', 'Clay', 'Excess water / Flooding',
    'Root asphyxiation and sheath blight vulnerability resulting from stagnant standing water over 48 hours.',
    'Drain standing water from the field through field-edge channels immediately. Allow topsoil aeration for 24-48 hours before any mild irrigation.',
    'Construct shallow surface drainage channels across slopes before monsoon sowing to prevent water stagnation in low-lying plots.',
    'https://crri.icar.gov.in/', CURRENT_DATE, true
),
(
    'Cotton', 'Vegetative', 'Holes in Leaves / Caterpillar', 'Black (Regur)', 'Adequate irrigation',
    'Chewing pest activity (likely Spodoptera or Helicoverpa caterpillar larvae feeding on tender foliage).',
    'Install 4-5 pheromone traps per acre to assess moth population. Apply neem seed kernel extract (NSKE 5%) or recommended bio-pesticides (Bt spray) at early instar stages.',
    'Practice clean cultivation, remove weed hosts (Abutilon indicum) from bunds, and avoid excessive vegetative nitrogen top-dressing.',
    'https://cicr.icar.gov.in/', CURRENT_DATE, true
),
(
    'Tomato', 'Fruiting / Pod filling', 'Fruit Cracking / Wilting', 'Sandy', 'Limited irrigation',
    'Moisture fluctuation stress causing irregular fruit cell expansion, exacerbated by high diurnal temperatures.',
    'Maintain uniform soil moisture using drip irrigation or alternate-furrow watering during cooler morning hours. Apply straw or dry grass mulching.',
    'Avoid letting the root zone dry completely between irrigation cycles during the fruit enlargement period.',
    'https://iihr.res.in/', CURRENT_DATE, true
),
(
    'Wheat', 'Tillering', 'Pale Yellow Stripes', 'Alluvial', 'Adequate irrigation',
    'Sulphur or Zinc micronutrient deficiency commonly observed in intensive cereal rotations.',
    'Foliar spray of 0.5% zinc sulphate heptahydrate (2.5 kg ZnSO4 + 1.25 kg unslaked lime in 500L water per hectare) on sunny days.',
    'Conduct a biennial soil health test and apply basal zinc sulphate (25 kg/ha) at field preparation once every two years.',
    'https://dwr.icar.gov.in/', CURRENT_DATE, true
),
(
    'Groundnut', 'Pod filling', 'Leaf Spots with Yellow Halo (Tikka)', 'Red Sandy', 'Rainfed only',
    'Early and late leaf spot (Cercospora arachidicola / Cercosporidium personatum) fungal infection favored by humid conditions.',
    'Spray chlorothalonil (2 g/L water) or mancozeb (2 g/L) at first appearance of spots. Ensure thorough lower leaf canopy coverage.',
    'Adopt crop rotation with non-legumes (e.g., sorghum or pearl millet) and use certified disease-free treated seed.',
    'https://dgr.icar.gov.in/', CURRENT_DATE, true
),
(
    'Maize', 'Vegetative', 'Whorl Damage / Window Paning', 'Loamy', 'Adequate irrigation',
    'Fall Armyworm (Spodoptera frugiperda) larval infestation inside the central leaf whorl.',
    'Apply dry sand or wood ash mixed with lime into leaf whorls early morning. For severe infestation, consult block agronomist for approved bio-rationals.',
    'Intercrop with legumes (cowpea or pigeonpea) and avoid staggered plantings in adjacent fields.',
    'https://iimr.icar.gov.in/', CURRENT_DATE, true
),
(
    'Chilli', 'Vegetative', 'Upward Leaf Curling', 'Black (Regur)', 'Limited irrigation',
    'Chilli thrips (Scirtothrips dorsalis) lacerating foliage and sucking plant sap.',
    'Install yellow sticky traps (10-15 per acre) at canopy level. Spray 5% neem seed oil or soap solution on lower leaf surfaces.',
    'Grow barrier crops like maize or sorghum in 2-3 border rows around chilli plots to hinder vector migration.',
    'https://iihr.res.in/', CURRENT_DATE, true
);

-- 7.2 SEED GOVERNMENT SCHEMES (Verified Real Government Initiatives)
INSERT INTO public.government_schemes (
    scheme_name, description, state, benefits, eligibility_rules,
    required_documents, application_steps, official_url, source_url, last_verified_at, active
) VALUES
(
    'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    'Central sector income support scheme providing Rs. 6,000 per year in three equal installments directly into bank accounts of landholding farmer families.',
    'All-India',
    'Rs. 6,000 per year transferred via Direct Benefit Transfer (DBT) in three four-monthly installments of Rs. 2,000 each.',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "farmer_categories": ["Marginal", "Small", "Semi-Medium", "Medium", "Large"],
        "exclusions": ["Institutional landholders", "Income tax payers in last assessment year", "Serving or retired government employees"],
        "requires_aadhaar": true
    }'::jsonb,
    ARRAY['Aadhaar Card', 'Land Ownership Record (Khatauni / RoR / Pattadar Passbook)', 'Bank Account Details with IFSC', 'Aadhaar-linked Mobile Number'],
    '1. Visit pmkisan.gov.in portal. 2. Click "Farmers Corner" -> "New Farmer Registration". 3. Enter Aadhaar number and select state. 4. Fill land details from your land record. 5. Complete e-KYC using OTP or biometric CSC verification.',
    'https://pmkisan.gov.in/',
    'https://agricoop.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    'National crop insurance scheme protecting farmers against comprehensive non-preventable natural yield risks from pre-sowing to post-harvest.',
    'All-India',
    'Uniform low premium rate (2% for Kharif food crops/oilseeds, 1.5% for Rabi, 5% for annual commercial/horticultural crops) with government covering remaining premium subsidy.',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "farmer_categories": ["Loanee Farmers", "Non-Loanee Farmers", "Sharecroppers", "Tenant Farmers"],
        "crop_eligibility": ["Paddy", "Wheat", "Cotton", "Groundnut", "Soybean", "Maize", "Onion", "Tomato", "Chilli"],
        "requires_notified_area": true
    }'::jsonb,
    ARRAY['Land Possession Document / Record of Rights (RoR)', 'Sowing Certificate / Declaration from Village Revenue Officer', 'Bank Passbook Copy', 'Aadhaar Card'],
    '1. Open pmfby.gov.in or visit designated Bank Branch / Common Service Centre before cut-off date. 2. Select current season, crop, and village notification unit. 3. Upload land document and sowing certificate. 4. Pay subsidized farmer premium share and receive insurance receipt policy.',
    'https://pmfby.gov.in/',
    'https://agricoop.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Soil Health Card Scheme',
    'Promotes scientific nutrient stewardship by testing farmer soil samples every two years and recommending customized macro- and micro-nutrient dosages.',
    'All-India',
    'Free soil sampling and lab diagnostic report detailing pH, electrical conductivity, organic carbon, nitrogen, phosphorus, potash, and micronutrients with crop-wise fertilizer dosage charts.',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "farmer_categories": ["All Landholding Farmers"],
        "testing_frequency": "Every 2 years"
    }'::jsonb,
    ARRAY['Land Survey Number', 'Village Revenue Map details', 'Farmer Identity Proof'],
    '1. Contact local Agriculture Extension Officer (AEO) or nearest Krishi Vigyan Kendra (KVK). 2. Department personnel collect GPS-tagged soil sample from representative field grid. 3. Lab analysis is performed and physical Soil Health Card is delivered to farmer with advisory.',
    'https://soilhealth.dac.gov.in/',
    'https://agricoop.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Kisan Credit Card (KCC) Scheme',
    'Revolving institutional credit facility providing timely short-term credit for crop cultivation expenses, post-harvest costs, and maintenance of farm assets.',
    'All-India',
    'Single credit line with concessional interest rate of 7% per annum (further reduced to 4% effective interest upon prompt repayment within 1 year under Interest Subvention Scheme).',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "farmer_categories": ["Owner Cultivators", "Tenant Farmers", "Sharecroppers", "SHGs / JLGs"],
        "credit_type": "Short-term cultivation and maintenance"
    }'::jsonb,
    ARRAY['Completed KCC Application Form', 'Identity & Address Proof (Aadhaar / Voter ID)', 'Land Title Deeds / Revenue Record Copy', 'Passport size photographs', 'Cropping Pattern Declaration'],
    '1. Collect simplified 1-page KCC application form from nearest commercial bank, Regional Rural Bank (RRB), or Cooperative Society. 2. Submit along with land ownership document. 3. Bank assesses scale of finance per acre and issues RuPay Kisan Credit Card within 14 working days.',
    'https://www.myscheme.gov.in/schemes/kcc',
    'https://www.nabard.org/',
    CURRENT_DATE,
    true
),
(
    'Per Drop More Crop (Micro Irrigation Mission - PDMC)',
    'Financial subsidy assisting farmers in installing drip and sprinkler irrigation systems to maximize water use efficiency and fertilizer distribution.',
    'All-India',
    'Financial subsidy of 55% for Small & Marginal farmers and 45% for Other farmers towards the benchmark cost of drip or sprinkler irrigation systems.',
    '{
        "min_land_acres": 0.5,
        "max_land_acres": 12.5,
        "farmer_categories": ["Small and Marginal Farmers (priority 55%)", "Other Farmers (45%)"],
        "requires_assured_water_source": true
    }'::jsonb,
    ARRAY['Aadhaar Card', 'Land Ownership Records (Pahani / 7/12 extract / RoR)', 'Electricity Connection Bill / Water Source Certificate', 'Bank Passbook Copy', 'Quotation from Empanelled Micro Irrigation Supplier'],
    '1. Apply through state horticulture or agriculture department web portal. 2. Submit quotation from empanelled vendor. 3. Field inspection by department engineer. 4. Vendor installs system; physical verification triggers direct release of subsidy.',
    'https://pmksy.gov.in/microirrigation/',
    'https://agricoop.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Rythu Bandhu (Telangana Agriculture Investment Support Scheme)',
    'State investment grant to landholding farmers for purchasing essential seasonal farm inputs such as seeds, fertilizers, pesticides, and field labour.',
    'Telangana',
    'Financial assistance of Rs. 5,000 per acre per season (total Rs. 10,000 per acre per year for Kharif and Rabi seasons) directly credited to bank account.',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "states": ["Telangana"],
        "requires_pattadar_passbook": true
    }'::jsonb,
    ARRAY['Pattadar Passbook with Title Number', 'Aadhaar Card', 'Bank Account details linked with Aadhaar'],
    '1. Verification is based on Dharani integrated land portal records. 2. Eligible farmers with new Pattadar Passbooks submit account details to local Agriculture Extension Officer. 3. Amount is electronically disbursed into bank account before seasonal sowing window.',
    'https://rythubandhu.telangana.gov.in/',
    'https://agri.telangana.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Paramparagat Krishi Vikas Yojana (PKVY)',
    'Centrally sponsored scheme promoting organic farming through cluster approach and Participatory Guarantee System (PGS) certification.',
    'All-India',
    'Financial assistance of Rs. 50,000 per hectare over 3 years, of which Rs. 31,000 is directly provided for organic inputs (bio-fertilizers, vermicompost, botanical extracts).',
    '{
        "min_land_acres": 1.0,
        "max_land_acres": 5.0,
        "cluster_size_acres": 50,
        "focus": "Organic Farming & PGS Certification"
    }'::jsonb,
    ARRAY['Aadhaar Card', 'Land Record / Khatauni', 'Cluster Member Agreement', 'Bank Account Details'],
    '1. Farmers form a cluster of 20-50 farmers covering ~50 acres. 2. Register cluster through Regional Council or District Agriculture Office on Jaivik Kheti portal. 3. Receive training, input subsidies, and PGS organic certification support.',
    'https://pgsindia-ncof.gov.in/',
    'https://agricoop.gov.in/',
    CURRENT_DATE,
    true
),
(
    'Sub-Mission on Agricultural Mechanization (SMAM)',
    'Subsidizes purchase of modern farm equipment, tractors, combine harvesters, and establishes Custom Hiring Centres (CHCs) for smallholders.',
    'All-India',
    '40% to 50% subsidy on approved agricultural equipment for small/marginal, women, and SC/ST farmers; 40% for other categories.',
    '{
        "min_land_acres": 0,
        "max_land_acres": 99999,
        "farmer_categories": ["Individual Farmers", "Custom Hiring Centre Entrepreneurs", "FPOs"],
        "equipment_approval": "Tested by FMTTI"
    }'::jsonb,
    ARRAY['Aadhaar Card', 'Land Record copy', 'Category Certificate (if applicable)', 'Bank Passbook', 'Equipment Quotation from Empanelled Dealer'],
    '1. Register online on agrimachinery.nic.in portal with mobile OTP. 2. Select machinery type and empanelled dealer. 3. Receive administrative sanction. 4. Purchase machine and upload invoice/serial number for direct subsidy reimbursement.',
    'https://agrimachinery.nic.in/',
    'https://farmech.dac.gov.in/',
    CURRENT_DATE,
    true
);
