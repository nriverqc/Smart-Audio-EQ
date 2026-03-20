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

# Initialize Firebase Admin
cred = None
db = None
try:
    if not firebase_admin._apps:
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if sa_json:
            cred = credentials.Certificate(json.loads(sa_json))
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("Firebase Admin Initialized (env)")
        elif os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("Firebase Admin Initialized (file)")
        else:
            print("WARNING: Firebase credentials not found. Firestore updates will fail.")
    else:
        db = firestore.client()
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
    return "Equalizer – Web Audio API is running (v1.2.0 - Clean)"

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
        uid = data.get("uid")
        order_id = data.get("orderID")
        subscription_id = data.get("subscriptionID")
        plan_type = data.get("plan_type", "monthly")

        if not email or not uid:
            return jsonify({"error": "Missing email or uid"}), 400

        now = datetime.now()
        expiration_date = now + (timedelta(days=366) if plan_type == "yearly" else timedelta(days=31))
        status = "active"
        method = "PayPal"
        payment_id = order_id

        if subscription_id:
            token = get_paypal_access_token()
            if not token:
                return jsonify({"error": "PayPal Auth Failed"}), 500

            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription_id}", headers=headers)
            if resp.status_code != 200:
                return jsonify({"error": "Failed to verify subscription"}), resp.status_code

            sub_data = resp.json()
            sub_status = sub_data.get("status")
            if sub_status not in ["ACTIVE", "APPROVED"]:
                return jsonify({"error": f"Subscription status is {sub_status}"}), 400

            billing_info = sub_data.get("billing_info", {}) or {}
            next_billing_time = billing_info.get("next_billing_time")
            if next_billing_time:
                try:
                    expiration_date = datetime.strptime(next_billing_time, "%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    expiration_date = now + (timedelta(days=366) if plan_type == "yearly" else timedelta(days=31))

            payment_id = subscription_id
            method = "PayPal_Subscription"

        elif order_id:
            verified, _ = verify_paypal_order(order_id)
            if not verified:
                return jsonify({"error": "PayPal order verification failed"}), 400

            payment_id = f"PAYPAL_{order_id}"

        else:
            return jsonify({"error": "Missing orderID or subscriptionID"}), 400

        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO licenses (email, is_premium, status, payment_id, expiration_date, method)
                VALUES (?, 1, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    is_premium=1,
                    status=excluded.status,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date,
                    method=excluded.method
                """,
                (
                    email.strip().lower(),
                    status,
                    payment_id,
                    expiration_date.strftime("%Y-%m-%d %H:%M:%S"),
                    method,
                ),
            )
            conn.commit()

        if db:
            try:
                db.collection("usuarios").document(uid).set(
                    {
                        "email": email.strip().lower(),
                        "isPremium": True,
                        "status": status,
                        "method": method,
                        "paymentId": payment_id,
                        "planType": plan_type,
                        "expirationDate": expiration_date,
                        "lastPayment": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )
            except Exception as e:
                print(f"Firebase Update Error (PayPal): {e}")

        return jsonify({"status": "approved", "expiration": expiration_date.strftime("%Y-%m-%d %H:%M:%S")})
    except Exception as e:
        print(f"Register PayPal Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/paddle-webhook", methods=["POST"])
@app.route("/paddle-webhook/", methods=["POST"])
def paddle_webhook():
    try:
        payload = request.json or {}
        event_type = payload.get("event_type") or payload.get("eventType")
        data = payload.get("data") or {}

        if not event_type:
            return jsonify({"status": "ignored", "reason": "no_event_type"}), 200

        custom_data = data.get("custom_data") or data.get("customData") or {}
        if isinstance(custom_data, str):
            try:
                custom_data = json.loads(custom_data)
            except Exception:
                custom_data = {}

        email = (custom_data.get("email") or (data.get("customer") or {}).get("email") or data.get("customer_email"))
        uid = (custom_data.get("uid") or custom_data.get("user_id") or custom_data.get("userId"))

        if not email:
            return jsonify({"status": "ignored", "reason": "no_email"}), 200

        email_norm = email.strip().lower()

        def parse_iso_dt(value):
            if not value:
                return None
            if isinstance(value, datetime):
                return value
            if hasattr(value, "to_datetime"):
                try:
                    return value.to_datetime()
                except Exception:
                    return None
            s = str(value)
            s = s.replace("Z", "")
            if "." in s:
                s = s.split(".", 1)[0]
            try:
                return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S")
            except Exception:
                return None

        items = data.get("items") or []
        price_id = None
        for item in items:
            pinfo = item.get("price") or {}
            price_id = item.get("price_id") or pinfo.get("id")
            if price_id:
                break

        plan_type = "monthly"
        if price_id == "pri_01kk2mxf0828y5x7p8bky7ch47":
            plan_type = "yearly"
        elif price_id == "pri_01kk2mvgj2pmjfh0pkjatsv8bf":
            plan_type = "monthly"

        now = datetime.now()

        is_premium = False
        status = "free"
        trial_end_date = None
        expiration_date = None

        if event_type in [
            "subscription.created",
            "subscription.trialing",
            "subscription.activated",
            "subscription.updated",
            "transaction.paid",
            "transaction.completed",
        ]:
            paddle_status = data.get("status") or ("trialing" if event_type == "subscription.trialing" else "active")

            billing_period = data.get("current_billing_period") or {}
            expires_at = billing_period.get("ends_at") or billing_period.get("end_at") or data.get("next_billed_at")
            expiration_date = parse_iso_dt(expires_at)

            trial_ends_at = data.get("trial_ends_at") or data.get("trial_end") or billing_period.get("ends_at")
            if paddle_status == "trialing" or event_type == "subscription.trialing":
                trial_end_date = parse_iso_dt(trial_ends_at) or (now + timedelta(days=3))

            if trial_end_date and now < trial_end_date:
                is_premium = True
                status = "trialing"
            else:
                is_premium = True
                status = "active"

        elif event_type in [
            "subscription.canceled",
            "subscription.past_due",
            "transaction.payment_failed",
            "transaction.canceled",
        ]:
            is_premium = False
            status = "canceled" if event_type in ["subscription.canceled", "transaction.canceled"] else "past_due"

        else:
            return jsonify({"status": "ignored", "event": event_type}), 200

        payment_id = data.get("id") or data.get("subscription_id") or data.get("transaction_id")

        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO licenses (email, is_premium, status, payment_id, expiration_date, trial_end_date, method)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    is_premium=excluded.is_premium,
                    status=excluded.status,
                    payment_id=excluded.payment_id,
                    expiration_date=excluded.expiration_date,
                    trial_end_date=excluded.trial_end_date,
                    method=excluded.method
                """,
                (
                    email_norm,
                    1 if is_premium else 0,
                    status,
                    f"PADDLE_{payment_id}" if payment_id else None,
                    expiration_date.strftime("%Y-%m-%d %H:%M:%S") if expiration_date else None,
                    trial_end_date.strftime("%Y-%m-%d %H:%M:%S") if trial_end_date else None,
                    "Paddle",
                ),
            )
            conn.commit()

        if db:
            update_data = {
                "email": email_norm,
                "isPremium": is_premium,
                "status": status,
                "method": "Paddle",
                "paymentId": payment_id,
                "planType": plan_type,
                "lastPayment": firestore.SERVER_TIMESTAMP,
            }
            if expiration_date:
                update_data["expirationDate"] = expiration_date
            if trial_end_date:
                update_data["trialEndDate"] = trial_end_date

            if uid:
                try:
                    db.collection("usuarios").document(uid).set(update_data, merge=True)
                except Exception as e:
                    print(f"Firebase Paddle update error (uid): {e}")

            try:
                docs = db.collection("usuarios").where("email", "==", email_norm).limit(10).get()
                for d in docs:
                    db.collection("usuarios").document(d.id).set(update_data, merge=True)
            except Exception as e:
                print(f"Firebase Paddle update error (email): {e}")

            try:
                db.collection("licenses_by_email").document(email_norm).set(
                    {**update_data, "uid": uid or None}, merge=True
                )
            except Exception as e:
                print(f"Firebase Paddle update error (licenses_by_email): {e}")

        return jsonify({"status": "ok"}), 200

    except Exception as e:
        print(f"Paddle Webhook Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/check-license", methods=["GET"])
def check_license():
    email = request.args.get("email")
    uid = request.args.get("uid")
    
    if not email:
        return jsonify({"premium": False, "error": "No email provided"})
        
    print(f"Checking license for: {email} (v1.2.0 - Clean Logic)")

    try:
        # 1. Check Firestore FIRST if UID is provided (Direct User Match)
        if db and uid:
            user_ref = db.collection('usuarios').document(uid)
            doc = user_ref.get()
            if doc.exists:
                data = doc.to_dict()
                status = data.get('status', 'free')
                is_premium_db = data.get('isPremium', False)
                method = data.get('method', 'Unknown')
                
                email_norm = email.strip().lower()

                if not is_premium_db:
                    try:
                        lic_doc = db.collection('licenses_by_email').document(email_norm).get()
                        if lic_doc.exists:
                            lic = lic_doc.to_dict() or {}
                            if lic.get('isPremium') is True:
                                user_ref.set({
                                    'isPremium': True,
                                    'status': lic.get('status', 'active'),
                                    'expirationDate': lic.get('expirationDate'),
                                    'trialEndDate': lic.get('trialEndDate'),
                                    'method': lic.get('method', 'Paddle'),
                                    'paymentId': lic.get('paymentId'),
                                    'planType': lic.get('planType'),
                                    'email': email_norm
                                }, merge=True)
                                data = user_ref.get().to_dict()
                                status = data.get('status')
                                is_premium_db = True
                                method = data.get('method', method)
                    except Exception as e:
                        print(f"Email license lookup error: {e}")

                if not is_premium_db:
                    users_by_email = db.collection('usuarios').where('email', '==', email_norm).where('isPremium', '==', True).limit(1).get()
                    if len(users_by_email) > 0:
                        premium_doc = users_by_email[0].to_dict()
                        p_method = premium_doc.get('method', 'Restored')
                        user_ref.set({
                            'isPremium': True,
                            'status': premium_doc.get('status', 'active'),
                            'expirationDate': premium_doc.get('expirationDate'),
                            'trialEndDate': premium_doc.get('trialEndDate'),
                            'method': p_method,
                            'paymentId': premium_doc.get('paymentId'),
                            'planType': premium_doc.get('planType'),
                            'email': email_norm
                        }, merge=True)
                        data = user_ref.get().to_dict()
                        status = data.get('status')
                        is_premium_db = True
                        method = p_method

                # Manual deactivation in DB
                if is_premium_db is False and status not in ['trialing', 'active']:
                    with sqlite3.connect(DB_NAME) as conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE licenses SET is_premium=0, status='free', method=NULL, trial_end_date=NULL, expiration_date=NULL WHERE email=?", (email,))
                        conn.commit()
                    return jsonify({"premium": False, "status": "free", "source": "firestore_override"})
                
                # Logic for expiration...
                exp_date = data.get('expirationDate')
                trial_end = data.get('trialEndDate')
                
                now = datetime.now()
                
                # RE-VALIDATE STATUS based on dates
                if trial_end:
                    if now > trial_end:
                        status = 'expired_trial'
                        is_premium_db = False
                    else:
                        status = 'trialing'
                        is_premium_db = True
                
                elif exp_date:
                    if now > exp_date:
                        status = 'past_due'
                        is_premium_db = False
                    else:
                        status = 'active'
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
                    """, (email, 1 if is_premium_db else 0, status, exp_str, trial_str, method))
                    conn.commit()
                
                return jsonify({
                    "premium": is_premium_db,
                    "status": status,
                    "method": method,
                    "source": "firestore",
                    "trial_end": trial_str,
                    "expiration": exp_str
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
    """Manually restore purchase using a Payment ID or Payer Email"""
    try:
        data = request.json or {}
        email = data.get("email") # Current logged in user
        uid = data.get("uid")
        payment_id = data.get("payment_id")
        payer_email = data.get("payer_email")
        
        if not email or not uid:
            return jsonify({"error": "Missing user data"}), 400
            
        print(f"Restore Purchase Request: {email} (UID: {uid}) - ID: {payment_id} - Payer: {payer_email}")

        # 1. Search in Firestore for this Payment ID or Payer Email
        if db:
            query = None
            if payment_id:
                query = db.collection('usuarios').where('paymentId', '==', payment_id).limit(1)
            elif payer_email:
                query = db.collection('usuarios').where('email', '==', payer_email).where('isPremium', '==', True).limit(1)
            
            if query:
                docs = query.get()
                for doc in docs:
                    data_db = doc.to_dict()
                    if data_db.get('isPremium') is True:
                        p_method = data_db.get('method', 'Restored')
                        p_status = data_db.get('status', 'active')
                        
                        # Fix for Trial: If trialEndDate exists and is in the future, status MUST be trialing
                        trial_end = data_db.get('trialEndDate')
                        if trial_end:
                            # Handle both datetime and Timestamp objects
                            trial_dt = trial_end if isinstance(trial_end, datetime) else trial_end.to_datetime()
                            if datetime.now() < trial_dt:
                                p_status = 'trialing'

                        user_ref = db.collection('usuarios').document(uid)
                        user_ref.set({
                            'isPremium': True,
                            'status': p_status,
                            'expirationDate': data_db.get('expirationDate'),
                            'trialEndDate': data_db.get('trialEndDate'),
                            'method': p_method,
                            'paymentId': data_db.get('paymentId'),
                            'restoredFrom': doc.id
                        }, merge=True)
                        
                        return jsonify({
                            "status": "restored", 
                            "message": "¡Suscripción encontrada y restaurada! 🚀",
                            "premium": True
                        })

        # 2. Search in SQLite if Firestore fails (Legacy or fast cache)
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            if payment_id:
                cursor.execute("SELECT email, status, expiration_date, method FROM licenses WHERE payment_id = ? OR payment_id = ?", (payment_id, f"PADDLE_{payment_id}"))
            elif payer_email:
                cursor.execute("SELECT email, status, expiration_date, method FROM licenses WHERE email = ?", (payer_email,))
            else:
                return jsonify({"status": "not_found", "message": "No se proporcionaron datos de búsqueda."})
                
            row = cursor.fetchone()
            if row:
                found_email, status, expiration, method = row
                # Re-verify if actually premium
                if status in ['active', 'trialing']:
                    # Sync to Firestore for current user
                    if db:
                        user_ref = db.collection('usuarios').document(uid)
                        user_ref.set({
                            'isPremium': True,
                            'status': status,
                            'method': method,
                            'paymentId': payment_id or found_email,
                            'email': email # Use current email
                        }, merge=True)
                        
                    return jsonify({
                        "status": "restored", 
                        "message": "¡Suscripción restaurada correctamente! 💎",
                        "premium": True
                    })

        return jsonify({"status": "not_found", "message": "No se encontró ninguna suscripción con esos datos."})
        
    except Exception as e:
        print(f"Restore Purchase Error: {e}")
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
