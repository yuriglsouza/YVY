import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { Button } from "@/components/ui/button";
import { Pencil, Pentagon, Trash2, Check, X } from "lucide-react";

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
  onInteractionChange?: (active: boolean) => void;
  onChange: (
    data: {
      polygon: [number, number][]; // [[lon,lat], ...] GeoJSON order
      centroid: { lat: number; lon: number };
      areaHa: number;
    } | null,
  ) => void;
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
    area +=
      (latlngs[j].lng - latlngs[i].lng) *
      rad *
      (2 + Math.sin(latlngs[i].lat * rad) + Math.sin(latlngs[j].lat * rad));
  }
  return Math.abs((area * R * R) / 2);
}

export function PolygonMapPicker({
  onChange,
  initialCenter,
  initialPolygon,
  onInteractionChange,
}: PolygonMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [hasPolygon, setHasPolygon] = useState(Boolean(initialPolygon?.length));
  const [mode, setMode] = useState<"idle" | "drawing" | "editing">("idle");
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawHandlerRef = useRef<any>(null);
  const editHandlerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  useEffect(() => {
    onInteractionChange?.(mode !== "idle");
  }, [mode, onInteractionChange]);
  useEffect(
    () => () => {
      onInteractionChange?.(false);
    },
    [onInteractionChange],
  );

  async function doSearch() {
    const query = searchQueryRef.current.trim();
    const map = mapInstanceRef.current;
    if (!query || !map) return;
    setSearching(true);
    setSearchError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, boundingbox } = data[0];
        if (boundingbox) {
          map.fitBounds([
            [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
            [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])],
          ]);
        } else {
          map.flyTo([parseFloat(lat), parseFloat(lon)], 15, { duration: 1.5 });
        }
        setSearchError("");
      } else {
        setSearchError(
          "Local não encontrado. Tente uma cidade ou bairro (ex: Uberlândia, MG).",
        );
      }
    } catch (err) {
      setSearchError("Erro na busca. Verifique sua conexão.");
    } finally {
      setSearching(false);
    }
  }

  const processLayer = useCallback((layer: L.Polygon) => {
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];

    // Calculate area
    let areaM2: number;
    try {
      areaM2 = L.GeometryUtil.geodesicArea(latlngs);
    } catch {
      areaM2 = calculateGeodesicArea(latlngs);
    }

    const ha = areaM2 / 10000;
    setHasPolygon(true);

    // Centroid
    let latSum = 0,
      lonSum = 0;
    latlngs.forEach((ll) => {
      latSum += ll.lat;
      lonSum += ll.lng;
    });
    const centroid = {
      lat: latSum / latlngs.length,
      lon: lonSum / latlngs.length,
    };

    // GeoJSON order [lon, lat], close the ring
    const polygon: [number, number][] = latlngs.map((ll) => [ll.lng, ll.lat]);
    if (polygon.length > 0) {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        polygon.push([first[0], first[1]]);
      }
    }

    onChangeRef.current({ polygon, centroid, areaHa: ha });
  }, []);

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

    // Google Maps Hybrid (Satélite + Ruas/Rótulos)
    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      attribution: "© Google",
      maxZoom: 20,
    }).addTo(map);

    // Feature group for drawings
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const labels = (L as any).drawLocal;
    labels.draw.handlers.polygon.tooltip = {
      start: "Clique para começar a desenhar.",
      cont: "Clique para adicionar outro ponto.",
      end: "Clique no primeiro ponto para concluir.",
    };
    labels.draw.handlers.polyline.error =
      "Os limites da área não podem se cruzar.";
    labels.edit.handlers.edit.tooltip = {
      text: "Arraste os pontos para ajustar o limite.",
      subtext: "Clique em Aplicar limite para confirmar.",
    };
    // Named buttons outside the map replace the small icon-only toolbar.
    drawHandlerRef.current = new (L.Draw as any).Polygon(map, {
      allowIntersection: false,
      shapeOptions: {
        color: "#10b981",
        weight: 3,
        fillColor: "#10b981",
        fillOpacity: 0.15,
      },
    });
    editHandlerRef.current = new (L as any).EditToolbar.Edit(map, {
      featureGroup: drawnItems,
    });
    map.on("draw:drawstop", () => setMode("idle"));

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
      setHasPolygon(false);
      onChangeRef.current(null);
    });

    // Load existing polygon
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
      // Opening or revisiting a section must not change saved coordinates/area.
      setHasPolygon(true);
    }

    // CRITICAL: Force resize after dialog animation completes
    // Leaflet needs the container to have dimensions to render properly
    const resizeInterval = setInterval(() => {
      map.invalidateSize();
    }, 100);

    const resizeTimeout = setTimeout(() => {
      clearInterval(resizeInterval);
      map.invalidateSize();
      setMapReady(true);
    }, 1000);

    return () => {
      clearInterval(resizeInterval);
      clearTimeout(resizeTimeout);
      drawHandlerRef.current?.disable();
      editHandlerRef.current?.disable();
      map.remove();
      mapInstanceRef.current = null;
      drawnItemsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doSearch();
            }
          }}
          aria-label="Buscar cidade ou endereço"
          placeholder="Buscar cidade ou endereço"
          className="min-w-0 flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() => doSearch()}
          disabled={searching || !searchQuery.trim()}
          className="h-10 px-4 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {searchError && (
        <p role="alert" className="text-sm text-red-400">
          {searchError}
        </p>
      )}
      <div
        role="group"
        className="flex flex-wrap gap-2"
        aria-label="Ferramentas da área"
      >
        {mode === "idle" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!mapReady}
              onClick={() => {
                drawHandlerRef.current?.enable();
                setMode("drawing");
              }}
            >
              <Pentagon className="mr-2 h-4 w-4" />
              {hasPolygon ? "Redesenhar área" : "Desenhar área"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!mapReady || !hasPolygon}
              onClick={() => {
                editHandlerRef.current?.enable();
                setMode("editing");
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar limite
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!mapReady || !hasPolygon}
              onClick={() => {
                drawnItemsRef.current?.clearLayers();
                setHasPolygon(false);
                onChangeRef.current(null);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar desenho
            </Button>
          </>
        ) : (
          <>
            {mode === "editing" && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => {
                  editHandlerRef.current?.save();
                  editHandlerRef.current?.disable();
                  setMode("idle");
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Aplicar limite
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                drawHandlerRef.current?.disable();
                editHandlerRef.current?.revertLayers();
                editHandlerRef.current?.disable();
                setMode("idle");
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar {mode === "drawing" ? "desenho" : "edição"}
            </Button>
          </>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {mode === "drawing"
          ? "Clique nos cantos da área. Para concluir, clique novamente no primeiro ponto."
          : mode === "editing"
            ? "Arraste os pontos do limite e clique em Aplicar limite."
            : "Busque a localização e desenhe o contorno da propriedade."}
      </p>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", position: "relative", zIndex: 0 }}
        className="h-[320px] sm:h-[420px] rounded-xl border border-border overflow-hidden"
      />
      {!mapReady && (
        <div className="text-xs text-muted-foreground animate-pulse">
          🗺️ Carregando mapa de satélite...
        </div>
      )}
    </div>
  );
}
