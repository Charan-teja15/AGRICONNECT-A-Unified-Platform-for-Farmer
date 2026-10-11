import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

# Optional Supabase client import (graceful fallback if package not installed yet)
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    create_client = None
    Client = Any
    SUPABASE_AVAILABLE = False


DEFAULT_SCHEMES = [
    {
        "id": "scheme-pmkisan",
        "scheme_name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "description": "Central income support of Rs 6,000 per year in three installments for landholding farmer families.",
        "state": "All-India",
        "benefits": "₹6,000 per year directly to bank account in 3 installments",
        "eligibility_rules": {
            "min_land_acres": 0,
            "max_land_acres": 99999,
            "crop_eligibility": []
        },
        "required_documents": ["Aadhaar card", "Land ownership documents", "Bank account details"],
        "application_steps": "Apply online via PM-KISAN portal or through Common Service Centres (CSC).",
        "official_url": "https://pmkisan.gov.in/",
        "source_url": "https://myscheme.gov.in/",
        "last_verified_at": "10 Oct 2026",
        "active": True
    },
    {
        "id": "scheme-pmfby",
        "scheme_name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "description": "Comprehensive crop insurance scheme providing financial support to farmers suffering crop loss or damage.",
        "state": "All-India",
        "benefits": "Crop loss compensation against non-preventable natural risks",
        "eligibility_rules": {
            "min_land_acres": 0,
            "max_land_acres": 99999,
            "crop_eligibility": ["Paddy", "Wheat", "Maize", "Cotton", "Groundnut"]
        },
        "required_documents": ["Land possession certificate", "Sowing certificate", "Bank passbook"],
        "application_steps": "Enroll via National Crop Insurance Portal (NCIP) or through lending bank branch.",
        "official_url": "https://pmfby.gov.in/",
        "source_url": "https://myscheme.gov.in/",
        "last_verified_at": "10 Oct 2026",
        "active": True
    },
    {
        "id": "scheme-rythu-bandhu",
        "scheme_name": "Rythu Bandhu / State Investment Support (illustrative state scheme)",
        "description": "State investment support scheme for agriculture and horticulture crops.",
        "state": "Telangana",
        "benefits": "Investment grant per acre per season for purchase of inputs",
        "eligibility_rules": {
            "min_land_acres": 0,
            "max_land_acres": 99999,
            "crop_eligibility": []
        },
        "required_documents": ["Pattadar passbook", "Aadhaar card", "Bank account details"],
        "application_steps": "Apply through state agriculture department portal or local revenue office.",
        "official_url": "https://rythubandhu.telangana.gov.in/",
        "source_url": "https://agri.telangana.gov.in/",
        "last_verified_at": "10 Oct 2026",
        "active": True
    }
]


class SupabaseService:
    """
    Unified Supabase integration layer for AGRICONNECT.
    Provides data access, authentication, advisory rules matching,
    scheme evaluation, and marketplace operations.
    """

    def __init__(self):
        self.url: str = os.environ.get("SUPABASE_URL", "").strip()
        self.anon_key: str = (
            os.environ.get("SUPABASE_ANON_KEY", "") or os.environ.get("SUPABASE_KEY", "")
        ).strip()
        self.service_role_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        self.client: Optional[Client] = None
        self.admin_client: Optional[Client] = None

        if SUPABASE_AVAILABLE and self.url and self.anon_key:
            try:
                self.client = create_client(self.url, self.anon_key)
                if self.service_role_key:
                    self.admin_client = create_client(self.url, self.service_role_key)
            except Exception as e:
                print(f"[SupabaseService] Client initialization notice: {e}")

    def is_configured(self) -> bool:
        return bool(self.client is not None)

    # --------------------------------------------------------------------------
    # 1. Supabase Authentication
    # --------------------------------------------------------------------------

    def sign_up(self, email: str, password: str, metadata: Optional[Dict[str, Any]] = None):
        """Register a new farmer with Supabase Auth."""
        if not self.client:
            raise RuntimeError("Supabase client is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.")
        
        response = self.client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": metadata or {}
            }
        })
        return response

    def sign_in_with_password(self, email: str, password: str):
        """Authenticate user credentials against Supabase Auth."""
        if not self.client:
            raise RuntimeError("Supabase client is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.")
        
        response = self.client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
        return response

    def sign_out(self, access_token: Optional[str] = None):
        """Sign out user from Supabase."""
        if self.client:
            try:
                self.client.auth.sign_out()
            except Exception:
                pass

    def get_user_from_token(self, access_token: str):
        """Retrieve user profile using active JWT access token."""
        if not self.client or not access_token:
            return None
        try:
            return self.client.auth.get_user(access_token)
        except Exception:
            return None

    # --------------------------------------------------------------------------
    # 2. Profiles Management
    # --------------------------------------------------------------------------

    def get_profile(self, user_id: str):
        """Fetch user profile record from public.profiles."""
        if not self.client:
            return None
        res = self.client.table("profiles").select("*").eq("id", user_id).single().execute()
        return res.data if res else None

    def update_profile(self, user_id: str, profile_data: Dict[str, Any]):
        """Update farmer profile information."""
        if not self.client:
            return None
        res = self.client.table("profiles").update(profile_data).eq("id", user_id).execute()
        return res.data if res else None

    # --------------------------------------------------------------------------
    # 3. Marketplace Operations
    # --------------------------------------------------------------------------

    def get_marketplace_listings(
        self,
        q: Optional[str] = None,
        category: Optional[str] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        sort_by: str = "newest",
        seller_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 9
    ):
        """Fetch active crop listings with server-side filters and pagination."""
        if not self.client:
            return [], 0

        query = self.client.table("marketplace_listings").select("*, profiles(full_name, phone)", count="exact")

        if seller_id:
            query = query.eq("seller_id", seller_id)
        else:
            query = query.eq("status", "active")

        if q:
            query = query.ilike("crop_name", f"%{q.strip()}%")
        if category:
            query = query.eq("category", category.strip())
        if state:
            query = query.eq("state", state.strip())
        if district:
            query = query.eq("district", district.strip())
        if min_price is not None:
            query = query.gte("price_per_unit", min_price)
        if max_price is not None:
            query = query.lte("price_per_unit", max_price)

        if sort_by == "price_asc":
            query = query.order("price_per_unit", desc=False)
        elif sort_by == "price_desc":
            query = query.order("price_per_unit", desc=True)
        else:
            query = query.order("created_at", desc=True)

        offset = max(0, (page - 1) * per_page)
        query = query.range(offset, offset + per_page - 1)

        result = query.execute()
        data = result.data or []
        total = result.count or len(data)

        # Normalize seller name
        for item in data:
            profile = item.get("profiles") or {}
            item["farmer_name"] = profile.get("full_name") or "Farmer"
            item["contact_info"] = profile.get("phone") or ""

        return data, total

    def create_listing(self, seller_id: str, listing_data: Dict[str, Any]):
        """Publish a new crop listing enforcing seller ownership."""
        if not self.client:
            return None
        payload = {**listing_data, "seller_id": seller_id, "status": "active"}
        res = self.client.table("marketplace_listings").insert(payload).execute()
        return res.data[0] if (res and res.data) else None

    def update_listing(self, listing_id: str, seller_id: str, update_data: Dict[str, Any]):
        """Update an existing listing owned by seller_id."""
        if not self.client:
            return None
        res = self.client.table("marketplace_listings").update(update_data).match({
            "id": listing_id,
            "seller_id": seller_id
        }).execute()
        return res.data[0] if (res and res.data) else None

    def delete_listing(self, listing_id: str, seller_id: str):
        """Delete an existing listing owned by seller_id."""
        if not self.client:
            return False
        res = self.client.table("marketplace_listings").delete().match({
            "id": listing_id,
            "seller_id": seller_id
        }).execute()
        return True

    # --------------------------------------------------------------------------
    # 4. Crop Advisory Rule Engine (PostgreSQL / Supabase)
    # --------------------------------------------------------------------------

    def get_advisory_rules(self) -> List[Dict[str, Any]]:
        """Retrieve all active agronomic rules stored in Supabase."""
        if not self.client:
            return []
        res = self.client.table("advisory_rules").select("*").eq("active", True).execute()
        return res.data or []

    def evaluate_advisory(
        self,
        crop_name: str,
        growth_stage: str,
        symptoms: str,
        soil_type: Optional[str] = None,
        watering_condition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate farmer inputs against Supabase advisory rules.
        Transparent matching: checks crop, stage, symptoms, soil, and watering.
        """
        rules = self.get_advisory_rules()

        symptoms_lower = (symptoms or "").lower().strip()
        crop_lower = (crop_name or "").lower().strip()
        stage_lower = (growth_stage or "").lower().strip()
        soil_lower = (soil_type or "").lower().strip() if soil_type else ""
        water_lower = (watering_condition or "").lower().strip() if watering_condition else ""

        best_rule = None
        best_score = 0
        matched_aspects = []

        for rule in rules:
            score = 0
            aspects = []

            # 1. Symptom category match (highest weight)
            cat = (rule.get("symptom_category") or "").lower()
            if cat and (cat in symptoms_lower or any(word in symptoms_lower for word in cat.split())):
                score += 3
                aspects.append(f"Symptom Category: {rule.get('symptom_category')}")

            # 2. Crop match
            rcrop = (rule.get("crop_name") or "").lower()
            if rcrop and (rcrop in crop_lower or crop_lower in rcrop):
                score += 2
                aspects.append(f"Crop: {rule.get('crop_name')}")

            # 3. Growth stage match
            rstage = (rule.get("growth_stage") or "").lower()
            if rstage and (rstage in stage_lower or stage_lower in rstage):
                score += 1
                aspects.append(f"Growth Stage: {rule.get('growth_stage')}")

            # 4. Soil type match
            rsoil = (rule.get("soil_type") or "").lower()
            if rsoil and soil_lower and (rsoil in soil_lower or soil_lower in rsoil):
                score += 1
                aspects.append(f"Soil: {rule.get('soil_type')}")

            # 5. Watering conditions
            rwater = (rule.get("watering_condition") or "").lower()
            if rwater and water_lower and (rwater in water_lower or water_lower in rwater):
                score += 1
                aspects.append(f"Watering: {rule.get('watering_condition')}")

            if score > best_score:
                best_score = score
                best_rule = rule
                matched_aspects = aspects

        # Notice: Clear general guidance disclaimer, no fake AI diagnosis claims
        disclaimer = (
            "Notice: This output is general informational agronomic guidance derived from "
            "standard agricultural extension guidelines, not an individualized laboratory diagnosis. "
            "Field conditions vary. Always consult your local Krishi Vigyan Kendra (KVK) or Block "
            "Agriculture Officer before applying any synthetic chemical."
        )

        if not best_rule or best_score < 2:
            return {
                "matched": False,
                "title": "No Direct Rule Match Found",
                "possible_cause": "No specific extension rule in the knowledge base directly matched your combination of symptoms.",
                "recommended_action": "Take clear photos of the affected plants and visit your nearest Krishi Vigyan Kendra (KVK) or block agriculture extension officer for physical leaf inspection.",
                "prevention_tips": "Avoid mixing multiple unauthorized pesticide sprays; ensure proper drainage around root zones.",
                "matched_conditions": [],
                "source_url": "https://icar.org.in/",
                "last_verified_at": datetime.now().strftime("%d %b %Y"),
                "disclaimer": disclaimer
            }

        return {
            "matched": True,
            "title": f"Guidance for {best_rule.get('crop_name', crop_name)} ({best_rule.get('symptom_category')})",
            "possible_cause": best_rule.get("possible_cause"),
            "recommended_action": best_rule.get("recommended_action"),
            "prevention_tips": best_rule.get("prevention_tips"),
            "matched_conditions": matched_aspects,
            "source_url": best_rule.get("source_url") or "https://icar.org.in/",
            "last_verified_at": str(best_rule.get("last_verified_at") or CURRENT_DATE),
            "disclaimer": disclaimer
        }

    # --------------------------------------------------------------------------
    # 5. Government Scheme Discovery & Matching
    # --------------------------------------------------------------------------

    def get_government_schemes(self) -> List[Dict[str, Any]]:
        """Fetch active verified government schemes from Supabase, or default verified list if unconfigured."""
        if not self.client:
            return DEFAULT_SCHEMES
        try:
            res = self.client.table("government_schemes").select("*").eq("active", True).execute()
            return res.data or DEFAULT_SCHEMES
        except Exception:
            return DEFAULT_SCHEMES

    def match_government_schemes(
        self,
        state: Optional[str] = None,
        district: Optional[str] = None,
        land_size_acres: Optional[float] = None,
        crop_type: Optional[str] = None,
        farmer_category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluate farmer profile against structured eligibility_rules in Supabase.
        Categorizes into Potential Match, Verification Required, or Check Conditions.
        """
        schemes = self.get_government_schemes()
        results = []

        state_clean = (state or "").strip().lower()
        crop_clean = (crop_type or "").strip().lower()

        for scheme in schemes:
            rules = scheme.get("eligibility_rules") or {}
            why_matched = []
            conditions_to_verify = []
            score = 0
            possible = 3

            # 1. Geographic check
            scheme_state = (scheme.get("state") or "All-India").strip()
            if scheme_state.lower() in ("all-india", "all india", ""):
                why_matched.append("Pan-India central scheme applicable to your state.")
                score += 1
            elif state_clean and (scheme_state.lower() == state_clean or scheme_state.lower() in state_clean):
                why_matched.append(f"Specifically configured for your state ({scheme_state}).")
                score += 1
            else:
                conditions_to_verify.append(f"Scheme is designated for state: {scheme_state}.")

            # 2. Landholding bounds
            min_land = float(rules.get("min_land_acres", 0))
            max_land = float(rules.get("max_land_acres", 99999))
            if land_size_acres is not None:
                if min_land <= land_size_acres <= max_land:
                    why_matched.append(f"Your land size ({land_size_acres} acres) is within the eligible range ({min_land} - {max_land} acres).")
                    score += 1
                else:
                    conditions_to_verify.append(f"Requires landholding between {min_land} and {max_land} acres.")
            else:
                conditions_to_verify.append("Verify landholding size as per revenue records.")

            # 3. Crop suitability
            eligible_crops = [c.lower() for c in rules.get("crop_eligibility", [])]
            if eligible_crops:
                possible += 1
                if crop_clean and any(crop_clean in ec or ec in crop_clean for ec in eligible_crops):
                    why_matched.append(f"Your crop ({crop_type}) is notified under this scheme.")
                    score += 1
                elif crop_clean:
                    conditions_to_verify.append(f"Notified crops are: {', '.join(rules.get('crop_eligibility', []))}.")
            else:
                why_matched.append("Universal crop coverage (no specific crop restriction).")
                score += 1

            if not why_matched:
                continue

            ratio = score / max(possible, 1)
            status = "Potential Match" if ratio >= 0.75 else ("Additional Verification Required" if ratio >= 0.5 else "Check Conditions")

            results.append({
                "id": scheme.get("id"),
                "scheme_name": scheme.get("scheme_name"),
                "description": scheme.get("description"),
                "state": scheme_state,
                "benefits": scheme.get("benefits"),
                "status": status,
                "match_score": int(round(min(ratio, 1.0) * 100)),
                "why_matched": why_matched,
                "conditions_to_verify": conditions_to_verify,
                "required_documents": scheme.get("required_documents") or [],
                "application_steps": scheme.get("application_steps") or "Apply via official department portal.",
                "official_url": scheme.get("official_url") or "",
                "source_url": scheme.get("source_url") or "",
                "last_verified_at": str(scheme.get("last_verified_at") or CURRENT_DATE),
                "disclaimer": "Preliminary informational match only — not a formal guarantee of approval or entitlement."
            })

        results.sort(key=lambda s: (-s["match_score"], s["scheme_name"]))
        return results


# Global singleton instance
supabase_service = SupabaseService()
