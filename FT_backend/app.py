from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
import yfinance as yf

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

COMPANY_PROFILES = {
    "AAPL": {"name": "Apple", "color": "#A2AAAD", "base_price": 175},
    "TSLA": {"name": "Tesla", "color": "#E82127", "base_price": 250},
    "SPY": {"name": "S&P 500", "color": "#00BFFF", "base_price": 450}
}

@app.route('/')
def home():
    return jsonify({"status": "ready"})

@app.route('/stock/<symbol>')
def get_stock(symbol):
    try:
        # Try real data first
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period="1y")
            prices = hist['Close'].round(2).tolist()
            dates = hist.index.strftime('%Y-%m-%d').tolist()
            is_real = True
        except Exception as e:
            print(f"Using fallback data for {symbol}: {str(e)}")
            profile = COMPANY_PROFILES.get(symbol, COMPANY_PROFILES["SPY"])
            prices = [profile["base_price"] * (1 + 0.005*i + 0.02*np.sin(i/30)) for i in range(365)]
            dates = [(datetime.now() - timedelta(days=365-i)).strftime('%Y-%m-%d') for i in range(365)]
            is_real = False

        # Generate projection dates (next 365 trading days)
        projection_dates = []
        current = datetime.now()
        for _ in range(365):
            current += timedelta(days=1)
            while current.weekday() >= 5:  # Skip weekends
                current += timedelta(days=1)
            projection_dates.append(current.strftime('%Y-%m-%d'))

        return jsonify({
            "symbol": symbol,
            "name": COMPANY_PROFILES.get(symbol, {}).get("name", symbol),
            "color": COMPANY_PROFILES.get(symbol, {}).get("color", "#3b82f6"),
            "history": {"dates": dates, "prices": prices},
            "projection_dates": projection_dates,
            "is_real_data": is_real
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/simulate-next-day', methods=['POST'])
def simulate_day():
    data = request.json
    try:
        current_price = float(data['current_price'])
        mu = float(data.get('mu', 0.1))
        sigma = float(data.get('sigma', 0.2))
        
        dt = 1/252
        shock = sigma * np.sqrt(dt) * np.random.normal()
        new_price = current_price * np.exp((mu - 0.5*sigma**2)*dt + shock)
        
        return jsonify({
            "new_price": round(new_price, 2),
            "shock": round(shock, 4)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(port=5000, debug=True)