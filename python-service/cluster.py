
import argparse
import json
import base64
import io
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

def cluster_pixels(pixels, k=3, return_internals=False):
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
        
    if return_internals:
        return result_zones, labels, sorted_indices, clean_pixels
    return result_zones

def generate_raster_image(pixels, labels, sorted_indices, k=3):
    """
    Generates a transparent PNG raster image from K-Means classified pixels.
    Each pixel is painted with the solid color of its zone.
    Returns: (base64_png_string, [[lat_min, lon_min], [lat_max, lon_max]])
    """
    from PIL import Image

    # Zone colors (RGBA) matching the K-Means zone order
    zone_colors_rgba = [
        (239, 68, 68, 160),   # Red   - Baixa Produtividade
        (234, 179, 8, 160),   # Yellow - Média Produtividade
        (34, 197, 94, 160),   # Green  - Alta Produtividade
    ]

    # Build mapping from original cluster index to sorted zone index
    mapping = {int(sorted_indices[new_idx]): new_idx for new_idx in range(k)}

    # Extract lat/lon arrays
    lats = np.array([p["lat"] for p in pixels])
    lons = np.array([p["lon"] for p in pixels])

    lat_min, lat_max = float(lats.min()), float(lats.max())
    lon_min, lon_max = float(lons.min()), float(lons.max())

    # Determine grid resolution based on the data spread
    # Use unique sorted values to figure out the grid step
    unique_lats = np.sort(np.unique(np.round(lats, 6)))
    unique_lons = np.sort(np.unique(np.round(lons, 6)))

    rows = len(unique_lats)
    cols = len(unique_lons)

    # Safety: cap resolution to avoid giant images
    if rows > 200:
        rows = 200
    if cols > 200:
        cols = 200
    
    # Minimum sensible size
    rows = max(rows, 5)
    cols = max(cols, 5)

    # Create RGBA image (transparent by default)
    img = Image.new("RGBA", (cols, rows), (0, 0, 0, 0))
    img_pixels = img.load()

    # Map each data point to its grid cell and paint it
    for idx, p in enumerate(pixels):
        # Normalize lat/lon to grid row/col
        if lat_max == lat_min:
            row = 0
        else:
            # Flip row: lat increases upward but image row 0 is top
            row = int((1.0 - (p["lat"] - lat_min) / (lat_max - lat_min)) * (rows - 1))
        
        if lon_max == lon_min:
            col = 0
        else:
            col = int((p["lon"] - lon_min) / (lon_max - lon_min) * (cols - 1))
        
        row = max(0, min(rows - 1, row))
        col = max(0, min(cols - 1, col))

        zone_idx = mapping.get(int(labels[idx]), 0)
        color = zone_colors_rgba[zone_idx] if zone_idx < len(zone_colors_rgba) else (128, 128, 128, 160)
        img_pixels[col, row] = color

    # Scale up the image for smoother look (nearest neighbor to keep crisp zones)
    scale_factor = max(1, 400 // max(rows, cols))
    if scale_factor > 1:
        img = img.resize((cols * scale_factor, rows * scale_factor), Image.NEAREST)

    # Export to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    b64 = base64.b64encode(buffer.read()).decode("utf-8")

    bounds = [[lat_min, lon_min], [lat_max, lon_max]]
    return f"data:image/png;base64,{b64}", bounds

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
