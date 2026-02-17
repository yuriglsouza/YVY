
import argparse
import json
import numpy as np
from sklearn.cluster import KMeans

def generate_mock_pixels(lat, lon, size_ha):
    """
    Generates a grid of mock pixels for the farm.
    In a real scenario, this would load the actual GeoTIFF/Matrix from Earth Engine.
    """
    try:
        # Try to import local satellite analysis to get REAL pixes
        import satellite_analysis
        import ee
        import datetime
        import math
        
        # Initialize EE if not already (safeguard)
        try:
            if not  ee.data._credentials:
                ee.Initialize(project='yvyorbital')
        except:
            pass # Expect app.py to have initialized it

        # ROI Logic
        area_m2 = size_ha * 10000
        radius_m = math.sqrt(area_m2 / math.pi)
        point = ee.Geometry.Point([lon, lat])
        roi = point.buffer(radius_m)
        
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=30)
        
        # Fetch Real Pixels!
        pixels = satellite_analysis.get_sentinel2_pixels(roi, start_date, end_date, scale=20)
        
        if pixels and len(pixels) > 10:
             print(f"Using {len(pixels)} real Sentinel-2 pixels for clustering.")
             return pixels
             
    except Exception as e:
        print(f"Warning: Failed to get real satellite pixels ({e}), falling back to mock")

    # Fallback to Mock if GEE fails or returns empty
    # 1 hectare approx 100x100m. 
    # Let's generate a 20x20 grid (400 points) to simulate the field
    lats = np.linspace(lat - 0.005, lat + 0.005, 20)
    lons = np.linspace(lon - 0.005, lon + 0.005, 20)
    
    pixels = []
    for i, lt in enumerate(lats):
        for j, ln in enumerate(lons):
            # Create a pattern: center is healthier (higher NDVI)
            dist_center = np.sqrt((i-10)**2 + (j-10)**2)
            base_ndvi = 0.8 - (dist_center * 0.05) 
            ndvi = max(0.1, min(0.9, base_ndvi + np.random.normal(0, 0.05)))
            
            # NDWI loosely correlated
            ndwi = -0.2 + (ndvi * 0.1) + np.random.normal(0, 0.02)
            
            pixels.append({
                "lat": lt,
                "lon": ln,
                "ndvi": ndvi,
                "ndwi": ndwi
            })
    return pixels

def cluster_pixels(pixels, k=3):
    data = np.array([[p["ndvi"], p["ndwi"]] for p in pixels])
    
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(data)
    centers = kmeans.cluster_centers_
    
    # Sort clusters by NDVI center (Low -> High)
    # This ensures cluster 0 is always "Low Vigor" and cluster k-1 is "High Vigor"
    sorted_indices = np.argsort(centers[:, 0])
    mapping = {old_idx: new_idx for new_idx, old_idx in enumerate(sorted_indices)}
    
    result_zones = []
    
    # Colors for 3 zones: Red, Yellow, Green
    colors = ["#ef4444", "#eab308", "#22c55e"]
    names = ["Baixa Produtividade", "Média Produtividade", "Alta Produtividade"]
    
    for i in range(k):
        original_idx = sorted_indices[i]
        
        # Filter points belonging to this cluster
        cluster_points = [
            {"lat": pixels[j]["lat"], "lon": pixels[j]["lon"]} 
            for j in range(len(pixels)) if labels[j] == original_idx
        ]
        
        result_zones.append({
            "id": i,
            "name": names[i] if i < len(names) else f"Zona {i+1}",
            "color": colors[i] if i < len(colors) else "#cccccc",
            "coordinates": cluster_points, # Using points for heatmap/circles
            "ndvi_avg": float(centers[original_idx][0]),
            "area_percentage": len(cluster_points) / len(pixels)
        })
        
    return result_zones

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--size", type=float, required=True)
    args = parser.parse_args()
    
    try:
        pixels = generate_mock_pixels(args.lat, args.lon, args.size)
        zones = cluster_pixels(pixels)
        print(json.dumps(zones))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
