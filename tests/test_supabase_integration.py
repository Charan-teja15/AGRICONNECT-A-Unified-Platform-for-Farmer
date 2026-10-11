from services.supabase_service import SupabaseService

def test_supabase_service_initialization():
    service = SupabaseService()
    # When unconfigured in local test, should safely report not configured
    assert isinstance(service.is_configured(), bool)


def test_supabase_advisory_rule_matching():
    service = SupabaseService()

    # Test leaf yellowing evaluation
    result = service.evaluate_advisory(
        crop_name="Paddy (Rice)",
        growth_stage="Vegetative",
        symptoms="Leaf Yellowing / Chlorosis with pale lower leaves",
        soil_type="Sandy Loam",
        watering_condition="Rainfed only"
    )

    assert "possible_cause" in result
    assert "recommended_action" in result
    assert "prevention_tips" in result
    assert "disclaimer" in result
    # Must clearly label results as general guidance, never a guaranteed diagnosis
    assert "not an individualized laboratory diagnosis" in result["disclaimer"]


def test_supabase_advisory_no_match():
    service = SupabaseService()

    result = service.evaluate_advisory(
        crop_name="Unknown Rare Orchid",
        growth_stage="Flowering",
        symptoms="Iridescent purple glowing spots unknown to biology"
    )

    assert result["matched"] is False
    assert "No Direct Rule Match Found" in result["title"]
    assert "Krishi Vigyan Kendra" in result["recommended_action"]


def test_supabase_scheme_matching_all_india():
    service = SupabaseService()

    # Small farmer in Telangana with 2 acres of Paddy
    matches = service.match_government_schemes(
        state="Telangana",
        district="Warangal",
        land_size_acres=2.0,
        crop_type="Paddy"
    )

    assert len(matches) > 0
    scheme_names = [m["scheme_name"] for m in matches]
    assert any("PM-KISAN" in name for name in scheme_names)

    # Check verified official URL presence
    pm_kisan = next(m for m in matches if "PM-KISAN" in m["scheme_name"])
    assert pm_kisan["official_url"].startswith("https://")
    assert "required_documents" in pm_kisan
    assert "disclaimer" in pm_kisan
    assert "not a formal guarantee" in pm_kisan["disclaimer"]


def test_supabase_scheme_state_filtering():
    service = SupabaseService()

    # Punjab farmer should not match Telangana-specific scheme as top state match
    punjab_matches = service.match_government_schemes(
        state="Punjab",
        district="Moga",
        land_size_acres=4.0,
        crop_type="Wheat"
    )

    for m in punjab_matches:
        if "Rythu Bandhu" in m["scheme_name"]:
            # State condition must require verification
            assert any("Telangana" in cond for cond in m["conditions_to_verify"])
