
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

def predict(farm_id, date_str, temperature=None, temp_modifier=0.0, rain_modifier=0.0, size_ha=0.0):
    model = load_model()
    
    # Preprocess Input
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        print("{\"error\": \"Invalid date format. Use YYYY-MM-DD.\"}")
        sys.exit(1)
        
    day_of_year = date_obj.timetuple().tm_yday
    month = date_obj.month
    
    # Handle temperature
    if temperature is None:
        temperature = 25.0 
    
    # Apply temperature modifier
    temperature += temp_modifier
    
    features = {
        'farm_id': [int(farm_id)],
        'month': [month],
        'day_of_year': [day_of_year],
        'temperature': [float(temperature)]
    }
    
    X_pred = pd.DataFrame(features)
    
    # Predict
    try:
        base_prediction = model.predict(X_pred)[0]
        
        # Apply rain modifier (simulate effect on NDVI)
        # Assuming rain_modifier is a simple index (-1 for drought, +1 for good rain)
        # A good rain might bump NDVI by 0.05, drought decreases it
        ndvi_adj = base_prediction + (rain_modifier * 0.05)
        
        # Cap NDVI between 0 and 1
        ndvi_adj = max(0.0, min(1.0, ndvi_adj))
        
        # Calculate yield estimate (soybean average ~3.5 to 4.5 tons/ha at max NDVI)
        # Yield formula: base_tons_per_ha * ndvi * size
        yield_tons = ndvi_adj * size_ha * 3.8
        
        import json
        result = {
            "prediction": round(float(ndvi_adj), 4),
            "yield_tons": round(float(yield_tons), 2)
        }
        print(json.dumps(result))
        return result
    except Exception as e:
        import json
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict NDVI for a farm on a specific date.")
    parser.add_argument("--farm-id", required=True, help="ID of the farm")
    parser.add_argument("--date", required=True, help="Date in YYYY-MM-DD format")
    parser.add_argument("--temp", type=float, help="Optional temperature for better accuracy", default=None)
    parser.add_argument("--temp-modifier", type=float, help="Modifier for temperature (e.g., +2.0)", default=0.0)
    parser.add_argument("--rain-modifier", type=float, help="Modifier for rain (-1 to 1)", default=0.0)
    parser.add_argument("--size", type=float, help="Farm size in hectares", default=0.0)
    
    args = parser.parse_args()
    
    predict(args.farm_id, args.date, args.temp, args.temp_modifier, args.rain_modifier, args.size)
