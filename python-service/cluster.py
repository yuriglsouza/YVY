
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
    
    # Progressive retry: try wider time ranges and coarser scales
    attempts = [
        (30, 20),   # 30 days, 20m scale
        (90, 30),   # 90 days, 30m scale  
        (180, 50),  # 180 days, 50m scale
    ]
    
    last_count = 0
    for days, scale in attempts:
        start_date = end_date - datetime.timedelta(days=days)
        pixels = satellite_analysis.get_sentinel2_pixels(roi, start_date, end_date, scale=scale)
        last_count = len(pixels) if pixels else 0
        if pixels and len(pixels) >= 10:
            print(f"Using {len(pixels)} real Sentinel-2 pixels (range={days}d, scale={scale}m)")
            return pixels
        print(f"Attempt {days}d/{scale}m returned {last_count} pixels, retrying...")
    
    raise ValueError(f"Dados insuficientes do Sentinel-2 ({last_count} pixels após 3 tentativas). Verifique se a área delimitada está correta.")

def cluster_pixels(pixels, k=3):
    # Filter out cloud/shadow pixels (NDVI < 0.05 is almost certainly cloud, water, or shadow)
    clean_pixels = [p for p in pixels if p.get("ndvi") is not None and p["ndvi"] >= 0.05]
    
    if len(clean_pixels) < 10:
        raise ValueError(f"Poucos pixels válidos após filtro de nuvens ({len(clean_pixels)}). A área pode estar coberta por nuvens.")
    
    print(f"Filtered {len(pixels) - len(clean_pixels)} cloud/shadow pixels, {len(clean_pixels)} remaining")
    
    data = np.array([[p["ndvi"], p["ndwi"]] for p in clean_pixels])
    
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
            {"lat": clean_pixels[j]["lat"], "lon": clean_pixels[j]["lon"]} 
            for j in range(len(clean_pixels)) if labels[j] == original_idx
        ]
        
        result_zones.append({
            "id": i,
            "name": names[i] if i < len(names) else f"Zona {i+1}",
            "color": colors[i] if i < len(colors) else "#cccccc",
            "coordinates": cluster_points,
            "ndvi_avg": float(centers[original_idx][0]),
            "area_percentage": len(cluster_points) / len(clean_pixels)
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
