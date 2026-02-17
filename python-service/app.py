import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys

# Import local scripts
# Ensure the current directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import satellite_analysis
import cluster

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    import os
    # Setup Google Credentials from Env Var (for Render)
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        creds_path = os.path.abspath("yvy-service-account.json")
        with open(creds_path, "w") as f:
            f.write(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
        print(f"Auth: Service credentials loaded to {creds_path}")
    else:
        print("Auth: No JSON credentials found in env, strictly relying on local auth or default path.")
    
    # Initialize Earth Engine AFTER setting credentials
    satellite_analysis.init_earth_engine()

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
