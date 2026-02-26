import os
import sqlite3
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import json
import firebase_admin
from firebase_admin import credentials, firestore
import resend
from datetime import datetime, timedelta
import uuid

load_dotenv()

app = Flask(__name__)
CORS(app)

# Resend Configuration
# Using provided key as default fallback
resend.api_key = os.getenv("RESEND_API_KEY", "re_hkj5p2Fs_BBLyhPFKEPcSyqCbtuJeJ6ap")

# Database setup
DB_NAME = "licenses.db"

# App Pass Configuration
APP_PASS_CODE = os.getenv("APP_PASS_CODE", "SMART-AUDIO-PRO-2026")

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

# PayPal Configuration
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET")
# FORCE LIVE ENVIRONMENT
PAYPAL_API_BASE = "https://api-m.paypal.com"

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

# --- SUBSCRIPTION HELPERS ---

def get_or_create_paypal_plan(product_id, plan_name, interval_unit, amount):
    """Creates a PayPal plan if it doesn't exist"""
    plans_file = "paypal_plans.json"
    plans = {}
    if os.path.exists(plans_file):
        try:
            with open(plans_file, 'r') as f:
                plans = json.load(f)
        except:
            pass
            
    plan_key = f"{plan_name}_{interval_unit}_{amount}"
    if plan_key in plans:
        return plans[plan_key]

    token = get_paypal_access_token()
    if not token: return None
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "PayPal-Request-Id": str(uuid.uuid4())
    }

    # Check if plan already exists in PayPal (Simple List Check)
    try:
        list_resp = requests.get(f"{PAYPAL_API_BASE}/v1/billing/plans?page_size=20&status=ACTIVE", headers={"Authorization": f"Bearer {token}"})
        if list_resp.status_code == 200:
            existing_plans = list_resp.json().get("plans", [])
            for p in existing_plans:
                if p.get("name") == plan_name and p.get("status") == "ACTIVE":
                    print(f"Found existing PayPal Plan: {plan_name} ({p['id']})")
                    plans[plan_key] = p['id']
                    with open(plans_file, 'w') as f:
                        json.dump(plans, f)
                    return p['id']
    except Exception as e:
        print(f"Error checking existing plans: {e}")
    
    data = {
        "product_id": product_id,
        "name": plan_name,
        "description": f"{interval_unit}ly subscription",
        "billing_cycles": [
            {
                "frequency": {"interval_unit": interval_unit, "interval_count": 1},
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,
                "pricing_scheme": {"fixed_price": {"value": str(amount), "currency_code": "USD"}}
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee": {"value": "0", "currency_code": "USD"},
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3
        }
    }
    
    resp = requests.post(f"{PAYPAL_API_BASE}/v1/billing/plans", headers=headers, json=data)
    if resp.status_code == 201:
        plan_id = resp.json()["id"]
        plans[plan_key] = plan_id
        with open(plans_file, 'w') as f:
            json.dump(plans, f)
        print(f"Created PayPal Plan: {plan_name} ({plan_id})")
        return plan_id
    else:
        print(f"Error creating PayPal plan: {resp.text}")
        return None

def setup_paypal_products_and_plans():
    """Ensures PayPal Product and Plans exist"""
    token = get_paypal_access_token()
    if not token: return {}
    
    # 1. Product
    product_id = "SMART_AUDIO_EQ_PREMIUM_V1"
    
    plans_file = "paypal_plans.json"
    store = {}
    if os.path.exists(plans_file):
        try:
            with open(plans_file, 'r') as f:
                store = json.load(f)
        except:
            pass
            
    if "product_id" not in store:
        # Create Product
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "PayPal-Request-Id": str(uuid.uuid4())
        }
        data = {
            "name": "Smart Audio EQ Premium",
            "type": "SERVICE",
            "category": "SOFTWARE"
        }
        resp = requests.post(f"{PAYPAL_API_BASE}/v1/catalogs/products", headers=headers, json=data)
        if resp.status_code == 201:
            store["product_id"] = resp.json()["id"]
            with open(plans_file, 'w') as f:
                json.dump(store, f)
        else:
            print(f"Error creating product: {resp.text}")
            return {}
            
    product_id = store["product_id"]
    
    # 2. Plans - Updated Pricing to $0.99
    monthly_id = get_or_create_paypal_plan(product_id, "Smart Audio EQ Premium (Monthly)", "MONTH", "0.99")
    yearly_id = get_or_create_paypal_plan(product_id, "Smart Audio EQ Premium (Yearly)", "YEAR", "10.10")
    
    return {"monthly": monthly_id, "yearly": yearly_id}

# Global Plan Cache
PAYPAL_PLANS = {}
try:
    PAYPAL_PLANS = setup_paypal_products_and_plans()
except Exception as e:
    print(f"Error setting up PayPal plans: {e}")


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
    return "Smart Audio EQ API is running with SQLite (v3.0 - PayPal Only + App Pass)"

@app.route("/get-plans", methods=["GET"])
def get_plans():
    """Returns the available subscription plans"""
    return jsonify({
        "paypal": PAYPAL_PLANS
    })

@app.route("/register-paypal", methods=["POST"])
def register_paypal():
    try:
        data = request.json or {}
        email = data.get("email")
        order_id = data.get("orderID")
        subscription_id = data.get("subscriptionID")
        uid = data.get("uid")
        plan_type = data.get("plan_type", "monthly") # 'monthly' or 'yearly'
        
        # 1. Handle Subscription
        if subscription_id:
            print(f"Verifying PayPal Subscription: {subscription_id} for {email}")
            token = get_paypal_access_token()
            if not token:
                 return jsonify({"error": "PayPal Auth Failed"}), 500
            
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription_id}", headers=headers)
            
            if resp.status_code == 200:
                sub_data = resp.json()
                status = sub_data.get("status")
                if status in ["ACTIVE", "APPROVED"]:
                    # Success
                    subscriber = sub_data.get("subscriber", {})
                    payer_email = subscriber.get("email_address") or email
                    
                    # Calculate expiration based on billing info or fallback
                    billing_info = sub_data.get("billing_info", {})
                    next_billing_time = billing_info.get("next_billing_time")
                    
                    if next_billing_time:
                        try:
                            # PayPal format: 2024-03-12T10:00:00Z
                            expiration_date = datetime.strptime(next_billing_time, "%Y-%m-%dT%H:%M:%SZ")
                        except:
                            expiration_date = datetime.now() + (timedelta(days=365) if plan_type == "yearly" else timedelta(days=30))
                    else:
                        expiration_date = datetime.now() + (timedelta(days=365) if plan_type == "yearly" else timedelta(days=30))

                    # Save to DB
                    with sqlite3.connect(DB_NAME) as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            INSERT INTO licenses (email, is_premium, payment_id, expiration_date) 
                            VALUES (?, 1, ?, ?)
                            ON CONFLICT(email) DO UPDATE SET 
                                is_premium=1, 
                                payment_id=excluded.payment_id,
                                expiration_date=excluded.expiration_date
                        """, (payer_email, subscription_id, expiration_date))
                        conn.commit()
                        
                    # Sync to Firebase
                    if db and uid:
                        try:
                            user_ref = db.collection('usuarios').document(uid)
                            user_ref.set({
                                'isPremium': True,
                                'lastPayment': firestore.SERVER_TIMESTAMP,
                                'expirationDate': expiration_date,
                                'planType': plan_type,
                                'paymentId': subscription_id,
                                'method': 'PayPal_Subscription',
                                'email': payer_email
                            }, merge=True)
                        except Exception as e:
                            print(f"Firebase Update Error: {e}")
                            
                    return jsonify({"status": "approved", "email": payer_email, "expiration": expiration_date})
                else:
                    return jsonify({"error": f"Subscription status is {status}"}), 400
            else:
                return jsonify({"error": "Failed to verify subscription"}), resp.status_code

        # 2. Handle Order (Fallback)
        if not email or not order_id:
            return jsonify({"error": "Missing email or orderID"}), 400
            
        print(f"Registering PayPal payment for {email} (Order: {order_id}) UID: {uid} Plan: {plan_type}")
        
        # Verify order_id with PayPal API using Client Secret
        verified, result = verify_paypal_order(order_id)
        if not verified:
            print(f"PayPal Verification Failed: {result}")
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

@app.route("/verify-official-app-pass", methods=["POST"])
def verify_official_app_pass():
    """Verifies an official App Pass token from joinapppass.com"""
    try:
        data = request.json or {}
        email = data.get("email")
        uid = data.get("uid")
        token = data.get("token")
        
        if not email or not uid or not token:
            return jsonify({"error": "Faltan datos (email, uid o token)"}), 400
            
        # Verify with official App Pass API
        headers = {"app-pass-token": token}
        resp = requests.get("https://joinapppass.com/api/check-app-pass", headers=headers)
        
        if resp.status_code == 200:
            # Official validation successful
            expiration_date = datetime.now() + timedelta(days=30) # Monthly check
            
            # Save to SQLite
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, payment_id, expiration_date)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date
                """, (email, f"OFFICIAL_APP_PASS_{token[:8]}", expiration_date))
                conn.commit()
                
            # Sync to Firestore
            if db:
                try:
                    user_ref = db.collection('usuarios').document(uid)
                    user_ref.set({
                        'isPremium': True,
                        'lastPayment': firestore.SERVER_TIMESTAMP,
                        'expirationDate': expiration_date,
                        'method': 'Official_App_Pass',
                        'email': email
                    }, merge=True)
                except Exception as e:
                    print(f"Firebase Update Error: {e}")
                    
            return jsonify({"status": "success", "message": "¡App Pass oficial verificado!"})
        else:
            return jsonify({"error": "Token de App Pass inválido o expirado"}), 403
            
    except Exception as e:
        print(f"Official App Pass Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/verify-app-pass", methods=["POST"])
def verify_app_pass():
    """Verifies an App Pass code and activates Premium"""
    try:
        data = request.json or {}
        email = data.get("email")
        uid = data.get("uid")
        code = data.get("code")
        
        if not email or not uid or not code:
            return jsonify({"error": "Faltan datos (email, uid o código)"}), 400
            
        clean_code = code.strip().upper()
        
        # Check against single hardcoded promo code
        if clean_code == APP_PASS_CODE.strip().upper():
            # Check if used in Firestore
            if db:
                promo_ref = db.collection('promo_codes').document(clean_code)
                promo_doc = promo_ref.get()
                
                if promo_doc.exists and promo_doc.to_dict().get('used') is True:
                    # Allow re-use ONLY if it's the SAME user (restoring purchase)
                    used_by = promo_doc.to_dict().get('usedBy')
                    if used_by != uid:
                        return jsonify({"error": "Este código ya ha sido utilizado por otro usuario."}), 403
                
                # Mark as used
                promo_ref.set({
                    'used': True,
                    'usedBy': uid,
                    'usedByEmail': email,
                    'dateUsed': firestore.SERVER_TIMESTAMP,
                    'code': clean_code
                }, merge=True)

            # Activate Premium (1 Month for Promo Code)
            expiration_date = datetime.now() + timedelta(days=30) 
            
            # Save to SQLite
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, payment_id, expiration_date)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date
                """, (email, f"PROMO_{clean_code}", expiration_date))
                conn.commit()
                
            # Sync to Firestore User Profile
            if db:
                try:
                    user_ref = db.collection('usuarios').document(uid)
                    user_ref.set({
                        'isPremium': True,
                        'lastPayment': firestore.SERVER_TIMESTAMP,
                        'expirationDate': expiration_date,
                        'method': 'Promo_Code',
                        'email': email
                    }, merge=True)
                except Exception as e:
                    print(f"Firebase Update Error: {e}")
                    
            return jsonify({"status": "success", "message": "¡Código canjeado correctamente!"})
        else:
            return jsonify({"error": "Código inválido"}), 403
            
    except Exception as e:
        print(f"App Pass Error: {e}")
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
    """Checks for existing Premium status (simplified for PayPal/AppPass)"""
    # This route is now simpler as we check SQLite/Firestore in check-license
    # But we can keep it for manual "restore" button logic if needed.
    return jsonify({"status": "check_license_instead", "message": "Use check-license endpoint"})

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
