import json
from datetime import datetime
from database import query_db, execute_db

class SchemeRepository:
    @staticmethod
    def find_all_active():
        rows = query_db("SELECT * FROM schemes WHERE is_active = 1 ORDER BY id ASC")
        for r in rows:
            if isinstance(r.get("documents"), str):
                try:
                    r["documents"] = json.loads(r["documents"])
                except Exception:
                    r["documents"] = []
            if isinstance(r.get("conditions"), str):
                try:
                    r["conditions"] = json.loads(r["conditions"])
                except Exception:
                    r["conditions"] = []
        return rows

    @staticmethod
    def count_active():
        row = query_db("SELECT COUNT(*) as total FROM schemes WHERE is_active = 1", one=True)
        return row["total"] if row else 0

    @staticmethod
    def save_match_history(user_id, submitted_profile, match_count=0):
        now = datetime.now().strftime("%d %b %Y, %I:%M %p")
        execute_db(
            """
            INSERT INTO scheme_match_history (user_id, submitted_profile, match_count, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, json.dumps(submitted_profile), match_count, now)
        )

    @staticmethod
    def find_recent_history_by_user(user_id, limit=5):
        rows = query_db(
            "SELECT * FROM scheme_match_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit)
        )
        for r in rows:
            if isinstance(r.get("submitted_profile"), str):
                try:
                    r["submitted_profile"] = json.loads(r["submitted_profile"])
                except Exception:
                    r["submitted_profile"] = {}
        return rows
