from datetime import datetime
from database import query_db, execute_db

class OrderRepository:
    @staticmethod
    def create(buyer_id, listing_id, quantity, offered_price, notes=None):
        now = datetime.now().strftime("%d %b %Y %H:%M")
        order_id = execute_db(
            """
            INSERT INTO orders (buyer_id, listing_id, quantity, offered_price, notes, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
            """,
            (
                buyer_id,
                listing_id,
                float(quantity),
                float(offered_price),
                notes.strip() if notes else None,
                now,
                now
            )
        )
        return order_id

    @staticmethod
    def find_by_id(order_id):
        return query_db(
            """
            SELECT o.*, l.crop_name, l.unit, l.state, l.district, l.expected_price,
                   u_buyer.name AS buyer_name, u_buyer.email AS buyer_email, u_buyer.phone AS buyer_phone,
                   u_farmer.name AS farmer_name, u_farmer.phone AS farmer_phone, u_farmer.id AS farmer_id
            FROM orders o
            JOIN listings l ON l.id = o.listing_id
            JOIN users u_buyer ON u_buyer.id = o.buyer_id
            JOIN users u_farmer ON u_farmer.id = l.user_id
            WHERE o.id = ?
            """,
            (order_id,),
            one=True
        )

    @staticmethod
    def find_by_buyer(buyer_id, limit=None):
        sql = """
            SELECT o.*, l.crop_name, l.unit, l.state, l.district, l.expected_price,
                   u_farmer.name AS farmer_name, u_farmer.phone AS farmer_phone
            FROM orders o
            JOIN listings l ON l.id = o.listing_id
            JOIN users u_farmer ON u_farmer.id = l.user_id
            WHERE o.buyer_id = ?
            ORDER BY o.id DESC
        """
        if limit:
            sql += f" LIMIT {int(limit)}"
        return query_db(sql, (buyer_id,))

    @staticmethod
    def find_by_farmer(farmer_id, limit=None):
        sql = """
            SELECT o.*, l.crop_name, l.unit, l.expected_price,
                   u_buyer.name AS buyer_name, u_buyer.email AS buyer_email, u_buyer.phone AS buyer_phone, u_buyer.organisation_name
            FROM orders o
            JOIN listings l ON l.id = o.listing_id
            JOIN users u_buyer ON u_buyer.id = o.buyer_id
            WHERE l.user_id = ?
            ORDER BY o.id DESC
        """
        if limit:
            sql += f" LIMIT {int(limit)}"
        return query_db(sql, (farmer_id,))

    @staticmethod
    def get_buyer_stats(buyer_id):
        total_row = query_db("SELECT COUNT(*) as cnt FROM orders WHERE buyer_id = ?", (buyer_id,), one=True)
        pending_row = query_db("SELECT COUNT(*) as cnt FROM orders WHERE buyer_id = ? AND status = 'pending'", (buyer_id,), one=True)
        accepted_row = query_db("SELECT COUNT(*) as cnt FROM orders WHERE buyer_id = ? AND status = 'accepted'", (buyer_id,), one=True)
        completed_row = query_db("SELECT COUNT(*) as cnt FROM orders WHERE buyer_id = ? AND status = 'completed'", (buyer_id,), one=True)
        return {
            "total": total_row["cnt"] if total_row else 0,
            "pending": pending_row["cnt"] if pending_row else 0,
            "accepted": accepted_row["cnt"] if accepted_row else 0,
            "completed": completed_row["cnt"] if completed_row else 0,
        }

    @staticmethod
    def update_status(order_id, status):
        now = datetime.now().strftime("%d %b %Y %H:%M")
        execute_db("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", (status, now, order_id))

    @staticmethod
    def cancel_by_buyer(order_id, buyer_id):
        now = datetime.now().strftime("%d %b %Y %H:%M")
        execute_db("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND buyer_id = ? AND status = 'pending'", (now, order_id, buyer_id))
