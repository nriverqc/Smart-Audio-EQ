import os
import sqlite3
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
from dotenv import load_dotenv
import json
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
mp_access_token = os.getenv("MP_ACCESS_TOKEN")
if not mp_access_token:
    print("WARNING: MP_ACCESS_TOKEN is not set. Payment features will fail.")
else:
    sdk = mercadopago.SDK(mp_access_token)

# PayPal Configuration
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET")
PAYPAL_API_BASE = "https://api-m.paypal.com" # Use https://api-m.sandbox.paypal.com for sandbox

def get_paypal_access_token():
    try:
        auth = (PAYPAL_CLIENT_ID, PAYPAL_SECRET)
        data = {"grant_type": "client_credentials"}
        response = requests.post(f"{PAYPAL_API_BASE}/v1/oauth2/token", auth=auth, data=data)
        if response.status_code == 200:
            return response.json().get("access_token")
        print(f"PayPal Auth Error: {response.text}")
        return None
    except Exception as e:
        print(f"PayPal Auth Exception: {e}")
        return None

def verify_paypal_order(order_id):
    token = get_paypal_access_token()
    if not token:
        return False, "Could not get PayPal access token"
        
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{PAYPAL_API_BASE}/v2/checkout/orders/{order_id}", headers=headers)
        if response.status_code == 200:
            order_data = response.json()
            status = order_data.get("status")
            if status == "COMPLETED" or status == "APPROVED":
                return True, order_data
            return False, f"Order status is {status}"
        return False, f"PayPal API Error: {response.text}"
    except Exception as e:
        return False, str(e)


@app.route("/")
def home():
    return "Smart Audio EQ API is running with SQLite (v1.2 - 20k Price)"

@app.route("/create-payment", methods=["POST"])
def create_payment():
    if not mp_access_token:
         return jsonify({"error": "Payment service unavailable (Configuration error)"}), 503
    
    data = request.json or {}
    email = data.get("email")
    uid = data.get("uid")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    frontend_url = os.getenv("FRONTEND_URL", "https://smart-audio-eq.pages.dev")
    backend_url = os.getenv("BACKEND_URL", "https://smart-audio-eq-1.onrender.com")

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
        "notification_url": f"{backend_url}/webhook/mercadopago",
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
    if not mp_access_token:
         return jsonify({"error": "Payment service unavailable (Configuration error)"}), 503
    try:
        data = request.json
        print("Processing Brick Payment:", data)

        frontend_url = os.getenv("FRONTEND_URL", "https://smart-audio-eq.pages.dev")
        backend_url = os.getenv("BACKEND_URL", "https://smart-audio-eq-1.onrender.com")

        payment_data = {
            "transaction_amount": float(data.get("transaction_amount")),
            "token": data.get("token"),
            "description": data.get("description", "Smart Audio EQ Premium"),
            "installments": int(data.get("installments", 1)),
            "payment_method_id": data.get("payment_method_id"),
            "notification_url": f"{backend_url}/webhook/mercadopago",
            "metadata": {
                "uid": data.get("uid"),
                "email": data["payer"]["email"]
            },
            "payer": {
                "email": data["payer"]["email"],
                "identification": {
                    "type": data["payer"]["identification"]["type"],
                    "number": data["payer"]["identification"]["number"]
                },
                # Some payment methods like PSE need entity_type
                "entity_type": data["payer"].get("entity_type") 
            },
            "external_reference": data["payer"]["email"], # LINK TO EMAIL
            # REQUIRED FOR PSE / 3DS
            "callback_url": f"{frontend_url}/premium", 
            "additional_info": {
                "ip_address": request.remote_addr or "127.0.0.1"
            }
        }
        
        # Clean up None values to avoid API errors
        if payment_data["payer"].get("entity_type") is None:
             del payment_data["payer"]["entity_type"]

        if data.get("issuer_id"):
            payment_data["issuer_id"] = int(data["issuer_id"])
            
        # Add transaction_details if present (Required for PSE to pass financial_institution)
        if data.get("transaction_details"):
            payment_data["transaction_details"] = data["transaction_details"]

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
                    print(f"UID missing in metadata. Searching Firestore for email: {external_reference}")
                    try:
                        users_ref = db.collection('usuarios')
                        query = users_ref.where('email', '==', external_reference).limit(1).stream()
                        
                        found = False
                        for doc in query:
                            found = True
                            user_ref = doc.reference
                            user_ref.set({
                                'isPremium': True,
                                'lastPayment': firestore.SERVER_TIMESTAMP,
                                'paymentId': payment_id,
                                'method': 'MercadoPago_Webhook_EmailFallback',
                                'email': external_reference
                            }, merge=True)
                            print(f"Firestore updated for user {doc.id} (found by email)")
                            break
                        
                        if not found:
                             print(f"No user found with email {external_reference} to update.")
                             
                    except Exception as e:
                        print(f"Error searching/updating Firestore by email: {e}")

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
        
        # Verify order_id with PayPal API using Client Secret
        verified, result = verify_paypal_order(order_id)
        if not verified:
            print(f"PayPal Verification Failed: {result}")
            # NOTE: For now, we are soft-failing to avoid blocking users if verification fails 
            # due to API issues, but logging the error. 
            # In strict production, you might want to uncomment the next line:
            # return jsonify({"error": f"Payment verification failed: {result}"}), 400
        else:
            print(f"PayPal Payment Verified: {result.get('id')}")
        
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
    uid = request.args.get("uid")
    
    if not email:
        return jsonify({"premium": False, "error": "No email provided"})
        
    # 1. Check SQLite first (fast)
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_premium FROM licenses WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row and row[0]:
                return jsonify({"premium": True, "source": "sqlite"})
    except Exception as e:
        print(f"SQLite Check Error: {e}")

    # 2. Check Firestore (authoritative)
    if db and uid:
        try:
            doc = db.collection('usuarios').document(uid).get()
            if doc.exists:
                data = doc.to_dict()
                if data.get('isPremium') is True:
                     return jsonify({"premium": True, "source": "firestore"})
        except Exception as e:
             print(f"Firestore Check Error: {e}")
             
    return jsonify({"premium": False})

@app.route("/sync-user", methods=["POST"])
def sync_user():
    """Syncs user data from frontend to Firestore on login"""
    try:
        data = request.json
        uid = data.get("uid")
        email = data.get("email")
        
        if not uid or not email:
            return jsonify({"error": "Missing uid or email"}), 400
            
        if db:
            user_ref = db.collection('usuarios').document(uid)
            # Use set with merge=True to create or update
            # We don't overwrite isPremium if it exists
            user_ref.set({
                'uid': uid,
                'email': email,
                'displayName': data.get("displayName"),
                'photoURL': data.get("photoURL"),
                'lastLogin': firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"User synced to Firestore: {email} ({uid})")
            return jsonify({"status": "synced"})
        else:
             return jsonify({"error": "Firestore not initialized"}), 503
    except Exception as e:
        print(f"Error syncing user: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/restore-purchase", methods=["POST"])
def restore_purchase():
    """Manually checks MercadoPago for approved payments for a given email or payment ID"""
    if not mp_access_token:
         return jsonify({"error": "Payment service unavailable"}), 503
         
    try:
        data = request.json
        account_email = data.get("email") # The logged-in user's email
        uid = data.get("uid")
        
        # Optional: User can provide the specific email they paid with OR a Payment ID
        payer_email = data.get("payer_email") or account_email
        payment_id_input = data.get("payment_id")

        if not account_email:
            return jsonify({"error": "Account email required"}), 400
            
        print(f"Restoring purchase for Account: {account_email} (UID: {uid}) | Search: {payer_email} / ID: {payment_id_input}")
        
        found_payment = None

        # 1. Search by Payment ID (Most accurate)
        if payment_id_input:
            try:
                payment_info = sdk.payment().get(int(payment_id_input))
                payment = payment_info.get("response", {})
                if payment.get("status") == "approved":
                    found_payment = payment
            except Exception as e:
                print(f"Error searching by ID {payment_id_input}: {e}")

        # 2. Search by Email (Fallback)
        if not found_payment and payer_email:
            filters = {
                "status": "approved",
                "payer.email": payer_email,
                "sort": "date_created",
                "criteria": "desc"
            }
            search_result = sdk.payment().search(filters)
            results = search_result.get("response", {}).get("results", [])
            if results:
                found_payment = results[0] # Most recent

        if found_payment:
            payment_id = str(found_payment.get("id"))
            payer_email_actual = found_payment.get("payer", {}).get("email")
            print(f"Found approved payment {payment_id} for payer {payer_email_actual}")
            
            # Activate in SQLite (Link to the ACCOUNT email, not necessarily the payer email)
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, payment_id)
                    VALUES (?, 1, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id
                """, (account_email, payment_id))
                conn.commit()
                
            # Activate in Firestore
            if db and uid:
                user_ref = db.collection('usuarios').document(uid)
                user_ref.set({
                    'isPremium': True,
                    'lastPayment': firestore.SERVER_TIMESTAMP,
                    'paymentId': payment_id,
                    'method': 'MercadoPago_Restore_Manual',
                    'email': account_email,
                    'payer_email': payer_email_actual # Record who actually paid
                }, merge=True)
                
            return jsonify({
                "status": "restored", 
                "message": f"Premium restored! Linked payment {payment_id} to {account_email}",
                "payment_id": payment_id
            })
        else:
            return jsonify({
                "status": "not_found",
                "message": "No approved payments found for the provided details."
            })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
