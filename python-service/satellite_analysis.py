import ee
import sys
import json
import datetime
import math
import argparse

# Inicializa o Earth Engine (Lazy Loading)
def init_earth_engine(project_id=None, credentials=None):
    try:
        print(f"Earth Engine Init: Attempting to initialize (Project: {project_id})...")
        
        # Priority 1: Explicit Credentials Object
        if credentials:
            print("Earth Engine Init: Using provided ServiceAccountCredentials object.")
            ee.Initialize(credentials=credentials, project=project_id)
        # Priority 2: Project ID only (relies on env var)
        elif project_id:
             print("Earth Engine Init: Using project_id and default credentials.")
             ee.Initialize(project=project_id)
        # Priority 3: Default (local auth)
        else:
             print("Earth Engine Init: Using default initialization.")
             ee.Initialize()
             
        print("Earth Engine initialized successfully.")
    except Exception as e:
        print(f"Error: Earth Engine init failed: {e}")
        # Não tentamos mais ee.Authenticate() aqui porque no servidor (Render) não temos browser/gcloud
        # Apenas logamos o erro fatal
        print(json.dumps({"error": f"Falha crítica na inicialização do Earth Engine: {str(e)}"}))


def mask_s2_clouds(image):
    """Máscara de nuvens para Sentinel-2 usando a banda QA60."""
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000)

def get_sentinel2_indices(roi, start_date, end_date):
    """Calcula índices espectrais baseados no Sentinel-2 (NDVI, NDWI, NDRE)."""
    s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterDate(start_date, end_date) \
        .filterBounds(roi) \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80)) \
        .map(mask_s2_clouds)

    # Cria um mosaico usando a mediana (bom para remover nuvens residuais)
    # ou o pixel mais verde (greenest pixel)
    composite = s2.median().clip(roi)
    
    # Se a composição estiver vazia (muitas nuvens/sem imagem), retorna None
    # Verificação simples: contar bandas
    # Nota: Em script local/servidor, verificar se a imagem tem dados pode ser complexo sem getInfo(),
    # mas assumiremos que se a coleção não for vazia, o composite terá dados.
    
    # NDVI = (NIR - Red) / (NIR + Red) -> (B8 - B4) / (B8 + B4)
    ndvi = composite.normalizedDifference(['B8', 'B4']).rename('ndvi')
    
    # NDWI = (Green - NIR) / (Green + NIR) -> (B3 - B8) -> Usando McFeeters
    # Ou Gao: (NIR - SWIR) / (NIR + SWIR) -> (B8 - B11) - Melhor para água em vegetação
    ndwi = composite.normalizedDifference(['B8', 'B11']).rename('ndwi')
    
    # NDRE = (NIR - RedEdge1) / (NIR + RedEdge1) -> (B8 - B5)
    # Sentinel-2: RedEdge1 é B5.
    ndre = composite.normalizedDifference(['B8', 'B5']).rename('ndre')
    
    return ndvi, ndwi, ndre, composite

def get_sentinel1_indices(roi, start_date, end_date):
    """Calcula índices de radar baseados no Sentinel-1 (RVI)."""
    s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')) \
        .filter(ee.Filter.eq('instrumentMode', 'IW')) \
        .filterDate(start_date, end_date) \
        .filterBounds(roi)
    
    # Mosaico temporal (média)
    # As bandas vêm em DB, converter para linear para cálculos
    # Mas RVI empírico para S1: 4 * VH / (VV + VH) usualmente feito em linear
    
    def to_linear(image):
        return ee.Image(10).pow(image.select(['VV', 'VH']).divide(10))

    s1_linear = s1.map(to_linear).mean().clip(roi)
    
    vv = s1_linear.select('VV')
    vh = s1_linear.select('VH')
    
    # RVI approximation: 4 * VH / (VV + VH)
    rvi = vh.multiply(4).divide(vv.add(vh)).rename('rvi')
    
    return rvi


    return rvi


def get_sentinel3_indices(roi, start_date, end_date):
    """Calcula índices baseados no Sentinel-3 OLCI (OTCI - Clorofila)."""
    # COPERNICUS/S3/OLCI: Sentinel-3 OLCI EFR
    s3 = ee.ImageCollection('COPERNICUS/S3/OLCI') \
        .filterDate(start_date, end_date) \
        .filterBounds(roi)
    
    def mask_s3_clouds(image):
        # quality_flags: Bit 27 is cloud
        # 1 << 27
        qa = image.select('quality_flags')
        cloud_bit_mask = 1 << 27
        mask = qa.bitwiseAnd(cloud_bit_mask).eq(0)
        return image.updateMask(mask)

    # OTCI = (Oa12 - Oa11) / (Oa11 - Oa10)
    # FALLBACK: Oa10 (681nm) is corrupt in some regions (-2B value). 
    # Using Oa08 (665nm) as Red reference.
    
    s3_masked = s3.select(['Oa12_radiance', 'Oa11_radiance', 'Oa08_radiance'])

    # Cast to double AND mask invalid/negative values (garbage/nodata)
    def clean_s3(img):
        img = img.toDouble()
        # Filter out garbage noise (negative radiance)
        mask = img.gt(0).And(img.lt(500)) 
        return img.updateMask(mask.reduce(ee.Reducer.allNonZero()))

    s3_masked = s3_masked.map(clean_s3)

    # Use max() or median()
    composite = s3_masked.median().clip(roi)
    
    oa12 = composite.select('Oa12_radiance')
    oa11 = composite.select('Oa11_radiance')
    # oa10 = composite.select('Oa10_radiance')
    oa08 = composite.select('Oa08_radiance')
    
    # DEBUG: Print S3 mean values
    stats = composite.select(['Oa12_radiance', 'Oa11_radiance', 'Oa08_radiance']).reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=roi,
        scale=300,
        maxPixels=1e9
    )
    print(f"DEBUG S3 (Internal): {json.dumps(stats.getInfo())}", file=sys.stderr)

    # Avoid division by zero
    denominator = oa11.subtract(oa08)
    # mask denominator if close to zero
    otci = oa12.subtract(oa11).divide(denominator).rename('otci')
    
    # Clamp negative values to 0 (No Chlorophyll/Invalid)
    otci = otci.where(otci.lt(0), 0)
    
    return otci

def analyze_farm(roi, start_date, end_date, size_ha):
    """
    Executa a análise completa para a fazenda.
    """
    # Datas
    end_date_str = end_date.strftime('%Y-%m-%d')
    start_date_str = start_date.strftime('%Y-%m-%d')

    # Definir Contexto Visual (Zoom Out)
    # Raio aproximado da fazenda
    radius_approx = math.sqrt(size_ha * 10000) / math.sqrt(math.pi)
    
    # Para visualização MODIS (1km pixel), precisamos de uma área muuuito maior para ver algo.
    # Para Sentinel-2, um contexto local é bom.
    # Vamos usar um raio mínimo de 5000m (5km) para garantir contexto térmico, 
    # mas mantendo a proporção para fazendas gigantes.
    visual_radius = max(radius_approx * 2, 5000) 
    
    # Definir Contexto Visual (Zoom Out)
    
    # 1. ROI para RGB (O "Perfeito"): Baseado no tamanho da fazenda + margem
    radius_farm = math.sqrt(size_ha * 10000) / math.sqrt(math.pi)
    rgb_radius = radius_farm * 2.0 # 100% de margem (contexto local)
    rgb_roi = roi.buffer(rgb_radius).bounds() # Quadrado local
    
    # 2. ROI para Térmico (O "Grande"): Mínimo de 5km para ver gradientes MODIS
    thermal_radius = max(radius_farm * 3, 5000) # Mínimo 5km
    thermal_roi = roi.buffer(thermal_radius).bounds() # Quadrado gigante

    try:
        # 1. Buscar imagens sobre a maior área necessária (Thermal ROI)
        # Assim garantimos dados para ambos.
        # Sentinel-2: Podemos buscar só na rgb_roi se quisermos economizar, mas thermal usamos thermal_roi
        # Para simplificar e evitar erros de "out of bounds", vamos buscar S2 na rgb_roi e MODIS na thermal_roi.
        
        ndvi_img, ndwi_img, ndre_img, composite = get_sentinel2_indices(rgb_roi, start_date_str, end_date_str)
        rvi_img = get_sentinel1_indices(rgb_roi, start_date_str, end_date_str)
        
        # Sentinel-2 OTCI Proxy
        # OTCI = (B6 - B5) / (B5 - B4)
        s2_b6 = composite.select('B6')
        s2_b5 = composite.select('B5')
        s2_b4 = composite.select('B4')
        
        # Avoid div zero
        otci_denom = s2_b5.subtract(s2_b4)
        # S2 OTCI
        otci_img = s2_b6.subtract(s2_b5).divide(otci_denom).rename('otci')

        # 2. Calcular estatísticas apenas sobre a área da FAZENDA (ROI exata, o circulo pequeno)
        # Include OTCI in stats
        stats_s2 = ee.Image([ndvi_img, ndwi_img, ndre_img, otci_img]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi, 
            scale=10, 
            maxPixels=1e9
        )
        
        stats_s1 = rvi_img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=10, 
            maxPixels=1e9
        )



        # MODIS (LST)
        val_s3 = {'lst': None}
        lst_img = None
        try:
            # Buscar Landsat LST (Alta Resolução)
            lst_img, l8_coll = get_landsat_lst(thermal_roi, start_date_str, end_date_str)
            
            stats_s3 = lst_img.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=roi, # Stats na ROI original
                scale=100, # Landsat Thermal is 100m (resampled to 30m but physics is 100m)
                maxPixels=1e9
            )
            val_s3 = stats_s3.getInfo()
        except Exception as e:
            sys.stderr.write(f"Warning: Landsat LST access failed (skipping thermal): {e}\n")

        # Combinar resultados (getInfo traz para o cliente Python)
        val_s2 = stats_s2.getInfo()
        val_s1 = stats_s1.getInfo()
        # val_otci now from S2
        val_otci = {'otci': val_s2.get('otci', 0)}
        # val_s3 já está definido acima
        
        # Gerar URL da imagem (Visualização RGB)
        # Estratégia Híbrida: Usar pixels limpos onde possível, preencher buracos com a mediana bruta (nuvens)
        # Isso evita os "buracos pretos" na imagem.
        
        # 1. Recuperar a mediana bruta (sem máscara de nuvens) para preenchimento
        # Precisamos da coleção original s2 (sem map mask). 
        # Como s2 já foi mapeado, vamos reconstruir rapidinho a visualização bruta ou usar a s2 mascarada unmasked?
        # A s2 original não está acessível aqui facilmente sem refazer a query.
        # Melhor abordagem: Unmask com valor constante ou refazer query leve.
        # Vamos passar 's2_raw' se possível? Não, vamos simplificar.
        # Unmask com 0.3 (cinza claro) é melhor que preto? Ou tentar pegar pixels vizinhos?
        # Vamos assumir que 'composite' tem buracos.
        
        visual_rgb = composite.select(['B4', 'B3', 'B2']).visualize(min=0, max=0.3)
        
        # Obter Bounds da Imagem para Overlay no Frontend
        # O bounds() do ee.Geometry retorna um Polygon.
        # Precisamos das coords min/max dele.
        rgb_bounds_info = rgb_roi.getInfo()['coordinates'][0]
        # rgb_bounds_info é [[lon, lat], ...]
        lons = [p[0] for p in rgb_bounds_info]
        lats = [p[1] for p in rgb_bounds_info]
        # Leaflet espera [[lat1, lon1], [lat2, lon2]] (SouthWest, NorthEast)
        # Vamos retornar: [[min_lat, min_lon], [max_lat, max_lon]]
        bounds_overlay = [[min(lats), min(lons)], [max(lats), max(lons)]]
        
        # Preencher fundo transparente (buracos) com cinza muito claro (nuvem/sem dados)
        # background = ee.Image.constant(0.9).visualize(min=0, max=1) # Branco quase
        # visual_filled = background.blend(visual_rgb) 
        # O blend coloca o visual_rgb POR CIMA do background. Onde visual_rgb é mascarado, aparece o background.
        
        # Melhor: Tentar mostrar nuvens reais seria ideal, mas exige reutilizar a s2_collection.
        # Vamos apenas garantir que não fique "quebrado" (preto/transparente).
        
        try:
            # Usar rgb_roi (Contexto Local) para RGB - o "Perfeito"
            
            # Forçar a região exata (ROI expandida) evita distorções
            thumb_url = visual_rgb.getThumbURL({
                'dimensions': 600, 
                'format': 'jpg',   
                'region': rgb_roi      # CRÍTICO: Define o bounding box com contexto local
            })
            # Gerar URL Térmica (LST)
            # Paleta: Azul (Frio) -> Verde -> Amarelo -> Vermelho (Quente)
            # Range: 20°C a 50°C (ajustável)
            val_lst = val_s3.get('lst')
            thermal_url = None
            
            if lst_img is not None and val_lst is not None:
                # Ajuste Dinâmico de Contraste
                # O LST costuma variar pouco numa região pequena.
                # Se usarmos range fixo 10-50, tudo fica da mesma cor.
                # Vamos focar no intervalo: Média +/- 3 graus (ou 5)
                min_vis = val_lst - 3.0
                max_vis = val_lst + 3.0
                
                palette = ['0000ff', '00ffff', '00ff00', 'ffff00', 'ff0000']
                visual_thermal = lst_img.visualize(min=min_vis, max=max_vis, palette=palette)
                
                try:
                    thermal_url = visual_thermal.getThumbURL({
                        'dimensions': 600,
                        'format': 'jpg',
                        'region': thermal_roi # Usa a região GRANDE
                    })
                except Exception as e:
                     sys.stderr.write(f"Warning: Failed to generate thermal thumb URL: {e}\n")
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to generate thumb URL: {e}\n")
            thumb_url = None
            thermal_url = None
        

        # Tratar casos onde não há imagem (valores None/Null)
        result = {
            "date": end_date_str,
            "ndvi": val_s2.get('ndvi', 0) if val_s2.get('ndvi') is not None else 0,
            "ndwi": val_s2.get('ndwi', 0) if val_s2.get('ndwi') is not None else 0,
            "ndre": val_s2.get('ndre', 0) if val_s2.get('ndre') is not None else 0,
            "rvi": val_s1.get('rvi', 0) if val_s1.get('rvi') is not None else 0,
            "temperature": val_s3.get('lst', 0) if val_s3.get('lst') is not None else 0,
            "otci": val_otci.get('otci', 0) if val_otci.get('otci') is not None else 0,
            "satellite_image": thumb_url,
            "thermal_image": thermal_url,
            "bounds": bounds_overlay # Adicionando Bounds
        }
        
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

def get_landsat_lst(roi, start_date, end_date):
    """Calcula Temperatura da Superfície (LST) usando Landsat 8/9 (100m resolution)."""
    # Landsat 8/9 Level 2, Collection 2, Tier 1
    l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    
    landsat = l9.merge(l8) \
        .filterDate(start_date, end_date) \
        .filterBounds(roi) \
        .filter(ee.Filter.lt('CLOUD_COVER', 60))
        
    def to_celsius(image):
        # Band ST_B10 is Surface Temperature
        # Scale: 0.00341802, Offset: 149.0
        # Kelvin = DN * 0.00341802 + 149.0
        st = image.select('ST_B10').multiply(0.00341802).add(149.0)
        celsius = st.subtract(273.15).rename('lst')
        return image.addBands(celsius)

    # QA Masking helps, but median handles clean pixels well usually.
    # Let's keep it simple with median.
    
    processed = landsat.map(to_celsius)
    
    # Check if empty handled by caller? 
    # Mosaico da média (ou mediana)
    landsat_mean = processed.select('lst').median().clip(roi)
    
    return landsat_mean, processed



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Análise de Satélite YVY')
    parser.add_argument('--lat', type=float, required=True, help='Latitude da fazenda')
    parser.add_argument('--lon', type=float, required=True, help='Longitude da fazenda')
    parser.add_argument('--size', type=float, required=True, help='Tamanho em Hectares')
    
    args = parser.parse_args()
    
    # Ensure EE is initialized for CLI usage
    init_earth_engine()
    
    # Recriar lógica de ROI e Datas que foi apagada
    area_m2 = args.size * 10000
    radius_m = math.sqrt(area_m2 / math.pi)
    
    point = ee.Geometry.Point([args.lon, args.lat])
    roi = point.buffer(radius_m)
    
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=30)

    analyze_farm(roi, start_date, end_date, args.size)

def get_sentinel2_pixels(roi, start_date, end_date, scale=20):
    """
    Fetches raw Sentinel-2 pixels (NDVI, NDWI) for clustering.
    Scale=20m is a good compromise between precision and performance (S2 is 10m).
    """
    try:
        # Reuse existing logic to get images
        ndvi_img, ndwi_img, ndre_img, composite = get_sentinel2_indices(roi, start_date, end_date)
        
        # Create a stack of bands we want to cluster on
        stack = ndvi_img.addBands(ndwi_img).addBands(ee.Image.pixelLonLat())
        
        # Sample the region
        # using sample() instead of reduceRegion allows us to get individual points
        # sample() with geometry samples within the geometry
        
        # Limit precision to avoid massive payloads for large farms
        # 100ha at 10m = 10,000 points. Manageable.
        # But let's verify scale.
        
        pixels = stack.sample(
            region=roi,
            scale=scale,  # 20m resolution (4 pixels of 10m combined approx)
            projection='EPSG:4326',
            geometries=True # We need coordinates
        )
        
        # Get data to client side
        data = pixels.getInfo()
        
        # Transform to list of dicts
        result = []
        if 'features' in data:
            for f in data['features']:
                props = f['properties']
                result.append({
                    "lat": props.get('latitude'),
                    "lon": props.get('longitude'),
                    "ndvi": props.get('ndvi'),
                    "ndwi": props.get('ndwi')
                })
        
        return result
    except Exception as e:
        sys.stderr.write(f"Error fetching S2 pixels: {e}\n")
        return []
