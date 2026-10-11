from datetime import datetime
from database import query_db, execute_db

class WishlistRepository:
    @staticmethod
    def toggle(buyer_id, listing_id):
        existing = query_db(
            "SELECT id FROM wishlist WHERE buyer_id = ? AND listing_id = ?",
            (buyer_id, listing_id),
            one=True
        )
        if existing:
            execute_db("DELETE FROM wishlist WHERE buyer_id = ? AND listing_id = ?", (buyer_id, listing_id))
            return False  # Removed
        else:
            now = datetime.now().strftime("%d %b %Y %H:%M")
            execute_db(
                "INSERT INTO wishlist (buyer_id, listing_id, created_at) VALUES (?, ?, ?)",
                (buyer_id, listing_id, now)
            )
            return True  # Added

    @staticmethod
    def is_in_wishlist(buyer_id, listing_id):
        if not buyer_id:
            return False
        row = query_db(
            "SELECT id FROM wishlist WHERE buyer_id = ? AND listing_id = ?",
            (buyer_id, listing_id),
            one=True
        )
        return bool(row)

    @staticmethod
    def find_by_buyer(buyer_id):
        return query_db(
            """
            SELECT w.id as wishlist_id, w.created_at as saved_at, l.*, u.name AS farmer_name
            FROM wishlist w
            JOIN listings l ON l.id = w.listing_id
            JOIN users u ON u.id = l.user_id
            WHERE w.buyer_id = ?
            ORDER BY w.id DESC
            """,
            (buyer_id,)
        )

    @staticmethod
    def count_by_buyer(buyer_id):
        row = query_db("SELECT COUNT(*) as cnt FROM wishlist WHERE buyer_id = ?", (buyer_id,), one=True)
        return row["cnt"] if row else 0
