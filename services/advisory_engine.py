from repositories.advisory_repository import AdvisoryRepository

DEFAULT_CAUTION = (
    "This guidance is informational and comes from simplified rules, not from a "
    "laboratory test or a trained AI model. Field conditions vary widely — confirm "
    "with your local agriculture officer, Krishi Vigyan Kendra, or a qualified "
    "agronomist before applying fertilisers or pesticides. AGRICONNECT does not "
    "guarantee any particular agricultural outcome."
)

NO_MATCH_TEXT = (
    "No sufficiently relevant advisory rule was found for these inputs. Please consult a "
    "qualified agricultural extension officer for further guidance."
)

FALLBACK_RULES = [
    {
        "rule_code": "RULE-NITRO-01",
        "title": "Possible nitrogen deficiency in the standing crop",
        "keywords": ["yellow", "yellowing", "pale", "chlorosis", "light green"],
        "crop_name": None,
        "growth_stage": ["Vegetative", "Flowering"],
        "soil_type": ["Sandy", "Red"],
        "irrigation_condition": ["Limited irrigation", "Rainfed only"],
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
        "source_reference": "ICAR Extension Bulletin on Soil Nutrients",
    },
    {
        "rule_code": "RULE-WATERLOG-01",
        "title": "Drainage and root-health check after excess water",
        "keywords": ["waterlogging", "water logged", "heavy rain", "flood", "standing water", "wilting"],
        "crop_name": None,
        "growth_stage": None,
        "soil_type": ["Clay", "Black (regur)", "Alluvial"],
        "irrigation_condition": None,
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
        "source_reference": "State Agricultural University Agronomy Guidelines",
    },
    {
        "rule_code": "RULE-PEST-01",
        "title": "Inspect for pest damage before spraying",
        "keywords": ["spots", "holes", "insect", "pest", "caterpillar", "aphid", "borer", "chewed", "larva"],
        "crop_name": None,
        "growth_stage": None,
        "soil_type": None,
        "irrigation_condition": None,
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
        "source_reference": "National Institute of Plant Health Management (NIPHM)",
    },
    {
        "rule_code": "RULE-IRRIG-01",
        "title": "Irrigation scheduling for limited water availability",
        "keywords": ["dry", "drought", "moisture stress", "cracks", "no rain", "scarcity"],
        "crop_name": None,
        "growth_stage": ["Flowering", "Fruiting / Pod filling"],
        "soil_type": ["Sandy", "Loamy", "Red"],
        "irrigation_condition": ["Limited irrigation", "Rainfed only", "No irrigation available"],
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
        "source_reference": "Water Management Directorate, ICAR",
    },
    {
        "rule_code": "RULE-HEALTHY-01",
        "title": "No problem indicators reported — continue routine crop care",
        "keywords": ["nothing", "no issue", "healthy", "normal", "fine", "good", "none"],
        "crop_name": None,
        "growth_stage": None,
        "soil_type": None,
        "irrigation_condition": None,
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
        "source_reference": "Agricultural Extension Standard Practices",
    },
    {
        "rule_code": "RULE-FUNGAL-01",
        "title": "Possible fungal or disease symptom — confirm before spraying",
        "keywords": ["powder", "rust", "blight", "rot", "mould", "fungus", "brown patch", "black spot"],
        "crop_name": None,
        "growth_stage": None,
        "soil_type": None,
        "irrigation_condition": None,
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
        "source_reference": "Indian Phytopathological Society Guidelines",
    },
]


class CropAdvisoryEngine:
    @staticmethod
    def evaluate(crop_name, growth_stage, soil_type, symptoms, irrigation, weather=None):
        """
        Evaluate submitted farmer crop conditions against active advisory rules.
        Transparent, explainable, rule-based reasoning.
        """
        symptoms_clean = (symptoms or "").strip().lower()
        crop_clean = (crop_name or "").strip()
        stage_clean = (growth_stage or "").strip()
        soil_clean = (soil_type or "").strip()
        irrig_clean = (irrigation or "").strip()

        # Load active rules from database, falling back to built-ins if DB is empty
        try:
            rules = AdvisoryRepository.find_all_active_rules()
        except Exception:
            rules = []

        if not rules:
            rules = FALLBACK_RULES

        best_rule = None
        best_score = 0
        best_matched = []

        for rule in rules:
            score = 0
            matched = []
            keywords = rule.get("keywords") or []

            # Check keyword match in symptoms
            if any(k.lower() in symptoms_clean for k in keywords):
                score += 2
                matched.append("Reported symptoms contain an indicator for this rule")

            # Check crop match
            rule_crops = rule.get("crop_name")
            if rule_crops:
                if isinstance(rule_crops, list) and crop_clean in rule_crops:
                    score += 1
                    matched.append(f"Crop: {crop_clean}")
                elif isinstance(rule_crops, str) and crop_clean.lower() in rule_crops.lower():
                    score += 1
                    matched.append(f"Crop: {crop_clean}")

            # Check growth stage match
            rule_stages = rule.get("growth_stage")
            if rule_stages:
                if isinstance(rule_stages, list) and stage_clean in rule_stages:
                    score += 1
                    matched.append(f"Growth stage: {stage_clean}")
                elif isinstance(rule_stages, str) and stage_clean.lower() in rule_stages.lower():
                    score += 1
                    matched.append(f"Growth stage: {stage_clean}")

            # Check soil type match
            rule_soils = rule.get("soil_type")
            if rule_soils:
                if isinstance(rule_soils, list) and soil_clean in rule_soils:
                    score += 1
                    matched.append(f"Soil type: {soil_clean}")
                elif isinstance(rule_soils, str) and soil_clean.lower() in rule_soils.lower():
                    score += 1
                    matched.append(f"Soil type: {soil_clean}")

            # Check irrigation condition match
            rule_irrig = rule.get("irrigation_condition")
            if rule_irrig:
                if isinstance(rule_irrig, list) and irrig_clean in rule_irrig:
                    score += 1
                    matched.append(f"Irrigation: {irrig_clean}")
                elif isinstance(rule_irrig, str) and irrig_clean.lower() in rule_irrig.lower():
                    score += 1
                    matched.append(f"Irrigation: {irrig_clean}")

            if score > best_score:
                best_score = score
                best_rule = rule
                best_matched = matched

        if not best_rule or best_score < 2:
            return {
                "no_match": True,
                "title": "No matching advisory rule",
                "recommendation": None,
                "summary": NO_MATCH_TEXT,
                "rule_name": None,
                "explanation": "No configured rule in the knowledge base matched the combination of conditions provided.",
                "matched_conditions": [],
                "next_steps": [
                    "Take clear photographs of the standing crop and affected leaves.",
                    "Visit your nearest Krishi Vigyan Kendra (KVK) or contact the local block agriculture officer.",
                    "Avoid applying unverified chemical cocktails before getting a professional diagnosis."
                ],
                "caution": DEFAULT_CAUTION,
                "severity": "Seek extension officer advice",
            }

        rule_code = best_rule.get("rule_code") or best_rule.get("name") or "RULE"
        return {
            "no_match": False,
            "title": best_rule.get("title"),
            "recommendation": best_rule.get("recommendation"),
            "summary": None,
            "rule_name": rule_code,
            "explanation": (
                f"Rule {rule_code} matched your reported inputs with a score of {best_score}. "
                "Higher scores indicate that more of the rule's specific agronomic conditions were satisfied."
            ),
            "matched_conditions": best_matched,
            "next_steps": best_rule.get("next_steps") or [],
            "caution": best_rule.get("caution_message") or DEFAULT_CAUTION,
            "severity": best_rule.get("severity") or "Monitor closely",
        }
