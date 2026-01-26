import os
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database setup
DB_NAME = "licenses.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                email TEXT PRIMARY KEY,
                is_premium BOOLEAN DEFAULT 0,
                payment_id TEXT,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

# Initialize DB on start
init_db()

# Initialize MercadoPago
mp_access_token = os.getenv("MP_ACCESS_TOKEN")
if not mp_access_token:
    raise RuntimeError("MP_ACCESS_TOKEN is not set")
sdk = mercadopago.SDK(mp_access_token)

@app.route("/")
def home():
    return "Smart Audio EQ API is running with SQLite"

@app.route("/create-payment", methods=["POST"])
def create_payment():
    data = request.json or {}
    email = data.get("email")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    frontend_url = os.getenv("FRONTEND_URL", "https://example.com")

    preference_data = {
        "items": [
            {
                "title": data.get("item", "Smart Audio EQ Premium"),
                "quantity": 1,
                "unit_price": float(data.get("price", 4.99)),
            }
        ],
        "payer": {
            "email": email
        },
        "external_reference": email, # KEY: We use email as external_reference to link payment
        "back_urls": {
            "success": f"{frontend_url}/success",
            "failure": f"{frontend_url}/failure",
            "pending": f"{frontend_url}/pending",
        },
        "auto_return": "approved",
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        
        # Log full response for debugging
        print("MercadoPago Response:", preference_response)

        # Check if request was successful
        if preference_response.get("status") not in [200, 201]:
             return jsonify({
                 "error": "MercadoPago API Error", 
                 "details": preference_response.get("response", "No details")
             }), 500

        payment_url = preference_response["response"].get("init_point")
        preference_id = preference_response["response"].get("id")
        
        if not payment_url:
             return jsonify({
                 "error": "No init_point in response", 
                 "details": preference_response
             }), 500
             
        return jsonify({
            "payment_url": payment_url,
            "preference_id": preference_id
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/process_payment", methods=["POST"])
def process_payment():
    try:
        data = request.json
        print("Processing Brick Payment:", data)

        payment_data = {
            "transaction_amount": float(data.get("transaction_amount")),
            "token": data.get("token"),
            "description": data.get("description", "Smart Audio EQ Premium"),
            "installments": int(data.get("installments", 1)),
            "payment_method_id": data.get("payment_method_id"),
            "payer": {
                "email": data["payer"]["email"],
                "identification": {
                    "type": data["payer"]["identification"]["type"],
                    "number": data["payer"]["identification"]["number"]
                }
            },
            "external_reference": data["payer"]["email"] # LINK TO EMAIL
        }

        if data.get("issuer_id"):
            payment_data["issuer_id"] = int(data["issuer_id"])

        payment_response = sdk.payment().create(payment_data)
        payment = payment_response["response"]
        
        print("Payment Status:", payment.get("status"))

        # If approved immediately, save to DB
        if payment.get("status") == "approved":
             email = payment.get("external_reference")
             payment_id = str(payment.get("id"))
             
             with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, payment_id)
                    VALUES (?, 1, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id
                """, (email, payment_id))
                conn.commit()

        return jsonify(payment)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/webhook/mercadopago", methods=["POST"])
def webhook():
    try:
        data = request.json
        print("Received webhook:", data)
        
        payment_id = data.get("data", {}).get("id")
        action = data.get("action")
        type = data.get("type")

        if action == "payment.created" or type == "payment":
            # Fetch payment details from MercadoPago to verify status
            payment_info = sdk.payment().get(payment_id)
            payment = payment_info.get("response", {})
            
            status = payment.get("status")
            external_reference = payment.get("external_reference") # This is the EMAIL
            
            print(f"Payment {payment_id} status: {status} for email: {external_reference}")

            if status == "approved" and external_reference:
                # Update Database
                with sqlite3.connect(DB_NAME) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO licenses (email, is_premium, payment_id)
                        VALUES (?, 1, ?)
                        ON CONFLICT(email) DO UPDATE SET
                        is_premium=1,
                        payment_id=excluded.payment_id
                    """, (external_reference, payment_id))
                    conn.commit()
                print(f"License activated for {external_reference}")

        return jsonify({"status": "received"}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/check-license", methods=["GET"])
def check_license():
    email = request.args.get("email")
    if not email:
        return jsonify({"premium": False, "error": "No email provided"})
        
    # Check against database
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_premium FROM licenses WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row and row[0]:
                return jsonify({"premium": True})
            else:
                return jsonify({"premium": False})
    except Exception as e:
        print("DB Error:", e)
        return jsonify({"premium": False, "error": "DB Error"})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
