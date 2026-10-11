import json
from datetime import datetime
from database import query_db, execute_db

class AdvisoryRepository:
    @staticmethod
    def find_all_active_rules():
        rows = query_db("SELECT * FROM advisory_rules WHERE is_active = 1 ORDER BY id ASC")
        for r in rows:
            if isinstance(r.get("keywords"), str):
                r["keywords"] = [k.strip() for k in r["keywords"].split(",") if k.strip()]
            if isinstance(r.get("recommendation"), str) and r["recommendation"].startswith("["):
                try:
                    r["recommendation"] = json.loads(r["recommendation"])
                except Exception:
                    pass
            if isinstance(r.get("next_steps"), str) and r["next_steps"].startswith("["):
                try:
                    r["next_steps"] = json.loads(r["next_steps"])
                except Exception:
                    pass
            if r.get("growth_stage"):
                r["growth_stage"] = [s.strip() for s in r["growth_stage"].split(",") if s.strip()]
            if r.get("soil_type"):
                r["soil_type"] = [s.strip() for s in r["soil_type"].split(",") if s.strip()]
            if r.get("irrigation_condition"):
                r["irrigation_condition"] = [s.strip() for s in r["irrigation_condition"].split(",") if s.strip()]
            if r.get("crop_name"):
                r["crop_name"] = [c.strip() for c in r["crop_name"].split(",") if c.strip()]
        return rows

    @staticmethod
    def save_query(user_id, crop_name, growth_stage, soil_type, symptoms, irrigation, weather, advisory_result):
        now = datetime.now().strftime("%d %b %Y, %I:%M %p")
        no_match = 1 if advisory_result.get("no_match") else 0
        
        rec = advisory_result.get("recommendation")
        if isinstance(rec, list):
            rec_str = json.dumps(rec)
        else:
            rec_str = str(rec or "")

        matched_str = json.dumps(advisory_result.get("matched_conditions") or [])
        steps_str = json.dumps(advisory_result.get("next_steps") or [])

        query_id = execute_db(
            """
            INSERT INTO advisory_queries (
                user_id, crop_name, growth_stage, soil_type, symptoms, irrigation, weather,
                created_at, no_match, result_title, recommendation, summary, rule_name,
                explanation, matched_conditions, next_steps, caution, severity
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                crop_name,
                growth_stage,
                soil_type,
                symptoms,
                irrigation,
                weather,
                now,
                no_match,
                advisory_result.get("title"),
                rec_str,
                advisory_result.get("summary"),
                advisory_result.get("rule_name"),
                advisory_result.get("explanation"),
                matched_str,
                steps_str,
                advisory_result.get("caution"),
                advisory_result.get("severity")
            )
        )
        return query_id

    @staticmethod
    def find_query_by_id(query_id):
        row = query_db("SELECT * FROM advisory_queries WHERE id = ?", (query_id,), one=True)
        if not row:
            return None
        
        # Parse stored JSON fields
        if row.get("recommendation") and row["recommendation"].startswith("["):
            try:
                row["recommendation"] = json.loads(row["recommendation"])
            except Exception:
                pass
        if row.get("matched_conditions"):
            try:
                row["matched_conditions"] = json.loads(row["matched_conditions"])
            except Exception:
                row["matched_conditions"] = []
        else:
            row["matched_conditions"] = []

        if row.get("next_steps"):
            try:
                row["next_steps"] = json.loads(row["next_steps"])
            except Exception:
                row["next_steps"] = []
        else:
            row["next_steps"] = []

        return row

    @staticmethod
    def find_recent_by_user(user_id, limit=5):
        return query_db(
            "SELECT * FROM advisory_queries WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit)
        )

    @staticmethod
    def count_by_user(user_id):
        row = query_db("SELECT COUNT(*) as total FROM advisory_queries WHERE user_id = ?", (user_id,), one=True)
        return row["total"] if row else 0
