
import pandas as pd
import joblib
import sys
import os
import argparse
from datetime import datetime

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, "../model.pkl")

def load_model():
    if not os.path.exists(model_path):
        print(f"❌ Error: Model not found at {model_path}. Run train_model.py first.")
        sys.exit(1)
    return joblib.load(model_path)

def predict(farm_id, date_str, temperature=None):
    model = load_model()
    
    # Preprocess Input
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        print("❌ Error: Invalid date format. Use YYYY-MM-DD.")
        sys.exit(1)
        
    day_of_year = date_obj.timetuple().tm_yday
    month = date_obj.month
    
    # Construct DF for prediction
    # Features MUST match training: ['farm_id', 'month', 'day_of_year', 'temperature']
    
    # Handle temperature
    if temperature is None:
        # Better: use a default or historical average. For now, use global mean 25.0
        # In a real app, successful prediction needs this input or a lookup.
        temperature = 25.0 
    
    features = {
        'farm_id': [int(farm_id)],
        'month': [month],
        'day_of_year': [day_of_year],
        'temperature': [float(temperature)]
    }
    
    X_pred = pd.DataFrame(features)
    
    # Predict
    try:
        prediction = model.predict(X_pred)[0]
        print(f"🔮 Predicted NDVI for Farm {farm_id} on {date_str}: {prediction:.4f}")
        return prediction
    except Exception as e:
        print(f"❌ Error during prediction: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict NDVI for a farm on a specific date.")
    parser.add_argument("--farm-id", required=True, help="ID of the farm")
    parser.add_argument("--date", required=True, help="Date in YYYY-MM-DD format")
    parser.add_argument("--temp", type=float, help="Optional temperature for better accuracy", default=None)
    
    args = parser.parse_args()
    
    predict(args.farm_id, args.date, args.temp)
