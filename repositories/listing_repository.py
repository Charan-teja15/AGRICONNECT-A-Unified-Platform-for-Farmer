from datetime import datetime
from database import query_db, execute_db

class ListingRepository:
    @staticmethod
    def find_by_id(listing_id):
        if not listing_id:
            return None
        return query_db(
            """
            SELECT l.*, u.name AS farmer_name
            FROM listings l
            JOIN users u ON u.id = l.user_id
            WHERE l.id = ?
            """,
            (listing_id,),
            one=True
        )

    @staticmethod
    def find_all(q=None, state=None, district=None, min_price=None, max_price=None, sort="newest", user_id=None, page=1, per_page=9):
        where_clauses = []
        args = []

        if q and str(q).strip():
            where_clauses.append("(LOWER(l.crop_name) LIKE ? OR LOWER(l.description) LIKE ?)")
            pattern = f"%{str(q).strip().lower()}%"
            args.extend([pattern, pattern])

        if state and str(state).strip():
            where_clauses.append("l.state = ?")
            args.append(str(state).strip())

        if district and str(district).strip():
            where_clauses.append("l.district = ?")
            args.append(str(district).strip())

        if min_price is not None and str(min_price).strip() != "":
            try:
                where_clauses.append("l.expected_price >= ?")
                args.append(float(min_price))
            except ValueError:
                pass

        if max_price is not None and str(max_price).strip() != "":
            try:
                where_clauses.append("l.expected_price <= ?")
                args.append(float(max_price))
            except ValueError:
                pass

        if user_id is not None:
            where_clauses.append("l.user_id = ?")
            args.append(user_id)

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        order_by = "l.id DESC"
        if sort == "price_asc":
            order_by = "l.expected_price ASC, l.id DESC"
        elif sort == "price_desc":
            order_by = "l.expected_price DESC, l.id DESC"

        # Count total matches
        count_sql = f"SELECT COUNT(*) as total FROM listings l {where_sql}"
        count_row = query_db(count_sql, args, one=True)
        total = count_row["total"] if count_row else 0

        # Query paginated rows
        offset = max(0, (page - 1) * per_page)
        items_sql = f"""
            SELECT l.*, u.name AS farmer_name
            FROM listings l
            JOIN users u ON u.id = l.user_id
            {where_sql}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
        """
        items = query_db(items_sql, args + [per_page, offset])

        return items, total

    @staticmethod
    def find_featured(limit=3):
        return query_db(
            """
            SELECT l.*, u.name AS farmer_name
            FROM listings l
            JOIN users u ON u.id = l.user_id
            WHERE l.status = 'available'
            ORDER BY l.id DESC
            LIMIT ?
            """,
            (limit,)
        )

    @staticmethod
    def find_by_user(user_id, limit=None):
        sql = """
            SELECT l.*, u.name AS farmer_name
            FROM listings l
            JOIN users u ON u.id = l.user_id
            WHERE l.user_id = ?
            ORDER BY l.id DESC
        """
        if limit:
            sql += f" LIMIT {int(limit)}"
        return query_db(sql, (user_id,))

    @staticmethod
    def count_active_by_user(user_id):
        row = query_db(
            "SELECT COUNT(*) as total FROM listings WHERE user_id = ? AND status = 'available'",
            (user_id,),
            one=True
        )
        return row["total"] if row else 0

    @staticmethod
    def count_available():
        row = query_db("SELECT COUNT(*) as total FROM listings WHERE status = 'available'", one=True)
        return row["total"] if row else 0

    @staticmethod
    def count_distinct_available_crops():
        row = query_db(
            "SELECT COUNT(DISTINCT crop_name) as total FROM listings WHERE status = 'available'",
            one=True
        )
        return row["total"] if row else 0

    @staticmethod
    def create(user_id, crop_name, quantity, unit, expected_price=None, state=None, district=None, availability_date=None, description=None, contact_info=None):
        now = datetime.now().strftime("%d %b %Y")
        listing_id = execute_db(
            """
            INSERT INTO listings (user_id, crop_name, quantity, unit, expected_price, state, district, availability_date, description, contact_info, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)
            """,
            (
                user_id,
                crop_name.strip(),
                float(quantity),
                unit.strip() if unit else 'quintal',
                float(expected_price) if expected_price is not None and str(expected_price).strip() != "" else None,
                state.strip() if state else None,
                district.strip() if district else None,
                availability_date.strip() if availability_date else None,
                description.strip() if description else None,
                contact_info.strip() if contact_info else None,
                now,
                now
            )
        )
        return listing_id

    @staticmethod
    def update(listing_id, crop_name, quantity, unit, expected_price=None, state=None, district=None, availability_date=None, description=None, contact_info=None, status='available'):
        now = datetime.now().strftime("%d %b %Y")
        execute_db(
            """
            UPDATE listings
            SET crop_name = ?, quantity = ?, unit = ?, expected_price = ?, state = ?, district = ?, availability_date = ?, description = ?, contact_info = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                crop_name.strip(),
                float(quantity),
                unit.strip() if unit else 'quintal',
                float(expected_price) if expected_price is not None and str(expected_price).strip() != "" else None,
                state.strip() if state else None,
                district.strip() if district else None,
                availability_date.strip() if availability_date else None,
                description.strip() if description else None,
                contact_info.strip() if contact_info else None,
                status.strip() if status else 'available',
                now,
                listing_id
            )
        )

    @staticmethod
    def delete(listing_id):
        execute_db("DELETE FROM listings WHERE id = ?", (listing_id,))
