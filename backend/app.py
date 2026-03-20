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
                status TEXT DEFAULT 'free',
                payment_id TEXT,
                method TEXT,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expiration_date TIMESTAMP,
                trial_end_date TIMESTAMP
            )
        """)
        
        # Migration: Add columns if they don't exist
        columns = [
            ("expiration_date", "TIMESTAMP"),
            ("method", "TEXT"),
            ("status", "TEXT DEFAULT 'free'"),
            ("trial_end_date", "TIMESTAMP")
        ]
        for col_name, col_type in columns:
            try:
                cursor.execute(f"ALTER TABLE licenses ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass
            
        conn.commit()

# Initialize DB on start
init_db()

# PayPal Configuration
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox") # 'sandbox' or 'live'

if PAYPAL_MODE == "live":
    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID_LIVE")
    PAYPAL_SECRET = os.getenv("PAYPAL_SECRET_LIVE")
    PAYPAL_API_BASE = "https://api-m.paypal.com"
else:
    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID_SANDBOX")
    PAYPAL_SECRET = os.getenv("PAYPAL_SECRET_SANDBOX")
    PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com"

print(f"PayPal Mode: {PAYPAL_MODE}")

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
    """Ensures PayPal Product and Plans exist (Sandbox only) or returns Live IDs"""
    if PAYPAL_MODE == "live":
        return {
            "monthly": "P-78B38019CY529260SNGQ35XA",
            "yearly": "P-01X48882SJ7657315NGQ37BY"
        }

    token = get_paypal_access_token()
    if not token: return {}
    
    # 1. Product - V3 for new pricing structure
    product_key = "product_id_v3"
    
    plans_file = "paypal_plans.json"
    store = {}
    if os.path.exists(plans_file):
        try:
            with open(plans_file, 'r') as f:
                store = json.load(f)
        except:
            pass
            
    if product_key not in store:
        # Create Product
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        data = {
            "name": "Equalizer – Web Audio Premium V3",
            "type": "SERVICE",
            "category": "SOFTWARE"
        }
        resp = requests.post(f"{PAYPAL_API_BASE}/v1/catalogs/products", headers=headers, json=data)
        if resp.status_code == 201:
            store[product_key] = resp.json()["id"]
            with open(plans_file, 'w') as f:
                json.dump(store, f)
        else:
            print(f"Error creating product: {resp.text}")
            return {}
            
    product_id = store[product_key]
    
    # 2. Plans
    yearly_price = "16.99"
    monthly_price = "1.99"
    
    yearly_plan_key = f"yearly_plan_{yearly_price}"
    monthly_plan_key = f"monthly_plan_{monthly_price}"
    
    # Generate Yearly Plan for Sandbox if needed
    if yearly_plan_key not in store:
        headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json" }
        plan_data = {
            "product_id": product_id,
            "name": "Equalizer – Web Audio Premium (Yearly Sandbox)",
            "description": "Yearly subscription",
            "status": "ACTIVE",
            "billing_cycles": [
                {
                    "frequency": { "interval_unit": "YEAR", "interval_count": 1 },
                    "tenure_type": "REGULAR",
                    "sequence": 1,
                    "total_cycles": 0,
                    "pricing_scheme": { "fixed_price": { "value": yearly_price, "currency_code": "USD" } }
                }
            ],
            "payment_preferences": {
                "auto_bill_outstanding": True,
                "setup_fee": { "value": "0", "currency_code": "USD" },
                "setup_fee_failure_action": "CONTINUE",
                "payment_failure_threshold": 3
            }
        }
        resp = requests.post(f"{PAYPAL_API_BASE}/v1/billing/plans", headers=headers, json=plan_data)
        if resp.status_code == 201:
            store[yearly_plan_key] = resp.json()["id"]
            with open(plans_file, 'w') as f:
                json.dump(store, f)

    # Generate Monthly Plan for Sandbox if needed
    if monthly_plan_key not in store:
         headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json" }
         plan_data = {
            "product_id": product_id,
            "name": "Equalizer – Web Audio Premium (Monthly Sandbox)",
            "description": "Monthly subscription",
            "status": "ACTIVE",
            "billing_cycles": [
                {
                    "frequency": { "interval_unit": "MONTH", "interval_count": 1 },
                    "tenure_type": "REGULAR",
                    "sequence": 1,
                    "total_cycles": 0,
                    "pricing_scheme": { "fixed_price": { "value": monthly_price, "currency_code": "USD" } }
                }
            ],
            "payment_preferences": {
                "auto_bill_outstanding": True,
                "setup_fee": { "value": "0", "currency_code": "USD" },
                "setup_fee_failure_action": "CONTINUE",
                "payment_failure_threshold": 3
            }
        }
         resp = requests.post(f"{PAYPAL_API_BASE}/v1/billing/plans", headers=headers, json=plan_data)
         if resp.status_code == 201:
            store[monthly_plan_key] = resp.json()["id"]
            with open(plans_file, 'w') as f:
                json.dump(store, f)

    return {
        "monthly": store.get(monthly_plan_key),
        "yearly": store.get(yearly_plan_key)
    }

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
    return "Equalizer – Web Audio API is running with SQLite (v3.1 - creitus1 active)"

@app.route("/get-plans", methods=["GET"])
def get_plans():
    """Returns the available subscription plans and correct client ID"""
    return jsonify({
        "paypal": PAYPAL_PLANS,
        "paypal_client_id": PAYPAL_CLIENT_ID,
        "paypal_mode": PAYPAL_MODE
    })

@app.route("/paypal-webhook", methods=["POST"])
def paypal_webhook():
    """Dummy webhook to avoid FAIL_SOFT errors in PayPal dashboard"""
    return jsonify({"status": "received"}), 200

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
                            INSERT INTO licenses (email, is_premium, payment_id, expiration_date, method) 
                            VALUES (?, 1, ?, ?, ?)
                            ON CONFLICT(email) DO UPDATE SET 
                                is_premium=1, 
                                payment_id=excluded.payment_id,
                                expiration_date=excluded.expiration_date,
                                method=excluded.method
                        """, (payer_email, subscription_id, expiration_date, "PayPal"))
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

@app.route("/paddle-webhook", methods=["POST"])
def paddle_webhook():
    """Handles Paddle Billing Webhooks (v2)"""
    try:
        # 1. Get raw body for signature verification (if needed later)
        payload = request.json
        if not payload:
            return jsonify({"error": "No payload"}), 400
            
        event_type = payload.get("event_type")
        data = payload.get("data", {})
        
        print(f"🔔 Paddle Webhook Received: {event_type}")

        # 2. Extract user info from customData
        custom_data = data.get("custom_data", {})
        email = custom_data.get("email")
        uid = custom_data.get("uid")
        
        # Fallback if custom_data is missing but present in transaction/subscription
        if not email:
            customer = data.get("customer", {})
            email = customer.get("email")

        if not email:
            print("⚠️ Paddle Webhook: No email found in custom_data or customer info.")
            return jsonify({"status": "ignored", "reason": "no_email"}), 200

        # 3. Handle specific events
        if event_type in ["transaction.paid", "transaction.completed", "subscription.activated", "subscription.updated", "subscription.trialing"]:
            print(f"✅ Activating/Updating Premium for {email} (UID: {uid}) via Paddle")
            
            # Status from Paddle
            paddle_status = data.get("status", "active")
            # Map Paddle status to our internal status
            status = "trialing" if paddle_status == "trialing" else "active"
            
            # Calculate expiration
            days_to_add = 31 # Default monthly
            
            items = data.get("items", [])
            for item in items:
                price_info = item.get("price", {})
                price_id = item.get("price_id") or price_info.get("id")
                
                if price_id == "pri_01kk2mxf0828y5x7p8bky7ch47": # Anual
                    days_to_add = 366
                    break
                elif price_id == "pri_01kk2mvgj2pmjfh0pkjatsv8bf": # Mensual
                    days_to_add = 31
                    break

            now = datetime.now()
            expiration_date = now + timedelta(days=days_to_add)
            
            # If trialing, Paddle usually provides trial_end
            trial_end_date = None
            if status == "trialing":
                trial_end_str = data.get("current_billing_period", {}).get("ends_at")
                if trial_end_str:
                    try:
                        trial_end_date = datetime.strptime(trial_end_str.split(".")[0], "%Y-%m-%dT%H:%M:%S")
                    except:
                        trial_end_date = now + timedelta(days=3) # Fallback 3 days
                else:
                    trial_end_date = now + timedelta(days=3)

            payment_id = data.get("id") or data.get("subscription_id")

            # Update SQLite
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO licenses (email, is_premium, status, payment_id, expiration_date, trial_end_date, method)
                    VALUES (?, 1, ?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    status=excluded.status,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date,
                    trial_end_date=excluded.trial_end_date,
                    method=excluded.method
                """, (email, status, f"PADDLE_{payment_id}", expiration_date, trial_end_date, "Paddle"))
                conn.commit()

            # Update Firestore
            if db and uid:
                try:
                    user_ref = db.collection('usuarios').document(uid)
                    update_data = {
                        'isPremium': True,
                        'status': status,
                        'lastPayment': firestore.SERVER_TIMESTAMP,
                        'expirationDate': expiration_date,
                        'paymentId': payment_id,
                        'method': 'Paddle',
                        'email': email
                    }
                    if trial_end_date:
                        update_data['trialEndDate'] = trial_end_date
                        
                    user_ref.set(update_data, merge=True)
                except Exception as e:
                    print(f"Firebase Update Error: {e}")

            return jsonify({"status": "success", "message": f"Premium {status} activated"})

        elif event_type in ["subscription.canceled", "subscription.past_due"]:
            new_status = "canceled" if event_type == "subscription.canceled" else "past_due"
            print(f"❌ Updating Premium for {email} (UID: {uid}) - Status: {new_status}")
            
            # Update SQLite
            with sqlite3.connect(DB_NAME) as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE licenses SET is_premium=0, status=? WHERE email=?", (new_status, email))
                conn.commit()

            # Update Firestore
            if db and uid:
                try:
                    user_ref = db.collection('usuarios').document(uid)
                    user_ref.update({
                        'isPremium': False,
                        'status': new_status
                    })
                except Exception as e:
                    print(f"Firebase Update Error: {e}")

            return jsonify({"status": "success", "message": f"Premium status updated to {new_status}"})

        return jsonify({"status": "ignored", "event": event_type}), 200

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
                    INSERT INTO licenses (email, is_premium, payment_id, expiration_date, method)
                    VALUES (?, 1, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date,
                    method=excluded.method
                """, (email, f"OFFICIAL_APP_PASS_{token[:8]}", expiration_date, "Official_App_Pass"))
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
                    INSERT INTO licenses (email, is_premium, payment_id, expiration_date, method)
                    VALUES (?, 1, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date,
                    method=excluded.method
                """, (email, f"PROMO_{clean_code}", expiration_date, "Promo_Code"))
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
        
    print(f"Checking license for: {email} (v1.1.0 - Trials active)")

    try:
        # 1. Check Firestore FIRST if UID is provided (Admin override)
        if db and uid:
            user_ref = db.collection('usuarios').document(uid)
            doc = user_ref.get()
            if doc.exists:
                data = doc.to_dict()
                status = data.get('status', 'free')
                is_premium_db = data.get('isPremium', False)
                
                # Manual deactivation in DB
                if is_premium_db is False and status not in ['trialing', 'active']:
                    with sqlite3.connect(DB_NAME) as conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE licenses SET is_premium=0, status='free' WHERE email=?", (email,))
                        conn.commit()
                    return jsonify({"premium": False, "status": "free", "source": "firestore_override"})
                
                # Logic for expiration...
                exp_date = data.get('expirationDate')
                trial_end = data.get('trialEndDate')
                
                now = datetime.now()
                
                # Handle Trialing status from DB
                if status == 'trialing' and trial_end:
                    if now > trial_end:
                        status = 'expired_trial'
                        is_premium_db = False
                    else:
                        is_premium_db = True
                
                # Handle Active/Subscription from DB
                elif status == 'active' and exp_date:
                    if now > exp_date:
                        status = 'past_due' # Or expired
                        is_premium_db = False
                    else:
                        is_premium_db = True
                
                # Sync back to SQLite
                with sqlite3.connect(DB_NAME) as conn:
                    cursor = conn.cursor()
                    exp_str = exp_date.strftime("%Y-%m-%d %H:%M:%S") if exp_date else None
                    trial_str = trial_end.strftime("%Y-%m-%d %H:%M:%S") if trial_end else None
                    cursor.execute("""
                        INSERT INTO licenses (email, is_premium, status, expiration_date, trial_end_date, method)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(email) DO UPDATE SET 
                            is_premium=excluded.is_premium, 
                            status=excluded.status, 
                            expiration_date=excluded.expiration_date,
                            trial_end_date=excluded.trial_end_date,
                            method=excluded.method
                    """, (email, 1 if is_premium_db else 0, status, exp_str, trial_str, data.get('method')))
                    conn.commit()
                
                return jsonify({
                    "premium": is_premium_db,
                    "status": status,
                    "source": "firestore",
                    "trial_end": trial_end.strftime("%Y-%m-%d %H:%M:%S") if trial_end else None,
                    "expiration": exp_date.strftime("%Y-%m-%d %H:%M:%S") if exp_date else None
                })

        # 2. Check SQLite (Local Fast Cache) as fallback
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_premium, status, expiration_date, trial_end_date, method FROM licenses WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row:
                is_premium = bool(row[0])
                status = row[1]
                expiration_str = row[2]
                trial_end_str = row[3]
                method = row[4]
                
                now = datetime.now()
                
                # Re-verify local status for trials
                if status == 'trialing' and trial_end_str:
                    try:
                        trial_end = datetime.strptime(trial_end_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
                        if now > trial_end:
                            is_premium = False
                            status = 'expired_trial'
                    except: pass
                
                # Re-verify local status for active sub
                elif status == 'active' and expiration_str:
                    try:
                        exp_date = datetime.strptime(expiration_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
                        if now > exp_date:
                            is_premium = False
                            status = 'past_due'
                    except: pass

                return jsonify({
                    "premium": is_premium,
                    "status": status,
                    "source": "sqlite",
                    "expiration": expiration_str,
                    "trial_end": trial_end_str,
                    "method": method
                })

        return jsonify({"premium": False, "status": "free"})
        
    except Exception as e:
        print(f"Check License Error: {e}")
        return jsonify({"premium": False, "error": str(e)})

@app.route("/start-trial", methods=["POST"])
def start_trial():
    """Initializes a 3-day trial for a user"""
    try:
        data = request.json or {}
        email = data.get("email")
        uid = data.get("uid")
        
        if not email or not uid:
            return jsonify({"error": "Missing email or uid"}), 400
            
        # Check if user already had a trial
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT status, trial_end_date FROM licenses WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row and row[1]: # Already has trial info
                return jsonify({"error": "Trial already used or started", "status": row[0]}), 403

            # Start 3-day trial
            trial_end = datetime.now() + timedelta(days=3)
            trial_str = trial_end.strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("""
                INSERT INTO licenses (email, is_premium, status, trial_end_date, method)
                VALUES (?, 1, 'trialing', ?, 'FreeTrial')
                ON CONFLICT(email) DO UPDATE SET 
                    is_premium=1, 
                    status='trialing', 
                    trial_end_date=excluded.trial_end_date,
                    method='FreeTrial'
            """, (email, trial_str))
            conn.commit()
            
        # Sync to Firestore
        if db:
            try:
                user_ref = db.collection('usuarios').document(uid)
                user_ref.set({
                    'isPremium': True,
                    'status': 'trialing',
                    'trialEndDate': trial_end,
                    'method': 'FreeTrial',
                    'email': email
                }, merge=True)
            except Exception as e:
                print(f"Firebase Trial Sync Error: {e}")
                
        return jsonify({"status": "trialing", "trial_end": trial_str})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            <p style="font-size: 12px; color: #888;">Enviado desde Equalizer – Web Audio Web</p>
        </div>
        """

        params = {
            "from": "Soporte Equalizer – Web Audio <onboarding@resend.dev>",
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
