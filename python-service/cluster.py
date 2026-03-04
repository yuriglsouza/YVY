
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

def generate_raster_image(pixels, labels, sorted_indices, k=3, polygon=None):
    """
    Generates a smooth transparent PNG raster image from K-Means classified pixels.
    Uses scipy spatial interpolation to fill the entire area with smooth zone colors.
    If polygon is provided, clips the image to the farm boundary.
    Returns: (base64_png_string, [[lat_min, lon_min], [lat_max, lon_max]])
    """
    from PIL import Image, ImageFilter, ImageDraw
    from scipy.interpolate import griddata

    # Zone colors (RGBA) matching the K-Means zone order
    zone_colors_rgba = [
        (239, 68, 68, 140),   # Red   - Baixa Produtividade
        (234, 179, 8, 140),   # Yellow - Média Produtividade
        (34, 197, 94, 140),   # Green  - Alta Produtividade
    ]

    # Build mapping from original cluster index to sorted zone index
    mapping = {int(sorted_indices[new_idx]): new_idx for new_idx in range(k)}

    # Extract lat/lon and zone labels
    lats = np.array([p["lat"] for p in pixels])
    lons = np.array([p["lon"] for p in pixels])
    zone_labels = np.array([mapping.get(int(labels[i]), 0) for i in range(len(pixels))])

    lat_min, lat_max = float(lats.min()), float(lats.max())
    lon_min, lon_max = float(lons.min()), float(lons.max())

    # Add small padding to bounds (2% of range)
    lat_pad = (lat_max - lat_min) * 0.02
    lon_pad = (lon_max - lon_min) * 0.02
    lat_min -= lat_pad
    lat_max += lat_pad
    lon_min -= lon_pad
    lon_max += lon_pad

    # Create a dense output grid (200x200 for smooth look)
    grid_res = 200
    grid_lats = np.linspace(lat_max, lat_min, grid_res)  # top to bottom
    grid_lons = np.linspace(lon_min, lon_max, grid_res)
    grid_lon_mesh, grid_lat_mesh = np.meshgrid(grid_lons, grid_lats)

    # Interpolate zone labels onto the dense grid using nearest-neighbor
    grid_zones = griddata(
        points=np.column_stack([lons, lats]),
        values=zone_labels,
        xi=(grid_lon_mesh, grid_lat_mesh),
        method='nearest'
    )

    # Paint the image
    img = Image.new("RGBA", (grid_res, grid_res), (0, 0, 0, 0))
    img_pixels = img.load()

    for row in range(grid_res):
        for col in range(grid_res):
            zone_idx = int(grid_zones[row, col])
            color = zone_colors_rgba[zone_idx] if zone_idx < len(zone_colors_rgba) else (128, 128, 128, 140)
            img_pixels[col, row] = color

    # Apply a slight gaussian blur to smooth hard edges between zones
    img = img.filter(ImageFilter.GaussianBlur(radius=2))

    # Clip to farm polygon if available
    if polygon and len(polygon) >= 3:
        # Convert polygon geo coords [lon, lat] to image pixel coords [col, row]
        poly_pixels = []
        for coord in polygon:
            # coord is [lon, lat] in GeoJSON order
            lon_coord, lat_coord = coord[0], coord[1]
            col = int((lon_coord - lon_min) / (lon_max - lon_min) * (grid_res - 1))
            row = int((lat_max - lat_coord) / (lat_max - lat_min) * (grid_res - 1))
            col = max(0, min(grid_res - 1, col))
            row = max(0, min(grid_res - 1, row))
            poly_pixels.append((col, row))
        
        # Create a mask: white inside polygon, black outside
        mask = Image.new("L", (grid_res, grid_res), 0)
        draw = ImageDraw.Draw(mask)
        draw.polygon(poly_pixels, fill=255)
        
        # Apply slight blur to mask edges for smoother clip
        mask = mask.filter(ImageFilter.GaussianBlur(radius=1))
        
        # Apply mask to image alpha channel
        r, g, b, a = img.split()
        # Multiply existing alpha with mask
        a = Image.fromarray(np.minimum(np.array(a), np.array(mask)).astype(np.uint8))
        img = Image.merge("RGBA", (r, g, b, a))

    # Export to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
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
