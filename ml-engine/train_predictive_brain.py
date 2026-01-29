import os
import json
import random
import datetime
import pandas as pd
import numpy as np
from supabase import create_client, Client
from dotenv import load_dotenv

# Optional Imports for ML
try:
    import pandas_ta as ta
    from xgboost import XGBClassifier
    ML_AVAILABLE = True
except ImportError:
    print("Warning: ML libraries (pandas_ta, xgboost) not found. Using Mock Engine.")
    ML_AVAILABLE = False

# from darts import TimeSeries
# from darts.models import NBEATSModel 
# Commented out heavy ML libs for initial lightweight testing if needed, 
# but keeping structure ready.

# Load Environment Variables
load_dotenv(dotenv_path="../.env.local")

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Warning: Missing Supabase credentials in .env.local")
    # raise ValueError("Missing Supabase credentials")
    supabase = None
else:
    supabase: Client = create_client(url, key)

def fetch_data(instrument_token, timeframe, limit=500):
    """Fetch historical data from Supabase"""
    if not supabase:
        return pd.DataFrame()
        
    try:
        response = supabase.table("historical_candles") \
            .select("*") \
            .eq("instrument_token", instrument_token) \
            .eq("timeframe", timeframe) \
            .order("timestamp", desc=True) \
            .limit(limit) \
            .execute()
        
        df = pd.DataFrame(response.data)
        if not df.empty:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
            df.sort_index(inplace=True)
        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        return pd.DataFrame()

def generate_mock_prediction(last_price, last_time, horizon=10):
    """Generate a realistic-looking forecast path for testing UI"""
    path = []
    current_price = last_price
    
    # Random trend
    trend = random.choice([1.0005, 0.9995, 1.0000])
    
    start_time = pd.to_datetime(last_time)
    
    for i in range(1, horizon + 1):
        # Add trend + random noise
        change = (random.random() - 0.5) * (last_price * 0.002)
        current_price = current_price * trend + change
        
        future_time = start_time + datetime.timedelta(minutes=5 * i)
        
        path.append({
            "time": future_time.isoformat(),
            "price": round(current_price, 2)
        })
        
    return path

def save_prediction(token, symbol, timeframe, path, high, low, close, confidence):
    """Save prediction to Supabase"""
    if not supabase:
        print("Skipping save (no DB connection)")
        return

    data = {
        "instrument_token": token,
        "tradingsymbol": symbol,
        "timeframe": timeframe,
        "forecast_horizon": "1H",
        "predicted_high": float(high),
        "predicted_low": float(low),
        "predicted_close": float(close),
        "predicted_path": json.dumps(path), # Store as JSON string or object depending on Supabase client handling
        "confidence_score": float(confidence),
        "regime_detected": "TRENDING" if confidence > 70 else "CHOP",
        "model_version": "v1.0-xgboost-darts",
        "prediction_time": datetime.datetime.now().isoformat()
    }
    
    try:
        supabase.table("ai_predictions").insert(data).execute()
        print(f"Saved prediction for {symbol}")
    except Exception as e:
        print(f"Error saving prediction: {e}")

def main():
    print("AiRA Predictive Brain: Engine Started...")
    
    # Sample Instruments to process
    instruments = [
        {"token": 256265, "symbol": "NIFTY 50", "tf": "15m"},
        {"token": 260105, "symbol": "NIFTY BANK", "tf": "15m"}
    ]
    
    for inst in instruments:
        print(f"Processing {inst['symbol']}...")
        
        # 1. Fetch Data
        # df = fetch_data(inst['token'], inst['tf'])
        
        # 2. Train/Predict (Mocking for now to ensure end-to-end flow works first)
        # In real implementation, we would train XGBoost here.
        
        # Mock values based on "Live" price if DB is empty
        last_price = 24500.0 if inst['symbol'] == "NIFTY 50" else 52000.0
        # if not df.empty:
        #     last_price = df.iloc[-1]['close']
            
        path = generate_mock_prediction(last_price, datetime.datetime.now().isoformat())
        
        prices = [p['price'] for p in path]
        pred_high = max(prices)
        pred_low = min(prices)
        pred_close = prices[-1]
        confidence = random.randint(65, 95)
        
        # 3. Save
        save_prediction(
            inst['token'], 
            inst['symbol'], 
            inst['tf'], 
            path, 
            pred_high, 
            pred_low, 
            pred_close, 
            confidence
        )
        
    print("Cycle Complete.")

if __name__ == "__main__":
    main()
