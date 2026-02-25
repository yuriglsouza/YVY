
import argparse
import json
import numpy as np
from sklearn.cluster import KMeans

def get_real_pixels(lat, lon, size_ha, polygon=None):
    """
    Fetches real Sentinel-2 pixels from Google Earth Engine for clustering.
    No mock fallback — raises an exception if GEE data is unavailable.
    """
    import satellite_analysis
    import ee
    import datetime
    import math
    
    # Ensure EE is initialized
    try:
        if not ee.data._credentials:
            ee.Initialize(project='yvyorbital')
    except:
        pass

    # ROI: polygon if available, else circular buffer
    if polygon and len(polygon) >= 3:
        roi = ee.Geometry.Polygon([polygon])
        print(f"Using polygon ROI with {len(polygon)} vertices for clustering")
    else:
        area_m2 = size_ha * 10000
        radius_m = math.sqrt(area_m2 / math.pi)
        point = ee.Geometry.Point([lon, lat])
        roi = point.buffer(radius_m)
        print(f"Using circular ROI with radius {radius_m:.0f}m for clustering")
    
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=30)
    
    pixels = satellite_analysis.get_sentinel2_pixels(roi, start_date, end_date, scale=20)
    
    if not pixels or len(pixels) < 10:
        raise ValueError(f"Dados insuficientes do Sentinel-2 ({len(pixels) if pixels else 0} pixels). Tente novamente mais tarde.")
    
    print(f"Using {len(pixels)} real Sentinel-2 pixels for clustering.")
    return pixels

def cluster_pixels(pixels, k=3):
    data = np.array([[p["ndvi"], p["ndwi"]] for p in pixels])
    
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(data)
    centers = kmeans.cluster_centers_
    
    # Sort clusters by NDVI center (Low -> High)
    sorted_indices = np.argsort(centers[:, 0])
    
    result_zones = []
    
    colors = ["#ef4444", "#eab308", "#22c55e"]
    names = ["Baixa Produtividade", "Média Produtividade", "Alta Produtividade"]
    
    for i in range(k):
        original_idx = sorted_indices[i]
        
        cluster_points = [
            {"lat": pixels[j]["lat"], "lon": pixels[j]["lon"]} 
            for j in range(len(pixels)) if labels[j] == original_idx
        ]
        
        result_zones.append({
            "id": i,
            "name": names[i] if i < len(names) else f"Zona {i+1}",
            "color": colors[i] if i < len(colors) else "#cccccc",
            "coordinates": cluster_points,
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
        pixels = get_real_pixels(args.lat, args.lon, args.size)
        zones = cluster_pixels(pixels)
        print(json.dumps(zones))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
