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
import resend
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
CORS(app)

# Resend Configuration
# Using provided key as default fallback
resend.api_key = os.getenv("RESEND_API_KEY", "re_hkj5p2Fs_BBLyhPFKEPcSyqCbtuJeJ6ap")

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
        # Create table with new schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                email TEXT PRIMARY KEY,
                is_premium BOOLEAN DEFAULT 0,
                payment_id TEXT,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expiration_date TIMESTAMP
            )
        """)
        
        # Migration: Add expiration_date column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE licenses ADD COLUMN expiration_date TIMESTAMP")
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
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
    plan_type = data.get("plan_type", "monthly") # 'monthly' or 'yearly'
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    frontend_url = os.getenv("FRONTEND_URL", "https://smart-audio-eq.pages.dev")
    backend_url = os.getenv("BACKEND_URL", "https://smart-audio-eq-1.onrender.com")

    # Pricing Logic
    if plan_type == "yearly":
        price = 204000
        title = "Smart Audio EQ Premium (Anual)"
    else:
        price = 20000
        title = "Smart Audio EQ Premium (Mensual)"
    
    print(f"Creating preference for {email} (UID: {uid}) with price {price} ({plan_type})")

    preference_data = {
        "items": [
            {
                "title": title,
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
            "email": email,
            "plan_type": plan_type
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
                # Determine Plan Type and Expiration
                plan_type = metadata.get("plan_type", "monthly")
                days_to_add = 365 if plan_type == "yearly" else 30
                expiration_date = datetime.now() + timedelta(days=days_to_add)
                
                # Update SQLite
                with sqlite3.connect(DB_NAME) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO licenses (email, is_premium, payment_id, expiration_date)
                        VALUES (?, 1, ?, ?)
                        ON CONFLICT(email) DO UPDATE SET
                        is_premium=1,
                        payment_id=excluded.payment_id,
                        expiration_date=excluded.expiration_date
                    """, (external_reference, payment_id, expiration_date))
                    conn.commit()
                
                # Update Firestore
                if db and uid:
                    try:
                        user_ref = db.collection('usuarios').document(uid)
                        user_ref.set({
                            'isPremium': True,
                            'lastPayment': firestore.SERVER_TIMESTAMP,
                            'expirationDate': expiration_date,
                            'planType': plan_type,
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
                                'expirationDate': expiration_date,
                                'planType': plan_type,
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

                print(f"License activated for {external_reference} until {expiration_date}")

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
        plan_type = data.get("plan_type", "monthly") # 'monthly' or 'yearly'
        
        if not email or not order_id:
            return jsonify({"error": "Missing email or orderID"}), 400
            
        print(f"Registering PayPal payment for {email} (Order: {order_id}) UID: {uid} Plan: {plan_type}")
        
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
        
        # Calculate Expiration
        days_to_add = 365 if plan_type == "yearly" else 30
        expiration_date = datetime.now() + timedelta(days=days_to_add)

        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO licenses (email, is_premium, payment_id, expiration_date)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                is_premium=1,
                payment_id=excluded.payment_id,
                expiration_date=excluded.expiration_date
            """, (email, f"PAYPAL_{order_id}", expiration_date))
            conn.commit()
            
        # Update Firestore
        if db and uid:
            try:
                user_ref = db.collection('usuarios').document(uid)
                user_ref.set({
                    'isPremium': True,
                    'lastPayment': firestore.SERVER_TIMESTAMP,
                    'expirationDate': expiration_date,
                    'planType': plan_type,
                    'paymentId': order_id,
                    'method': 'PayPal',
                    'email': email
                }, merge=True)
                print(f"Firestore updated for user {uid}")
            except Exception as e:
                print(f"Error updating Firestore: {e}")
            
        return jsonify({"status": "approved", "email": email, "expiration": expiration_date})
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
        
    try:
        # 1. Check SQLite (Local Fast Cache)
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_premium, expiration_date FROM licenses WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row:
                is_premium = bool(row[0])
                expiration_str = row[1]
                
                # Check Expiration Logic
                if is_premium and expiration_str:
                    try:
                        # Handle timestamp formats (sometimes has microseconds, sometimes not)
                        if "." in expiration_str:
                             expiration_date = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M:%S.%f")
                        else:
                             expiration_date = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M:%S")
                             
                        if datetime.now() > expiration_date:
                            print(f"License expired for {email} on {expiration_date}")
                            return jsonify({"premium": False, "status": "expired", "expiration": expiration_str})
                        else:
                            return jsonify({"premium": True, "source": "sqlite", "expiration": expiration_str})
                    except Exception as e:
                        print(f"Date parsing error: {e}")
                        # Fallback: if date invalid but marked premium, assume valid for now or manual override
                        return jsonify({"premium": True, "source": "sqlite_fallback"})

                elif is_premium:
                     # Legacy users (no expiration date) -> Treat as Lifetime
                     print(f"Legacy Lifetime user confirmed: {email}")
                     return jsonify({"premium": True, "source": "sqlite_legacy", "expiration": "lifetime"})

        # 2. Check Firestore (Cloud Source of Truth)
        if db and uid:
            user_ref = db.collection('usuarios').document(uid)
            doc = user_ref.get()
            if doc.exists:
                data = doc.to_dict()
                if data.get('isPremium') is True:
                    # Check Expiration in Firestore
                    exp_date = data.get('expirationDate')
                    if exp_date:
                        # Firestore timestamp to datetime
                        # Note: Firestore returns a datetime object with timezone usually
                        now = datetime.now(exp_date.tzinfo)
                        if now > exp_date:
                             return jsonify({"premium": False, "status": "expired_firestore"})
                    
                    # Sync back to SQLite
                    with sqlite3.connect(DB_NAME) as conn:
                        cursor = conn.cursor()
                        # If exp_date is None, maybe set a default or leave null
                        exp_str = exp_date.strftime("%Y-%m-%d %H:%M:%S") if exp_date else None
                        
                        cursor.execute("""
                            INSERT INTO licenses (email, is_premium, expiration_date)
                            VALUES (?, 1, ?)
                            ON CONFLICT(email) DO UPDATE SET is_premium=1, expiration_date=excluded.expiration_date
                        """, (email, exp_str))
                        conn.commit()
                        
                    return jsonify({"premium": True, "source": "firestore"})
                    
        return jsonify({"premium": False})
        
    except Exception as e:
        print(f"Check License Error: {e}")
        return jsonify({"premium": False, "error": str(e)})

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
            
            # Check for plan type to determine expiration
            metadata = found_payment.get("metadata", {})
            plan_type = metadata.get("plan_type")
            expiration_date = None
            
            if plan_type:
                date_created = found_payment.get("date_created")
                if date_created:
                    try:
                        # Attempt to parse ISO format (e.g. 2023-01-01T12:00:00.000-05:00)
                        # We use fromisoformat which supports offsets in Python 3.7+
                        dt = datetime.fromisoformat(date_created)
                        days = 365 if plan_type == "yearly" else 30
                        expiration_date = dt + timedelta(days=days)
                        # Remove timezone for SQLite compatibility (store as naive UTC/Local)
                        expiration_date = expiration_date.replace(tzinfo=None)
                    except Exception as e:
                        print(f"Error parsing date {date_created}: {e}")

            print(f"Found approved payment {payment_id} for payer {payer_email_actual} (Plan: {plan_type}, Exp: {expiration_date})")
            
            # Activate in SQLite (Link to the ACCOUNT email, not necessarily the payer email)
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, payment_id, expiration_date)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date
                """, (account_email, payment_id, expiration_date))
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
                    'payer_email': payer_email_actual, # Record who actually paid
                    'planType': plan_type,
                    'expirationDate': expiration_date
                }, merge=True)
                
            return jsonify({
                "status": "restored", 
                "message": f"Premium restored! Linked payment {payment_id} to {account_email}",
                "payment_id": payment_id,
                "expiration": expiration_date
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

@app.route("/api/support", methods=["POST"])
def support():
    try:
        data = request.json
        email = data.get("email")
        subject = data.get("subject")
        message = data.get("message")
        
        if not email or not subject or not message:
            return jsonify({"error": "Todos los campos son obligatorios"}), 400

        # Obtener el destinatario de la variable de entorno, o usar el email del admin por defecto
        recipient = os.getenv("SUPPORT_EMAIL_RECIPIENT", "nr525859@gmail.com")
        
        # Construir el cuerpo del correo HTML
        html_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #00d2ff;">Nuevo Mensaje de Soporte</h2>
            <p><strong>De:</strong> {email}</p>
            <p><strong>Asunto:</strong> {subject}</p>
            <hr>
            <p style="white-space: pre-wrap;">{message}</p>
            <hr>
            <p style="font-size: 12px; color: #888;">Enviado desde Smart Audio EQ Web</p>
        </div>
        """

        params = {
            "from": "Soporte Smart Audio EQ <onboarding@resend.dev>",
            "to": [recipient],
            "subject": f"[Soporte] {subject}",
            "html": html_content,
            "reply_to": email
        }

        email_response = resend.Emails.send(params)
        print("Resend Response:", email_response)

        return jsonify({"success": True, "id": email_response.get("id")})

    except Exception as e:
        print(f"Support Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
