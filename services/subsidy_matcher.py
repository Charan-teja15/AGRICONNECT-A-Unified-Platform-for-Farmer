from repositories.scheme_repository import SchemeRepository

FALLBACK_SCHEMES = [
    {
        "id": 1,
        "name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "description": "Central income-support scheme for landholding farmer families, subject to the exclusion criteria published by the Government of India.",
        "level": "Central",
        "category": "Income support",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": [
            "Aadhaar card",
            "Land ownership records (RoR / Khatauni)",
            "Bank account details with IFSC",
            "Mobile number"
        ],
        "conditions": [
            "Family definition and exclusion criteria must be checked on the official portal",
            "Land records must be verified by the local revenue authority",
            "Bank account must be Aadhaar-seeded for DBT transfer"
        ],
        "instructions": "Apply through the PM-KISAN portal, the nearest Common Service Centre, or the local agriculture/revenue office. Keep the registration number for e-KYC and beneficiary status checks.",
        "official_url": "https://pmkisan.gov.in/",
    },
    {
        "id": 2,
        "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "description": "Crop insurance cover against notified natural risks for notified crops in notified areas, for both loanee and non-loanee farmers.",
        "level": "Central",
        "category": "Crop insurance",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "Paddy,Wheat,Cotton,Sugarcane,Groundnut,Soybean,Maize,Onion,Tomato,Chilli",
        "requires_field_verification": 1,
        "documents": [
            "Land records / tenancy certificate",
            "Sowing certificate",
            "Aadhaar card",
            "Bank passbook",
            "Crop details (survey number, area sown)"
        ],
        "conditions": [
            "The crop and the area must be notified for the season",
            "Enrolment must happen before the cut-off date announced for the season",
            "Loss must be intimated within the prescribed time limit"
        ],
        "instructions": "Enrol through the PMFBY portal, your bank, a Common Service Centre, or an insurance intermediary before the seasonal cut-off date.",
        "official_url": "https://pmfby.gov.in/",
    },
    {
        "id": 3,
        "name": "Soil Health Card Scheme",
        "description": "Free soil testing and a soil health card with nutrient status and crop-wise fertiliser recommendations for your field.",
        "level": "Central",
        "category": "Soil health",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 0,
        "documents": [
            "Land records or farmer identity proof",
            "Field survey number"
        ],
        "conditions": [
            "Soil samples must be collected following the prescribed procedure",
            "Card validity and re-testing interval follow state guidelines"
        ],
        "instructions": "Contact your nearest soil testing laboratory, Krishi Vigyan Kendra, or agriculture department office to have a sample collected and tested.",
        "official_url": "https://soilhealth.dac.gov.in/",
    },
    {
        "id": 4,
        "name": "Kisan Credit Card (KCC)",
        "description": "Short-term crop loan facility with a revolving credit limit for cultivation expenses, extended at concessional interest.",
        "level": "Central",
        "category": "Credit",
        "states": "",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": [
            "Identity and address proof",
            "Land documents",
            "Crop pattern / cropping details",
            "Passport-size photographs",
            "Bank account details"
        ],
        "conditions": [
            "Credit assessment and documentation are done by the lending bank",
            "Interest subvention depends on timely repayment as per scheme rules"
        ],
        "instructions": "Apply at your nearest bank branch, regional rural bank, or cooperative society with land and identity documents.",
        "official_url": "https://www.myscheme.gov.in/",
    },
    {
        "id": 5,
        "name": "Rythu Bandhu / State Investment Support (illustrative state scheme)",
        "description": "Illustrative state-level investment support scheme for landholding farmers. Configuration, amount and eligibility differ by state — this record is a demonstration entry for the project database.",
        "level": "State",
        "category": "Investment support",
        "states": "Telangana",
        "min_land": 0,
        "max_land": 99999,
        "crops": "",
        "requires_field_verification": 1,
        "documents": [
            "Passbook with land details",
            "Aadhaar card",
            "Bank account details"
        ],
        "conditions": [
            "Scheme is available only in the configured state",
            "Land should not fall under the ineligible categories notified by the state",
            "Benefit amount and schedule are decided by the state government"
        ],
        "instructions": "Apply through the state agriculture department portal or the nearest revenue/agriculture office during the notified window.",
        "official_url": "",
    },
    {
        "id": 6,
        "name": "Micro Irrigation / Drip & Sprinkler Support (illustrative)",
        "description": "Illustrative support for micro-irrigation systems that improve water-use efficiency. This record demonstrates a scheme with a land-size condition.",
        "level": "Central",
        "category": "Irrigation",
        "states": "",
        "min_land": 0.5,
        "max_land": 99999,
        "crops": "Sugarcane,Banana,Mango,Tomato,Chilli,Cotton,Onion",
        "requires_field_verification": 1,
        "documents": [
            "Land records",
            "Aadhaar card",
            "Bank passbook",
            "Quotation from an empanelled supplier",
            "Field layout / crop plan"
        ],
        "conditions": [
            "Minimum land holding applies as configured in the database",
            "Installation must be carried out by an empanelled supplier",
            "Subsidy is released after field verification by the department"
        ],
        "instructions": "Apply through the state horticulture/agriculture department or the national micro-irrigation portal, then complete installation through an empanelled vendor.",
        "official_url": "https://www.myscheme.gov.in/",
    },
]


class SubsidyMatcherService:
    @staticmethod
    def match(state=None, district=None, land_size=None, crop_type=None):
        """
        Evaluate farmer profile parameters against active government schemes.
        Returns sorted list of schemes with match classifications and explanations.
        """
        state_clean = (state or "").strip()
        district_clean = (district or "").strip()
        crop_clean = (crop_type or "").strip()

        land = None
        if land_size is not None and str(land_size).strip() != "":
            try:
                land = float(land_size)
            except (ValueError, TypeError):
                land = None

        try:
            schemes = SchemeRepository.find_all_active()
        except Exception:
            schemes = []

        if not schemes:
            schemes = FALLBACK_SCHEMES

        results = []

        for row in schemes:
            why = []
            verify = []
            score = 0
            possible = 3

            scheme_states = [
                s.strip()
                for s in (row.get("states") or "").split(",")
                if s.strip()
            ]

            if not scheme_states:
                why.append("Applicable across India (no state restriction configured)")
                score += 1
            elif state_clean and state_clean in scheme_states:
                why.append(f"Configured for your state ({state_clean})")
                score += 1
            else:
                verify.append(
                    f"Scheme is configured for: {', '.join(scheme_states) if scheme_states else 'other states'}"
                )

            min_land = float(row.get("min_land", 0) or 0)
            max_land = float(row.get("max_land", 99999) or 99999)

            if land is not None and min_land <= land <= max_land:
                why.append(f"Land size ({land:g} acres) is within the configured range")
                score += 1
            elif land is None:
                verify.append("Add your land size to check the land-based condition")
            else:
                verify.append(f"Land condition applies (configured range: {min_land:g}–{max_land:g} acres)")

            scheme_crops = [
                c.strip()
                for c in (row.get("crops") or "").split(",")
                if c.strip()
            ]

            if crop_clean and scheme_crops:
                if crop_clean in scheme_crops:
                    why.append(f"Your crop ({crop_clean}) is covered by this scheme")
                    score += 1
                    possible += 1
                else:
                    verify.append(f"Crop coverage is limited to: {', '.join(scheme_crops)}")
            elif scheme_crops:
                verify.append(f"Crop coverage is limited to: {', '.join(scheme_crops)}")
            else:
                why.append("No crop restriction configured")
                score += 1
                possible += 1

            if row.get("requires_field_verification"):
                verify.append("Official field verification is required before approval")

            if not why:
                continue

            ratio = score / max(possible, 1)
            if row.get("requires_field_verification") and ratio < 0.99:
                status = "verification_required" if ratio >= 0.6 else "check_conditions"
            else:
                status = "potential_match" if ratio >= 0.75 else "check_conditions"

            docs = row.get("documents") or []
            if isinstance(docs, str):
                import json
                try:
                    docs = json.loads(docs)
                except Exception:
                    docs = []

            results.append({
                "id": row.get("id"),
                "name": row.get("name"),
                "description": row.get("description"),
                "level": row.get("level", "Central"),
                "category": row.get("category", "General"),
                "geo_applicability": ", ".join(scheme_states) if scheme_states else "All India (as configured)",
                "eligibility_status": status,
                "eligibility_note": (
                    "Your profile broadly matches the basic conditions stored for this scheme. "
                    "Confirm the remaining conditions with the implementing department."
                    if status == "potential_match"
                    else "Some conditions could not be confirmed from your profile. Review the listed conditions before applying."
                ),
                "match_score": int(round(min(ratio, 1.0) * 100)),
                "why_matched": why,
                "conditions_to_verify": verify,
                "documents_required": docs,
                "application_instructions": row.get("instructions", ""),
                "official_url": row.get("official_url") or "",
            })

        results.sort(key=lambda s: (-s["match_score"], s["name"]))
        return results
