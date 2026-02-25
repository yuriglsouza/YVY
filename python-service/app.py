import os
import json
import math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sys
import ee
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import datetime

# Import local scripts
# Ensure the current directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import satellite_analysis
import cluster

app = FastAPI()

class PredictionRequest(BaseModel):
    history: List[dict]  # Expected keys: date, ndvi, ndwi (optional), temperature (optional)
    target_date: str
    forecast_days: Optional[int] = 30
    temp_modifier: Optional[float] = 0
    rain_modifier: Optional[float] = 0
    size_ha: Optional[float] = 0

def get_season(month: int) -> int:
    """Brazilian seasons: 0=Summer(Dec-Feb), 1=Fall(Mar-May), 2=Winter(Jun-Aug), 3=Spring(Sep-Nov)"""
    if month in [12, 1, 2]: return 0
    if month in [3, 4, 5]: return 1
    if month in [6, 7, 8]: return 2
    return 3

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build ML features from historical readings DataFrame"""
    df = df.sort_values('date').reset_index(drop=True)
    
    # Time features
    df['month'] = df['date'].dt.month
    df['day_of_year'] = df['date'].dt.dayofyear
    df['season'] = df['month'].apply(get_season)
    
    # Lag features (previous NDVI values)
    df['ndvi_lag_1'] = df['ndvi'].shift(1)
    df['ndvi_lag_2'] = df['ndvi'].shift(2)
    df['ndvi_lag_3'] = df['ndvi'].shift(3)
    
    # Trend: slope of last 5 readings
    df['ndvi_trend'] = df['ndvi'].rolling(window=5, min_periods=2).apply(
        lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) >= 2 else 0, raw=False
    )
    
    # NDWI (fill with 0 if missing)
    if 'ndwi' not in df.columns:
        df['ndwi'] = 0.0
    df['ndwi'] = df['ndwi'].fillna(0.0)
    df['ndwi_last'] = df['ndwi'].shift(1)
    
    # Temperature
    if 'temperature' not in df.columns:
        df['temperature'] = 25.0
    df['temperature'] = df['temperature'].fillna(25.0)
    
    # Fill NaN lags with the earliest available value
    df = df.fillna(method='bfill').fillna(method='ffill').fillna(0)
    
    return df

FEATURES = ['month', 'day_of_year', 'season', 'temperature', 
            'ndvi_lag_1', 'ndvi_lag_2', 'ndvi_lag_3', 'ndvi_trend', 'ndwi_last']

@app.post("/predict")
async def predict_ndvi(req: PredictionRequest):
    try:
        if not req.history or len(req.history) < 5:
            return {"error": "Histórico insuficiente para predição (mínimo 5 leituras)"}

        # Convert to DataFrame
        df = pd.DataFrame(req.history)
        df['date'] = pd.to_datetime(df['date'])
        df = build_features(df)
        
        # Train Model
        X = df[FEATURES]
        y = df['ndvi']
        
        model = RandomForestRegressor(n_estimators=50, random_state=42, max_depth=8)
        model.fit(X, y)
        
        # Generate forecast points (every 7 days)
        forecast_days = min(req.forecast_days or 30, 90)
        last_row = df.iloc[-1]
        last_date = df['date'].max()
        avg_temp = df['temperature'].mean()
        
        # Apply modifiers
        temp_adjusted = avg_temp + (req.temp_modifier or 0)
        # Rain affects NDVI trend: positive rain boosts, negative (drought) decreases
        rain_effect = (req.rain_modifier or 0) * 0.03  # ±3% NDVI per rain level
        
        forecast = []
        # Sliding window for lag updates during forecast
        recent_ndvi = list(df['ndvi'].tail(3).values)
        recent_trend = float(last_row.get('ndvi_trend', 0))
        last_ndwi = float(last_row.get('ndwi', 0))
        
        for day_offset in range(7, forecast_days + 1, 7):
            target_dt = last_date + pd.Timedelta(days=day_offset)
            
            target_input = pd.DataFrame([{
                'month': target_dt.month,
                'day_of_year': target_dt.timetuple().tm_yday,
                'season': get_season(target_dt.month),
                'temperature': temp_adjusted,
                'ndvi_lag_1': recent_ndvi[-1],
                'ndvi_lag_2': recent_ndvi[-2] if len(recent_ndvi) >= 2 else recent_ndvi[-1],
                'ndvi_lag_3': recent_ndvi[-3] if len(recent_ndvi) >= 3 else recent_ndvi[-1],
                'ndvi_trend': recent_trend,
                'ndwi_last': last_ndwi
            }])
            
            # Predict with all trees for confidence interval
            predictions_per_tree = np.array([tree.predict(target_input[FEATURES]) for tree in model.estimators_])
            predicted_ndvi = float(np.mean(predictions_per_tree)) + rain_effect
            predicted_ndvi = max(0.0, min(1.0, predicted_ndvi))
            confidence = float(np.std(predictions_per_tree))
            
            forecast.append({
                "date": target_dt.strftime("%Y-%m-%d"),
                "ndvi": round(predicted_ndvi, 4),
                "confidence": round(confidence, 4)
            })
            
            # Update sliding window for next iteration
            recent_ndvi.append(predicted_ndvi)
            if len(recent_ndvi) > 3:
                recent_ndvi.pop(0)
            # Update trend
            recent_trend = (recent_ndvi[-1] - recent_ndvi[0]) / len(recent_ndvi) if len(recent_ndvi) > 1 else 0
        
        # Overall prediction (average of forecast)
        avg_prediction = np.mean([f['ndvi'] for f in forecast])
        
        # Yield estimation (kg/ha based on NDVI correlation)
        # Reference: NDVI 0.8 ≈ 5000 kg/ha (soy), linear scaling
        yield_per_ha = avg_prediction * 6250  # kg/ha
        yield_tons = (yield_per_ha * (req.size_ha or 100)) / 1000
        
        # Trend direction
        if len(forecast) >= 2:
            trend = "up" if forecast[-1]["ndvi"] > forecast[0]["ndvi"] else "down" if forecast[-1]["ndvi"] < forecast[0]["ndvi"] else "stable"
        else:
            trend = "stable"
        
        return {
            "prediction": round(float(avg_prediction), 4),
            "forecast": forecast,
            "trend": trend,
            "yield_tons": round(float(yield_tons), 1),
            "model": "RandomForest (n=50, features=9)",
            "features_used": FEATURES,
            "training_samples": len(df),
            "unit": "NDVI"
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.on_event("startup")
async def startup_event():
    import os
    import json
    from google.oauth2 import service_account

    # Setup Google Credentials from Env Var (for Render)
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    project_id = None
    credentials = None

    if creds_json:
        try:
            creds_data = json.loads(creds_json)
            project_id = creds_data.get("project_id")
            print(f"Auth: Found project_id in JSON: {project_id}")
            
            # Create explicit credentials object
            credentials = service_account.Credentials.from_service_account_info(
                creds_data,
                scopes=["https://www.googleapis.com/auth/earthengine"]
            )
            print("Auth: Created explicit ServiceAccountCredentials object with EE scope.")
            
        except Exception as e:
            print(f"Auth: Error parsing JSON credentials: {e}")

        # Still write to file as backup/standard env var
        creds_path = os.path.abspath("yvy-service-account.json")
        with open(creds_path, "w") as f:
            f.write(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
        print(f"Auth: Service credentials loaded to {creds_path}")
    else:
        print("Auth: No JSON credentials found in env, strictly relying on local auth or default path.")
    
    # Initialize Earth Engine with explicit credentials
    satellite_analysis.init_earth_engine(project_id, credentials)

class SatelliteRequest(BaseModel):
    lat: float
    lon: float
    size: float
    polygon: Optional[list] = None  # [[lon,lat], [lon,lat], ...] GeoJSON order

class ClusterRequest(BaseModel):
    lat: float
    lon: float
    size: float
    k: Optional[int] = 3
    polygon: Optional[list] = None  # [[lon,lat], ...] GeoJSON order

@app.get("/")
def health_check():
    return {"status": "ok", "service": "yvy-python-microservice"}

@app.post("/satellite")
def analyze_satellite(req: SatelliteRequest):
    try:
        # We need to capture stdout from the script or modify the script to return data
        # modifying the script to be importable is better, but it prints to stdout/stderr.
        # For now, let's capture stdout if we call the function directly.
        # Actually satellite_analysis.analyze_farm prints JSON to stdout.
        
        # We will redirect stdout to capture the output
        from io import StringIO
        import contextlib

        f = StringIO()
        with contextlib.redirect_stdout(f):
            # Setup ROI: use polygon if available, otherwise circular buffer
            if req.polygon and len(req.polygon) >= 3:
                roi = ee.Geometry.Polygon([req.polygon])
                print(f"Using polygon ROI with {len(req.polygon)} vertices")
            else:
                point = ee.Geometry.Point([req.lon, req.lat])
                area_m2 = req.size * 10000
                radius_m = math.sqrt(area_m2 / math.pi)
                roi = point.buffer(radius_m)
                print(f"Using circular ROI with radius {radius_m:.0f}m")
            
            end_date = datetime.datetime.now()
            start_date = end_date - datetime.timedelta(days=30)
            
            satellite_analysis.analyze_farm(roi, start_date, end_date, req.size)
            
        output = f.getvalue()
        try:
            # Parse the last line which should be the JSON result
            lines = output.strip().split('\n')
            result = json.loads(lines[-1])
            return result
        except json.JSONDecodeError:
            return {"error": "Failed to parse script output", "raw": output}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cluster")
def analyze_cluster(req: ClusterRequest):
    try:
        pixels = cluster.get_real_pixels(req.lat, req.lon, req.size, polygon=req.polygon)
        zones = cluster.cluster_pixels(pixels, req.k)
        return zones
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Zonas de manejo indisponíveis: {str(e)}")
