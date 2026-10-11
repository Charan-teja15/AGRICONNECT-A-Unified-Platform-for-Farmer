-- ============================================================================
-- AGRICONNECT: Supabase Sample Data Seeding Script
-- ============================================================================
-- This script provides realistic demonstration data for marketplace listings.
-- Note: When seeding marketplace listings directly in SQL, we generate sample UUIDs.
-- ============================================================================

DO $$
DECLARE
    seller_ramesh UUID := '11111111-1111-1111-1111-111111111111';
    seller_lakshmi UUID := '22222222-2222-2222-2222-222222222222';
    seller_suresh UUID := '33333333-3333-3333-3333-333333333333';
    seller_gurpreet UUID := '44444444-4444-4444-4444-444444444444';
BEGIN
    -- 1. Create Demonstration Profiles (if auth users with these UUIDs exist or standalone)
    -- In Supabase, if auth users exist, profiles are created via trigger.
    -- For standalone demonstration seed, we insert into profiles directly if allowed:
    BEGIN
        INSERT INTO public.profiles (id, full_name, phone, village, district, state)
        VALUES 
            (seller_ramesh, 'Ramesh Kumar', '9848012345', 'Dharmasagar', 'Warangal', 'Telangana'),
            (seller_lakshmi, 'Lakshmi Devi', '9848098765', 'Chityal', 'Nalgonda', 'Telangana'),
            (seller_suresh, 'Suresh Naik', '9848076543', 'Manakondur', 'Karimnagar', 'Karnataka'),
            (seller_gurpreet, 'Gurpreet Singh', '9815012345', 'Moga Rural', 'Moga', 'Punjab')
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone;
    EXCEPTION WHEN foreign_key_violation THEN
        -- If auth.users foreign key is strictly enforced, listings will be linked to created users
        NULL;
    END;

    -- 2. Insert at least 10 Marketplace Listings across categories, locations & crops
    INSERT INTO public.marketplace_listings (
        seller_id, crop_name, category, quantity, unit, price_per_unit, district, state, description, status
    ) VALUES
    (
        seller_ramesh,
        'Paddy (Sona Masuri BPT 5204)',
        'Grains & Cereals',
        50,
        'quintal',
        2250,
        'Warangal',
        'Telangana',
        'Super fine grade Sona Masuri paddy from Kharif harvest. Moisture certified below 13.5%, machine cleaned and packed in clean 50kg gunny bags.',
        'active'
    ),
    (
        seller_ramesh,
        'Yellow Maize (Hybrid NK-6240)',
        'Grains & Cereals',
        35,
        'quintal',
        1980,
        'Hanamkonda',
        'Telangana',
        'Bright yellow high-starch grain maize suitable for poultry feed millers. Stored in covered godown.',
        'active'
    ),
    (
        seller_lakshmi,
        'Cotton (Shankar-6 Long Staple)',
        'Commercial Crops',
        65,
        'quintal',
        7350,
        'Nalgonda',
        'Telangana',
        'Handpicked, first-picking clean seed cotton with staple length >29mm and low trash content (<3%). Ready for loading.',
        'active'
    ),
    (
        seller_lakshmi,
        'Bold Groundnut (Kadiri Lepakshi)',
        'Oilseeds',
        22,
        'quintal',
        5900,
        'Nalgonda',
        'Telangana',
        'Bold-seeded high-oil groundnut variety, graded and sun-dried. Excellent recovery percentage for oil expellers.',
        'active'
    ),
    (
        seller_lakshmi,
        'Red Chilli (Guntur Teja Stemless)',
        'Spices & Condiments',
        15,
        'quintal',
        14200,
        'Khammam',
        'Telangana',
        'Deep red, pungent Teja chilli. Completely sun-cured with moisture content around 10%. Sorted by size.',
        'active'
    ),
    (
        seller_suresh,
        'Fresh Hybrid Tomatoes (Abhinav)',
        'Vegetables',
        40,
        'quintal',
        1650,
        'Karimnagar',
        'Telangana',
        'Firm, graded table tomatoes packed in standard 20kg plastic crates. Uniform red colour, ideal for retail markets.',
        'active'
    ),
    (
        seller_suresh,
        'Bellary Red Onion',
        'Vegetables',
        60,
        'quintal',
        1500,
        'Karimnagar',
        'Telangana',
        'Medium-to-large sized well-cured red onions with tight skins. Stored on well-ventilated raised platforms.',
        'active'
    ),
    (
        seller_suresh,
        'Cured Finger Turmeric (Salem)',
        'Spices & Condiments',
        25,
        'quintal',
        8800,
        'Medak',
        'Telangana',
        'Polished golden-yellow finger turmeric with high curcumin content (>4.5%). Cured as per traditional boiling norms.',
        'active'
    ),
    (
        seller_gurpreet,
        'Sharbati Organic Wheat',
        'Grains & Cereals',
        80,
        'quintal',
        2650,
        'Moga',
        'Punjab',
        'Naturally grown premium Sharbati wheat, lustrous amber grain, free from chemical residue. Excellent flour elasticity.',
        'active'
    ),
    (
        seller_gurpreet,
        'Yellow Mustard Seed (Pusa Mustard-25)',
        'Oilseeds',
        30,
        'quintal',
        5400,
        'Moga',
        'Punjab',
        'High oil content yellow sarson mustard seed, clean machine-sieved, single-lot quality harvest.',
        'active'
    ),
    (
        seller_ramesh,
        'Soybean (JS-335)',
        'Oilseeds',
        45,
        'quintal',
        4600,
        'Adilabad',
        'Telangana',
        'Dry clean soybean grain from certified seed crop. Ideal for processing units and soya flour manufacturing.',
        'active'
    ),
    (
        seller_suresh,
        'Green Cavendish Banana',
        'Fruits',
        50,
        'crate',
        850,
        'Karimnagar',
        'Telangana',
        'Graded 7-8 hand export-grade green cavendish banana bunches, harvested upon order confirmation.',
        'active'
    );
END $$;
