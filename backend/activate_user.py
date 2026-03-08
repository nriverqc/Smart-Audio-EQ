import sqlite3
from datetime import datetime, timedelta

DB_NAME = "licenses.db"
email = "creitus1@gmail.com"
# Asumimos que compró el mensual por el precio de 0.85, pero le daremos 1 mes + unos días de cortesía
expiration_date = datetime.now() + timedelta(days=32)

def activate_user():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Insertar o actualizar en SQLite
        cursor.execute("""
            INSERT INTO licenses (email, is_premium, payment_id, expiration_date, method)
            VALUES (?, 1, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
            is_premium=1,
            payment_id=excluded.payment_id,
            expiration_date=excluded.expiration_date,
            method=excluded.method
        """, (email, "MANUAL_LIVE_ACTIVATE", expiration_date, "Paddle_Manual"))
        
        conn.commit()
        conn.close()
        print(f"✅ Usuario {email} activado en SQLite local.")
        print(f"📅 Expiración: {expiration_date}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    activate_user()
