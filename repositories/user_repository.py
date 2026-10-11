from datetime import datetime
from database import query_db, execute_db

class UserRepository:
    @staticmethod
    def find_by_id(user_id):
        if not user_id:
            return None
        return query_db("SELECT * FROM users WHERE id = ?", (user_id,), one=True)

    @staticmethod
    def find_by_email(email):
        if not email:
            return None
        return query_db("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),), one=True)

    @staticmethod
    def find_by_email_or_name(identifier):
        if not identifier:
            return None
        clean_id = identifier.strip()
        return query_db(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)",
            (clean_id, clean_id),
            one=True
        )

    @staticmethod
    def email_exists(email, exclude_id=None):
        if not email:
            return False
        if exclude_id:
            row = query_db(
                "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?",
                (email.strip(), exclude_id),
                one=True
            )
        else:
            row = query_db(
                "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)",
                (email.strip(),),
                one=True
            )
        return row is not None

    @staticmethod
    def create(
        name,
        email,
        password_hash,
        phone=None,
        state=None,
        district=None,
        land_size=None,
        preferred_crop=None,
        role="farmer",
        land_unit="acres",
        buyer_type=None,
        organisation_name=None,
        crops_of_interest=None
    ):
        now = datetime.now().strftime("%d %b %Y")
        clean_role = "buyer" if str(role).strip().lower() == "buyer" else "farmer"
        user_id = execute_db(
            """
            INSERT INTO users (
                name, email, phone, password_hash, role, state, district,
                land_size, land_unit, preferred_crop,
                buyer_type, organisation_name, crops_of_interest,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name.strip(),
                email.strip(),
                phone.strip() if phone else None,
                password_hash,
                clean_role,
                state.strip() if state else None,
                district.strip() if district else None,
                float(land_size) if land_size is not None and str(land_size).strip() != "" else None,
                land_unit.strip() if land_unit else "acres",
                preferred_crop.strip() if preferred_crop else None,
                buyer_type.strip() if buyer_type else None,
                organisation_name.strip() if organisation_name else None,
                crops_of_interest.strip() if crops_of_interest else None,
                now,
                now
            )
        )
        return user_id

    @staticmethod
    def update(
        user_id,
        name,
        email,
        phone=None,
        state=None,
        district=None,
        land_size=None,
        preferred_crop=None,
        land_unit="acres",
        buyer_type=None,
        organisation_name=None,
        crops_of_interest=None
    ):
        now = datetime.now().strftime("%d %b %Y")
        execute_db(
            """
            UPDATE users
            SET name = ?, email = ?, phone = ?, state = ?, district = ?,
                land_size = ?, land_unit = ?, preferred_crop = ?,
                buyer_type = ?, organisation_name = ?, crops_of_interest = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                name.strip(),
                email.strip(),
                phone.strip() if phone else None,
                state.strip() if state else None,
                district.strip() if district else None,
                float(land_size) if land_size is not None and str(land_size).strip() != "" else None,
                land_unit.strip() if land_unit else "acres",
                preferred_crop.strip() if preferred_crop else None,
                buyer_type.strip() if buyer_type else None,
                organisation_name.strip() if organisation_name else None,
                crops_of_interest.strip() if crops_of_interest else None,
                now,
                user_id
            )
        )

    @staticmethod
    def count_all():
        row = query_db("SELECT COUNT(*) as count FROM users", one=True)
        return row["count"] if row else 0
