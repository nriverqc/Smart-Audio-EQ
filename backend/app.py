import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import mercadopago
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize MercadoPago using ACCESS TOKEN from environment (.env / Render)
mp_access_token = os.getenv("MP_ACCESS_TOKEN")
if not mp_access_token:
    raise RuntimeError("MP_ACCESS_TOKEN is not set")
sdk = mercadopago.SDK(mp_access_token)

@app.route("/")
def home():
    return "Smart Audio EQ API is running"

@app.route("/create-payment", methods=["POST"])
def create_payment():
    data = request.json or {}
    frontend_url = os.getenv("FRONTEND_URL", "https://example.com")

    preference_data = {
        "items": [
            {
                "title": data.get("item", "Smart Audio EQ Premium"),
                "quantity": 1,
                "unit_price": float(data.get("price", 4.99)),
            }
        ],
        "back_urls": {
            "success": f"{frontend_url}/success",
            "failure": f"{frontend_url}/failure",
            "pending": f"{frontend_url}/pending",
        },
        "auto_return": "approved",
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        payment_url = preference_response["response"]["init_point"]
        return jsonify({"payment_url": payment_url})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/webhook/mercadopago", methods=["POST"])
def webhook():
    # Here you would receive the payment notification
    # Verify the payment and update your database (licenses table)
    data = request.json
    print("Received webhook:", data)
    return jsonify({"status": "received"}), 200

@app.route("/check-license", methods=["GET"])
def check_license():
    email = request.args.get("email")
    # Mock check - replace with database lookup
    if email == "demo@premium.com":
        return jsonify({"premium": True})
    return jsonify({"premium": False})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
