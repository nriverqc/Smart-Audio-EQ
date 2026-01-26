import sqlite3
import os

DB_NAME = "backend/licenses.db"

if not os.path.exists(DB_NAME):
    print("Database file not found at", DB_NAME)
else:
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM licenses")
            rows = cursor.fetchall()
            if not rows:
                print("No licenses found.")
            else:
                print("Licenses found:")
                for row in rows:
                    print(row)
    except Exception as e:
        print("Error reading DB:", e)
