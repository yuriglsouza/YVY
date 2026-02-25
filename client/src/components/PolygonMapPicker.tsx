import { useEffect, useRef, useState, useCallback } from "react";
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

export function PolygonMapPicker({ onChange, initialCenter, initialPolygon }: PolygonMapPickerProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
    const [areaHa, setAreaHa] = useState<number | null>(null);

    const processLayer = useCallback((layer: L.Polygon) => {
        const latlngs = (layer.getLatLngs()[0] as L.LatLng[]);

        // Calculate area in m² using geodesic area
        const areaM2 = L.GeometryUtil
            ? L.GeometryUtil.geodesicArea(latlngs)
            : calculateGeodesicArea(latlngs);

        const ha = areaM2 / 10000;
        setAreaHa(ha);

        // Calculate centroid
        let latSum = 0, lonSum = 0;
        latlngs.forEach(ll => { latSum += ll.lat; lonSum += ll.lng; });
        const centroid = { lat: latSum / latlngs.length, lon: lonSum / latlngs.length };

        // Convert to GeoJSON order [lon, lat]
        const polygon: [number, number][] = latlngs.map(ll => [ll.lng, ll.lat]);
        // Close the ring
        if (polygon.length > 0 && (polygon[0][0] !== polygon[polygon.length - 1][0] || polygon[0][1] !== polygon[polygon.length - 1][1])) {
            polygon.push([...polygon[0]] as [number, number]);
        }

        onChange({ polygon, centroid, areaHa: ha });
    }, [onChange]);

    // Geodesic area fallback (Shoelace formula with Earth radius)
    function calculateGeodesicArea(latlngs: L.LatLng[]): number {
        const R = 6378137; // Earth radius in meters
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

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const center = initialCenter || [-15.79, -47.88]; // Default: Brasília

        const map = L.map(mapContainerRef.current, {
            center: center as [number, number],
            zoom: 14,
            zoomControl: true,
        });
        mapRef.current = map;

        // Satellite tile layer
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles © Esri",
            maxZoom: 19,
        }).addTo(map);

        // Labels overlay
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
            pane: "shadowPane",
        }).addTo(map);

        // Feature group for drawn items
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;

        // Draw control
        const drawControl = new (L.Control as any).Draw({
            position: "topright",
            draw: {
                polygon: {
                    allowIntersection: false,
                    shapeOptions: {
                        color: "#10b981",
                        weight: 3,
                        fillColor: "#10b981",
                        fillOpacity: 0.15,
                    },
                },
                rectangle: {
                    shapeOptions: {
                        color: "#10b981",
                        weight: 3,
                        fillColor: "#10b981",
                        fillOpacity: 0.15,
                    },
                },
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: true,
            },
        });
        map.addControl(drawControl);

        // Handle polygon creation
        map.on(L.Draw.Event.CREATED, (event: any) => {
            drawnItems.clearLayers();
            const layer = event.layer;
            drawnItems.addLayer(layer);
            processLayer(layer as L.Polygon);
        });

        // Handle edit
        map.on(L.Draw.Event.EDITED, (event: any) => {
            const layers = event.layers;
            layers.eachLayer((layer: L.Polygon) => {
                processLayer(layer);
            });
        });

        // Handle delete
        map.on(L.Draw.Event.DELETED, () => {
            setAreaHa(null);
            onChange(null);
        });

        // Load initial polygon if in edit mode
        if (initialPolygon && initialPolygon.length > 0) {
            const latlngs = initialPolygon.map(([lon, lat]) => L.latLng(lat, lon));
            const poly = L.polygon(latlngs, {
                color: "#10b981",
                weight: 3,
                fillColor: "#10b981",
                fillOpacity: 0.15,
            });
            drawnItems.addLayer(poly);
            map.fitBounds(poly.getBounds(), { padding: [30, 30] });
            processLayer(poly);
        }

        // Resize fix (dialog animation may affect map size)
        setTimeout(() => map.invalidateSize(), 300);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-2">
            <div
                ref={mapContainerRef}
                className="w-full h-[300px] rounded-lg border border-border overflow-hidden"
                style={{ zIndex: 0 }}
            />
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
