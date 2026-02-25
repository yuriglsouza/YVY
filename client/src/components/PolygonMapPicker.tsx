import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

// leaflet-draw extends L namespace but has no @types package
declare module "leaflet" {
    namespace Draw {
        const Event: {
            CREATED: string;
            EDITED: string;
            DELETED: string;
        };
    }
    namespace GeometryUtil {
        function geodesicArea(latlngs: L.LatLng[]): number;
    }
}

interface PolygonMapPickerProps {
    onChange: (data: {
        polygon: [number, number][];      // [[lon,lat], ...] GeoJSON order
        centroid: { lat: number; lon: number };
        areaHa: number;
    } | null) => void;
    initialCenter?: [number, number]; // [lat, lon]
    initialPolygon?: [number, number][]; // [[lon,lat], ...] for edit mode
}

// Geodesic area fallback (Shoelace formula with Earth radius)
function calculateGeodesicArea(latlngs: L.LatLng[]): number {
    const R = 6378137;
    const rad = Math.PI / 180;
    let area = 0;
    const n = latlngs.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += (latlngs[j].lng - latlngs[i].lng) * rad *
            (2 + Math.sin(latlngs[i].lat * rad) + Math.sin(latlngs[j].lat * rad));
    }
    return Math.abs(area * R * R / 2);
}

export function PolygonMapPicker({ onChange, initialCenter, initialPolygon }: PolygonMapPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const [areaHa, setAreaHa] = useState<number | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);

    const handleSearch = useCallback(async (e?: FormEvent) => {
        e?.preventDefault();
        if (!searchQuery.trim() || !mapInstanceRef.current) return;
        setSearching(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
            );
            const data = await res.json();
            if (data.length > 0) {
                const { lat, lon, boundingbox } = data[0];
                if (boundingbox) {
                    mapInstanceRef.current.fitBounds([
                        [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
                        [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])],
                    ]);
                } else {
                    mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 15, { duration: 1.5 });
                }
            }
        } catch (err) {
            console.error("Geocoding error:", err);
        } finally {
            setSearching(false);
        }
    }, [searchQuery]);

    const processLayer = useCallback((layer: L.Polygon) => {
        const latlngs = (layer.getLatLngs()[0] as L.LatLng[]);

        // Calculate area
        let areaM2: number;
        try {
            areaM2 = L.GeometryUtil.geodesicArea(latlngs);
        } catch {
            areaM2 = calculateGeodesicArea(latlngs);
        }

        const ha = areaM2 / 10000;
        setAreaHa(ha);

        // Centroid
        let latSum = 0, lonSum = 0;
        latlngs.forEach(ll => { latSum += ll.lat; lonSum += ll.lng; });
        const centroid = { lat: latSum / latlngs.length, lon: lonSum / latlngs.length };

        // GeoJSON order [lon, lat], close the ring
        const polygon: [number, number][] = latlngs.map(ll => [ll.lng, ll.lat]);
        if (polygon.length > 0) {
            const first = polygon[0];
            const last = polygon[polygon.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                polygon.push([first[0], first[1]]);
            }
        }

        onChange({ polygon, centroid, areaHa: ha });
    }, [onChange]);

    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container) return;

        // Destroy previous map if it exists
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        const center: [number, number] = initialCenter || [-15.79, -47.88];

        // Create map
        const map = L.map(container, {
            center: center,
            zoom: 14,
            zoomControl: true,
        });
        mapInstanceRef.current = map;

        // Satellite tiles
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles © Esri",
            maxZoom: 19,
        }).addTo(map);

        // Labels
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
            pane: "shadowPane",
        }).addTo(map);

        // Feature group for drawings
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Draw control
        const drawControl = new (L.Control as any).Draw({
            position: "topright",
            draw: {
                polygon: {
                    allowIntersection: false,
                    shapeOptions: { color: "#10b981", weight: 3, fillColor: "#10b981", fillOpacity: 0.15 },
                },
                rectangle: {
                    shapeOptions: { color: "#10b981", weight: 3, fillColor: "#10b981", fillOpacity: 0.15 },
                },
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
            },
            edit: { featureGroup: drawnItems, remove: true },
        });
        map.addControl(drawControl);

        // Events
        map.on(L.Draw.Event.CREATED, (event: any) => {
            drawnItems.clearLayers();
            drawnItems.addLayer(event.layer);
            processLayer(event.layer as L.Polygon);
        });

        map.on(L.Draw.Event.EDITED, (event: any) => {
            event.layers.eachLayer((layer: L.Polygon) => processLayer(layer));
        });

        map.on(L.Draw.Event.DELETED, () => {
            setAreaHa(null);
            onChange(null);
        });

        // Load existing polygon
        if (initialPolygon && initialPolygon.length > 0) {
            const latlngs = initialPolygon.map(([lon, lat]) => L.latLng(lat, lon));
            const poly = L.polygon(latlngs, {
                color: "#10b981", weight: 3, fillColor: "#10b981", fillOpacity: 0.15,
            });
            drawnItems.addLayer(poly);
            map.fitBounds(poly.getBounds(), { padding: [30, 30] });
            processLayer(poly);
        }

        // CRITICAL: Force resize after dialog animation completes
        // Leaflet needs the container to have dimensions to render properly
        const resizeInterval = setInterval(() => {
            map.invalidateSize();
        }, 100);

        setTimeout(() => {
            clearInterval(resizeInterval);
            map.invalidateSize();
            setMapReady(true);
        }, 1000);

        return () => {
            clearInterval(resizeInterval);
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
                    placeholder="🔍 Buscar endereço, cidade ou fazenda..."
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={searching || !searchQuery.trim()}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {searching ? "..." : "Ir"}
                </button>
            </div>
            <div
                ref={mapContainerRef}
                style={{ width: "100%", height: "300px", position: "relative", zIndex: 0 }}
                className="rounded-lg border border-border overflow-hidden"
            />
            {!mapReady && (
                <div className="text-xs text-muted-foreground animate-pulse">
                    🗺️ Carregando mapa de satélite...
                </div>
            )}
            {areaHa !== null && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Área calculada:</span>
                    <span className="font-mono font-bold text-emerald-400">{areaHa.toFixed(2)} ha</span>
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                💡 Use as ferramentas no canto superior direito para desenhar um polígono ou retângulo delimitando a área da fazenda.
            </p>
        </div>
    );
}
