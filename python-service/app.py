import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sys
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime

# Import local scripts
# Ensure the current directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import satellite_analysis
import cluster

app = FastAPI()

class PredictionRequest(BaseModel):
    history: List[dict] # Expected keys: date, ndvi, temperature (optional)
    target_date: str

@app.post("/predict")
async def predict_ndvi(req: PredictionRequest):
    try:
        if not req.history or len(req.history) < 5:
             return {"error": "Insufficient history for prediction (need at least 5 points)"}

        # Convert to DataFrame
        df = pd.DataFrame(req.history)
        
        # Preprocessing
        df['date'] = pd.to_datetime(df['date'])
        df['month'] = df['date'].dt.month
        df['day_of_year'] = df['date'].dt.dayofyear
        
        # Target Date Preprocessing
        try:
            target_dt = datetime.strptime(req.target_date, "%Y-%m-%d")
        except ValueError:
             return {"error": "Invalid target_date format. Use YYYY-MM-DD"}

        # Handle Temperature in History (fill missing)
        if 'temperature' not in df.columns:
            df['temperature'] = 25.0
        else:
            df['temperature'] = df['temperature'].fillna(25.0)

        # Features
        features = ['month', 'day_of_year', 'temperature']
        
        # Check if we have all features in history
        if not all(col in df.columns for col in features):
             return {"error": f"Missing columns in history. Required: {features}"}

        X = df[features]
        y = df['ndvi']

        # Train Model (Stateless - trained on request)
        # Using a small n_estimators for speed since we train on every request
        model = RandomForestRegressor(n_estimators=20, random_state=42)
        model.fit(X, y)
        
        # Prepare Target Input
        # For future temperature, we use the average of the history or a default
        avg_temp = df['temperature'].mean()
        
        target_input = pd.DataFrame([{
            'month': target_dt.month,
            'day_of_year': target_dt.timetuple().tm_yday,
            'temperature': avg_temp
        }])

        # Predict
        prediction = model.predict(target_input[features])[0]
        
        return {
            "prediction": float(prediction), 
            "unit": "NDVI", 
            "model": "RandomForest (Stateless)",
            "target_date": req.target_date
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
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

class ClusterRequest(BaseModel):
    lat: float
    lon: float
    size: float
    k: Optional[int] = 3

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
            # Recriar lógica de ROI
            import datetime
            import math
            import ee
            
            # Re-auth needed logic is inside the script, but we might need to handle credentials here
            # if the script's strict ee.Initialize() fails.
            # Assuming env vars are set for Google Application Credentials
            
            # Setup arguments for the function
            point = ee.Geometry.Point([req.lon, req.lat])
            area_m2 = req.size * 10000
            radius_m = math.sqrt(area_m2 / math.pi)
            roi = point.buffer(radius_m)
            
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
        pixels = cluster.generate_mock_pixels(req.lat, req.lon, req.size)
        zones = cluster.cluster_pixels(pixels, req.k)
        return zones
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
