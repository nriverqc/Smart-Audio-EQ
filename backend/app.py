import os
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database setup
DB_NAME = "licenses.db"

# Initialize Firebase Admin
# NOTE: You must add your serviceAccountKey.json file to the backend folder!
cred = None
db = None
try:
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin Initialized")
    else:
        print("WARNING: serviceAccountKey.json not found. Firestore updates will fail.")
except Exception as e:
    print(f"Error initializing Firebase: {e}")

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
mp_access_token = os.getenv("MP_ACCESS_TOKEN", "TEST-3131809769096326-011813-bf894f88a6ac332ed7724844fcf95c93-1587079197")
if not mp_access_token:
    raise RuntimeError("MP_ACCESS_TOKEN is not set")
sdk = mercadopago.SDK(mp_access_token)

@app.route("/")
def home():
    return "Smart Audio EQ API is running with SQLite (v1.2 - 20k Price)"

@app.route("/create-payment", methods=["POST"])
def create_payment():
    data = request.json or {}
    email = data.get("email")
    uid = data.get("uid")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    frontend_url = os.getenv("FRONTEND_URL", "https://smart-audio-eq.pages.dev")

    # FORCE 20000 to ensure it covers minimums in COP/ARS etc
    price = 20000 
    
    print(f"Creating preference for {email} (UID: {uid}) with price {price}")

    preference_data = {
        "items": [
            {
                "title": data.get("item", "Smart Audio EQ Premium"),
                "quantity": 1,
                "currency_id": "COP", 
                "unit_price": price, 
            }
        ],
        "payer": {
            "email": email
        },
        "metadata": {
            "uid": uid,
            "email": email
        },
        "external_reference": email, # Fallback
        "back_urls": {
            "success": f"{frontend_url}/premium",
            "failure": f"{frontend_url}/premium",
            "pending": f"{frontend_url}/premium",
        },
        "auto_return": "approved",
        "payment_methods": {
            "excluded_payment_types": [],
            "installments": 12
        },
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        
        # Log full response for debugging
        print("MercadoPago Response:", json.dumps(preference_response, default=str))

        # Check if request was successful
        if preference_response.get("status") not in [200, 201]:
             print(f"MP Error Status: {preference_response.get('status')}")
             return jsonify({
                 "error": "MercadoPago API Error", 
                 "details": preference_response.get("response", "No details")
             }), 500

        response_body = preference_response.get("response", {})
        payment_url = response_body.get("init_point")
        preference_id = response_body.get("id")
        
        if not preference_id:
             return jsonify({
                 "error": "No preference_id in response", 
                 "details": response_body
             }), 500
             
        return jsonify({
            "payment_url": payment_url, # Optional if using Bricks
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
             uid = data.get("uid") # Get UID from request
             
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
             
             # Update Firestore
             if db and uid:
                try:
                    user_ref = db.collection('usuarios').document(uid)
                    user_ref.set({
                        'isPremium': True,
                        'lastPayment': firestore.SERVER_TIMESTAMP,
                        'paymentId': payment_id,
                        'method': 'MercadoPago_Brick',
                        'email': email
                    }, merge=True)
                    print(f"Firestore updated for user {uid}")
                except Exception as e:
                    print(f"Error updating Firestore: {e}")

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
            metadata = payment.get("metadata", {})
            uid = metadata.get("uid")
            
            print(f"Payment {payment_id} status: {status} for email: {external_reference} uid: {uid}")

            if status == "approved":
                # Update SQLite
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
                
                # Update Firestore
                if db and uid:
                    try:
                        user_ref = db.collection('usuarios').document(uid)
                        user_ref.set({
                            'isPremium': True,
                            'lastPayment': firestore.SERVER_TIMESTAMP,
                            'paymentId': payment_id,
                            'method': 'MercadoPago',
                            'email': external_reference
                        }, merge=True)
                        print(f"Firestore updated for user {uid}")
                    except Exception as e:
                        print(f"Error updating Firestore: {e}")
                elif db and external_reference:
                    # Try to find user by email if UID missing (unlikely if passed correctly)
                    # NOTE: Firestore doesn't support easy querying without indexes sometimes
                    # Skipping for now to keep simple
                    pass

                print(f"License activated for {external_reference}")

        return jsonify({"status": "received"}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/register-paypal", methods=["POST"])
def register_paypal():
    try:
        data = request.json
        email = data.get("email")
        order_id = data.get("orderID")
        uid = data.get("uid")
        
        if not email or not order_id:
            return jsonify({"error": "Missing email or orderID"}), 400
            
        print(f"Registering PayPal payment for {email} (Order: {order_id}) UID: {uid}")
        
        # In production, we should verify order_id with PayPal API using Client Secret
        # For now, we trust the client-side success for this MVP
        
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO licenses (email, is_premium, payment_id)
                VALUES (?, 1, ?)
                ON CONFLICT(email) DO UPDATE SET
                is_premium=1,
                payment_id=excluded.payment_id
            """, (email, f"PAYPAL_{order_id}"))
            conn.commit()
            
        # Update Firestore
        if db and uid:
            try:
                user_ref = db.collection('usuarios').document(uid)
                user_ref.set({
                    'isPremium': True,
                    'lastPayment': firestore.SERVER_TIMESTAMP,
                    'paymentId': order_id,
                    'method': 'PayPal',
                    'email': email
                }, merge=True)
                print(f"Firestore updated for user {uid}")
            except Exception as e:
                print(f"Error updating Firestore: {e}")
            
        return jsonify({"status": "approved", "email": email})
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
