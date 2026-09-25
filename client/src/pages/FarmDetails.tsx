import React from "react";
import { useDeleteFarm, useFarm, useRefreshReadings } from "@/hooks/use-farms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useReadings, useLatestReading } from "@/hooks/use-readings";
import { useReports, useGenerateReport } from "@/hooks/use-reports";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import {
  ReadingQuality,
  ReadingMetrics,
  FarmHistoryChart,
} from "@/components/farm-reading-panels";
import {
  dailyReadings,
  readingDateLabel,
  reportSourceReading,
} from "@/lib/farm-reading-context";
import type { Report, Reading } from "@shared/schema";
import { flushSync } from "react-dom";
import { Link, useRoute, useLocation } from "wouter";
import { WeatherCard } from "@/components/weather-card";
import { BenchmarkChart } from "@/components/benchmark-chart";
import {
  Loader2,
  RefreshCw,
  FileText,
  Map as MapIcon,
  ChevronLeft,
  BrainCircuit,
  Sprout,
  Ruler,
  Trash2,
  DollarSign,
  Activity,
  Cloud,
  Radio,
  Calendar,
  Beef,
  Scale,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon as LeafletPolygon,
  LayersControl,
  ImageOverlay,
} from "react-leaflet";
import { PredictiveChart } from "@/components/predictive-chart";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ReportConfigDialog,
  ReportConfig,
} from "@/components/report-config-dialog";
import { FinancialAnalysisDialog } from "@/components/financial-analysis-dialog";
import { LivestockFinancialDialog } from "@/components/livestock-financial-dialog";
import { isPasture } from "@shared/livestock-financial";
import { useUser } from "@/hooks/use-user";
import { CropCycleCard } from "@/components/crop-cycle-card";
import { formatAreaHa } from "@/lib/format";
import { FarmVisits } from "@/components/farm-visits";

import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ReportTemplate } from "@/components/ReportTemplate";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@shared/routes";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function FarmDetails() {
  const { toast } = useToast();
  const [match, params] = useRoute("/farms/:id");
  const [location] = useLocation();
  const deleteFarm = useDeleteFarm();

  let farmId = parseInt(params?.id || "0");
  if (!farmId || isNaN(farmId)) {
    const parts = location.replace(/\/$/, "").split("/");
    const lastPart = parts[parts.length - 1];
    if (!isNaN(parseInt(lastPart))) {
      farmId = parseInt(lastPart);
    }
  }

  const { data: user } = useUser();
  const {
    data: farm,
    isLoading: isLoadingFarm,
    error: farmError,
  } = useFarm(farmId);
  const { data: readings } = useReadings(farmId);
  const { data: latestReading } = useLatestReading(farmId);
  const { data: reports } = useReports(farmId);
  const {
    data: latestVisit,
    isPending: isLoadingLatestVisit,
    isError: isLatestVisitError,
  } = useQuery<{ observedOn: string; stage: string } | null>({
    queryKey: ["farm-visit-latest", farmId],
    queryFn: async () => {
      const response = await fetch(`/api/farms/${farmId}/visits/latest`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("Não foi possível consultar a última vistoria.");
      return response.json();
    },
    enabled: farmId > 0,
  });

  const refreshReadings = useRefreshReadings();
  const generateReport = useGenerateReport();
  const [showThermal, setShowThermal] = React.useState(false);
  const [selectedReadingIdx, setSelectedReadingIdx] = React.useState<
    number | null
  >(null);
  const [latestSyncedReadingId, setLatestSyncedReadingId] = React.useState<
    number | null
  >(null);
  const [activeTab, setActiveTab] = React.useState("monitoring");
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [pdfReport, setPdfReport] = React.useState<Report | null>(null);
  const [pdfConfig, setPdfConfig] = React.useState<ReportConfig | undefined>();
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const orderedReports = [...(reports || [])].sort(
    (a, b) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime() ||
      b.id - a.id,
  );

  React.useEffect(() => {
    fetch("https://yvy.onrender.com/ping")
      .then((res) => console.log("Pinged AI Engine:", res.ok))
      .catch((err) => console.debug("AI Ping pending/fail", err));
  }, []);

  const fallbackBounds = React.useMemo(() => {
    if (!farm)
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
          <p>Fazenda não encontrada.</p>
          <Link href="/farms">
            <Button variant="outline">Voltar às fazendas</Button>
          </Link>
        </div>
      );
    if (
      farm.polygon &&
      Array.isArray(farm.polygon) &&
      farm.polygon.length > 0
    ) {
      const coords = farm.polygon as [number, number][]; // [lon, lat]
      const lats = coords.map((c) => c[1]);
      const lons = coords.map((c) => c[0]);
      return [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ];
    }
    const offset = Math.sqrt(farm.sizeHa) * 0.0005;
    return [
      [farm.latitude - offset, farm.longitude - offset],
      [farm.latitude + offset, farm.longitude + offset],
    ];
  }, [farm]);

  const sortedReadings = React.useMemo(
    () =>
      dailyReadings(readings || []).filter((reading) => reading.satelliteImage),
    [readings],
  );

  const mapReading =
    activeTab === "monitoring"
      ? latestReading
      : selectedReadingIdx !== null && sortedReadings[selectedReadingIdx]
        ? sortedReadings[selectedReadingIdx]
        : latestReading;

  interface Zone {
    id: number;
    name: string;
    color: string;
    coordinates: Array<{ lat: number; lon: number }>;
    ndvi_avg: number;
    area_percentage: number;
    areaHa?: number;
  }
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [zonesReadingId, setZonesReadingId] = React.useState<number | null>(
    null,
  );
  const [rasterImage, setRasterImage] = React.useState<string | null>(null);
  const [rasterBounds, setRasterBounds] = React.useState<
    [[number, number], [number, number]] | null
  >(null);
  const [zoneViewMode, setZoneViewMode] = React.useState<
    "both" | "kmeans" | "raster" | "none"
  >("both");

  const { data: zoneHistory } = useQuery({
    queryKey: ["zone-history", farmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${farmId}/zones/history`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const generateZones = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/farms/${farmId}/zones/generate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || data.detail || "Falha ao gerar zonas de manejo",
        );
      }
      return res.json();
    },
    onSuccess: (data) => {
      const zonesArray = Array.isArray(data) ? data : data.zones || data;
      setZones(zonesArray);
      setZonesReadingId(latestReading?.id ?? null);
      if (data.raster_image) {
        setRasterImage(data.raster_image);
        setRasterBounds(data.raster_bounds || null);
      }
      queryClient.invalidateQueries({ queryKey: ["zone-history", farmId] });
      toast({
        title: "Zonas Geradas",
        description:
          "O mapa de manejo foi atualizado com dados reais do Sentinel-2.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Zonas Indisponíveis",
        description:
          err.message ||
          "Dados de satélite insuficientes para gerar zonas de manejo. Tente sincronizar o satélite primeiro.",
        variant: "destructive",
        className: "border-l-4 border-yellow-500",
      });
    },
  });

  if (isLoadingFarm)
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (farmError)
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">
            Erro ao carregar fazenda
          </p>
          <p className="text-muted-foreground text-sm">{farmError.message}</p>
        </div>
      </div>
    );
  if (!farm)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background pl-64 gap-2">
        <p className="text-destructive font-medium text-lg">
          Fazenda não encontrada
        </p>
        <div className="p-4 bg-muted/50 rounded-lg text-xs font-mono text-left space-y-1 border border-border">
          <p>
            <strong>Debug Info:</strong>
          </p>
          <p>URL: {location}</p>
          <p>Params ID: {params?.id || "null"}</p>
          <p>Parsed ID: {farmId}</p>
        </div>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Voltar ao Painel
        </Button>
      </div>
    );

  const handleDownloadPDF = async (report: Report, config?: ReportConfig) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    flushSync(() => {
      setPdfReport(report);
      setPdfConfig(config);
    });
    try {
      if (!reportRef.current)
        throw new Error("Template de relatório não encontrado no DOM");
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      toast({
        title: "Iniciando captura",
        description:
          "O motor está renderizando os gráficos em alta definição...",
      });

      await document.fonts.ready;
      await Promise.race([
        Promise.all(
          Array.from(reportRef.current.querySelectorAll("img")).map((img) =>
            img.decode().catch(() => undefined),
          ),
        ),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdfHeight = doc.internal.pageSize.getHeight();

      for (let page = 0; page < Math.ceil(imgHeight / pdfHeight); page++) {
        if (page > 0) doc.addPage();
        doc.addImage(
          imgData,
          "JPEG",
          0,
          -(pdfHeight * page),
          pdfWidth,
          imgHeight,
        );
      }

      doc.save(
        `SYAZ_Report_Auditoria_${farm?.name || "Fazenda"}_${format(new Date(), "dd-MM-yyyy")}.pdf`,
      );
      toast({
        title: "Relatório de Auditoria Exportado",
        description:
          "O laudo contendo Inteligência Artificial e Biometria visual foi salvo.",
      });
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      toast({
        title: "Erro fatal no Gerador de PDF",
        description: error.message || String(error),
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
      setPdfReport(null);
    }
  };

  const pdfReading = pdfReport
    ? reportSourceReading(pdfReport, readings || [])
    : null;
  const pdfSnapshot = pdfReport?.readingsSnapshot as {
    previousReading?: Reading;
  } | null;
  const pdfHistory = pdfReading
    ? (readings || []).filter((reading) => reading.date <= pdfReading.date)
    : [];

  const satelliteImageCard = mapReading && (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card p-6 rounded-2xl border border-border shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${showThermal ? "bg-red-500" : "bg-blue-500"}`}
          ></span>
          {showThermal ? " Mapa Térmico (LST)" : " Captura do Satélite (RGB)"}
        </h2>
        <div className="flex bg-secondary/30 p-1 rounded-lg gap-1">
          <button
            onClick={() => setShowThermal(false)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              !showThermal
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            RGB
          </button>
          <button
            onClick={() => setShowThermal(true)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              showThermal
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Térmico
          </button>
        </div>
      </div>
      <div className="w-full h-[320px] sm:h-[420px] overflow-hidden rounded-xl border border-border/50 relative group bg-black/95">
        {showThermal ? (
          mapReading.thermalImage ? (
            <>
              {mapReading.thermalImage?.includes(
                "earthengine.googleapis.com",
              ) && (
                <div className="absolute top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-xs text-center py-1 font-medium">
                  Imagem temporária antiga detectada. Sincronize novamente para
                  gerar uma imagem permanente.
                </div>
              )}
              <img
                src={mapReading.thermalImage}
                alt="Satellite View"
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <Cloud className="w-12 h-12 mb-4 opacity-50" />
              <p>Imagem Térmica Indisponível</p>
            </div>
          )
        ) : mapReading.satelliteImage ? (
          <>
            {mapReading.satelliteImage.includes(
              "earthengine.googleapis.com",
            ) && (
              <div className="absolute top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-xs text-center py-1 font-medium">
                Imagem temporária antiga detectada. Sincronize novamente para
                gerar uma imagem permanente.
              </div>
            )}
            <img
              src={mapReading.satelliteImage}
              alt="Satellite View"
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <Cloud className="w-12 h-12 mb-4 opacity-50" />
            <p>Imagem de Satélite Indisponível</p>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-medium">
                {showThermal
                  ? "Temperatura da Superfície (LST)"
                  : "Visualização Cor Verdadeira (TCI)"}
              </p>
              <p className="text-xs opacity-75">
                {showThermal
                  ? "Landsat 8/9 (100m)"
                  : "Sentinel-2 / MODIS Composite"}
                {mapReading.date && (
                  <>
                    {" "}
                    · 📅{" "}
                    {new Date(
                      mapReading.date.slice(0, 10) + "T12:00:00",
                    ).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
            </div>

            {showThermal && mapReading.temperature && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-[10px] font-medium opacity-90">
                  <span>{(mapReading.temperature - 3).toFixed(1)}°C</span>
                  <div className="w-24 h-2 rounded-full bg-gradient-to-r from-[#0000ff] via-[#00ff00] to-[#ff0000] border border-white/20"></div>
                  <span>{(mapReading.temperature + 3).toFixed(1)}°C</span>
                </div>
                <span className="text-[10px] opacity-75">
                  Escala Dinâmica (Média ±3°C)
                </span>
              </div>
            )}
          </div>
        </div>

        {activeTab === "satellite" && sortedReadings.length > 1 && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-[400] w-[calc(100%-20px)] md:w-[350px]">
            <div className="bg-background/90 backdrop-blur text-foreground px-3 py-2 rounded-xl border border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">
                  Comparativo Temporal
                </span>
                <span className="ml-auto text-xs font-mono text-primary">
                  {mapReading?.date
                    ? new Date(
                        mapReading.date + "T12:00:00",
                      ).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                {mapReading && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-background"
                  >
                    NDVI{" "}
                    {mapReading.ndvi?.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(
                    sortedReadings[0].date + "T12:00:00",
                  ).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <input
                  aria-label="Selecionar data da imagem"
                  type="range"
                  min={0}
                  max={sortedReadings.length - 1}
                  value={
                    selectedReadingIdx !== null
                      ? selectedReadingIdx
                      : sortedReadings.length - 1
                  }
                  onChange={(e) =>
                    setSelectedReadingIdx(parseInt(e.target.value))
                  }
                  className="w-full h-1.5 accent-primary cursor-pointer"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(
                    sortedReadings[sortedReadings.length - 1].date +
                      "T12:00:00",
                  ).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="relative flex min-h-screen bg-background [&_.text-muted-foreground]:text-slate-400">
      <Sidebar />
      <MobileNav />
      <main className="min-w-0 flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-x-hidden">
        <div className="mb-6">
          <Link
            href="/farms"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Minhas fazendas
          </Link>
          <div className="flex flex-col xl:flex-row flex-wrap justify-between items-start xl:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {farm.name}
              </h1>
              <div className="flex gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Sprout className="w-3 h-3" /> {farm.cropType}
                </span>
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Ruler className="w-3 h-3" /> {formatAreaHa(farm.sizeHa)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-400">
                    Última sincronização:{" "}
                    <span className="text-slate-200">
                      {farm.lastSyncAt
                        ? new Date(farm.lastSyncAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "Não registrada"}
                    </span>
                  </p>
                  <div className="pt-2 text-sm" aria-live="polite">
                    {latestVisit ? (
                      <>
                        <p>
                          Última vistoria:{" "}
                          <strong>
                            {latestVisit.observedOn
                              .split("-")
                              .reverse()
                              .join("/")}
                          </strong>
                          {latestVisit.stage ? ` · ${latestVisit.stage}` : ""}
                        </p>
                        {latestReading &&
                          latestVisit.observedOn > latestReading.date && (
                            <p className="text-amber-600">
                              A vistoria é mais recente que a leitura de
                              satélite. Confira as observações de campo.
                            </p>
                          )}
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => setActiveTab("visits")}
                        >
                          Ver histórico de vistorias
                        </Button>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        {isLoadingLatestVisit
                          ? "Consultando vistorias…"
                          : isLatestVisitError
                            ? "Última vistoria indisponível no momento."
                            : "Nenhuma vistoria registrada nesta fazenda."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  refreshReadings.mutate(farmId, {
                    onSuccess: (data: any) => {
                      if (data.success === false) {
                        toast({
                          title: "Erro na Sincronização",
                          description:
                            data.message ||
                            "Falha ao processar dados de satélite.",
                          variant: "destructive",
                        });
                        return;
                      }

                      setSelectedReadingIdx(null);
                      if (data.readingId) {
                        setLatestSyncedReadingId(data.readingId);
                      }

                      toast({
                        title: "Sincronização concluída",
                        description:
                          "Nova leitura de satélite registrada. Confira a data e as condições da coleta.",
                      });

                      // Invalidate all related queries to ensure UI is fresh
                      queryClient.invalidateQueries({
                        queryKey: [api.readings.list.path, farmId],
                      });
                      queryClient.invalidateQueries({
                        queryKey: [api.readings.latest.path, farmId],
                      });
                      queryClient.invalidateQueries({
                        queryKey: [api.farms.get.path, farmId],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["benchmark", farmId],
                      });
                    },
                    onError: (err: any) => {
                      toast({
                        title: "Erro na Sincronização",
                        description:
                          err.message ||
                          "Falha crítica ao conectar ao servidor.",
                        variant: "destructive",
                      });
                    },
                  });
                }}
                disabled={refreshReadings.isPending || generateReport.isPending}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 mr-2",
                    refreshReadings.isPending && "animate-spin",
                  )}
                />
                {refreshReadings.isPending
                  ? "Processando Satélite..."
                  : "Sincronizar Satélite"}
              </Button>
              {/*@ts-ignore*/}
              {user?.role === "admin" ||
              user?.subscriptionStatus === "active" ? (
                isPasture(farm.cropType) ? (
                  <LivestockFinancialDialog
                    key={farm.id}
                    farmSizeHa={farm.sizeHa}
                  />
                ) : (
                  <FinancialAnalysisDialog
                    key={farm.id}
                    zones={zones}
                    farmSizeHa={farm.sizeHa}
                  />
                )
              ) : (
                <Link href="/plans">
                  <Button
                    variant="outline"
                    className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 gap-2"
                  >
                    <DollarSign className="w-4 h-4" /> Análise Financeira
                    (Premium)
                  </Button>
                </Link>
              )}
              <details className="relative">
                <summary className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium">
                  Mais ações
                </summary>
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-30 mt-2 grid w-56 gap-2 rounded-xl border border-border bg-card p-3 shadow-xl">
                  {" "}
                  <Button
                    variant="outline"
                    className="rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary"
                    onClick={() =>
                      window.open(
                        `/api/farms/${farmId}/readings/export-csv`,
                        "_blank",
                      )
                    }
                    disabled={!readings || readings.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="rounded-xl"
                        disabled={deleteFarm.isPending}
                      >
                        {deleteFarm.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Excluir {farm.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          A fazenda e seus dados associados serão removidos
                          permanentemente. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={(event) => {
                            event.preventDefault();
                            deleteFarm.mutate(farmId, {
                              onSuccess: () => {
                                toast({
                                  title: "Fazenda excluída",
                                  description:
                                    "A fazenda foi removida com sucesso.",
                                });
                                window.location.href = "/farms";
                              },
                              onError: (error) => {
                                toast({
                                  title: "Erro ao excluir",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              },
                            });
                          }}
                        >
                          Excluir definitivamente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </details>{" "}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex-wrap h-auto justify-start">
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" />
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="satellite">Satélite e histórico</TabsTrigger>
            <TabsTrigger value="visits">Vistorias</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            {(farm?.cropType.toLowerCase().includes("pasto") ||
              farm?.cropType.toLowerCase().includes("pastagem")) && (
              <TabsTrigger
                value="livestock"
                className="gap-2 bg-amber-500/10 text-amber-600 data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              >
                <Beef className="w-4 h-4" />
                Pecuária (Lotação)
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="visits">
            <FarmVisits key={farm.id} farmId={farm.id} />
          </TabsContent>
          <TabsContent value="monitoring">
            <ReadingQuality reading={latestReading} />
            {latestReading && <ReadingMetrics reading={latestReading} />}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
              <div className="min-w-0 space-y-6">
                {satelliteImageCard}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-semibold">
                    Relatórios e observações de campo
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {orderedReports.length
                      ? `Último relatório gerado em ${readingDateLabel(orderedReports[0].date)}. Confira a leitura utilizada na aba Relatórios.`
                      : "Ainda não há relatório de análise para esta fazenda."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("reports")}
                    >
                      Ver relatórios
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("visits")}
                    >
                      Ver vistorias
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("satellite")}
                    >
                      Explorar histórico
                    </Button>
                  </div>
                </div>
              </div>
              <aside className="min-w-0 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <CropCycleCard
                    plantingDate={farm.plantingDate}
                    harvestDate={farm.harvestDate}
                    cropStage={farm.cropStage}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <WeatherCard
                    latitude={farm.latitude}
                    longitude={farm.longitude}
                    cropType={farm.cropType}
                  />
                </motion.div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="satellite" className="space-y-6">
            <p className="text-sm text-slate-400">
              Explore as imagens por data. Os indicadores da visão geral sempre
              correspondem à leitura mais recente.
            </p>
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <div className="min-w-0">{satelliteImageCard}</div>
              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-[360px] sm:h-[420px] relative"
                >
                  <div className="absolute top-4 left-14 z-[400] bg-card/95 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-border/50">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <MapIcon className="w-4 h-4 text-primary" /> Localização
                    </h3>
                  </div>

                  <div className="absolute bottom-10 right-4 z-[400] flex flex-wrap gap-2 justify-end">
                    {zoneHistory && zoneHistory.length > 0 && (
                      <select
                        className="text-xs h-8 px-2 bg-background text-foreground border border-border rounded-md shadow-sm cursor-pointer"
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          if (idx === -1) {
                            setZones([]);
                          } else {
                            const entry = zoneHistory[idx];
                            const mappedZones = entry.zones.map(
                              (z: any, i: number) => ({
                                id: z.id || i,
                                name: z.name,
                                color: z.color,
                                coordinates: z.coordinates,
                                ndvi_avg: z.ndviAvg || 0,
                                area_percentage: z.areaHa
                                  ? z.areaHa / (farm.sizeHa || 1)
                                  : 0,
                                areaHa: z.areaHa || 0,
                              }),
                            );
                            setZones(mappedZones);
                            setZonesReadingId(null);
                          }
                        }}
                        defaultValue="-1"
                      >
                        <option value="-1">📜 Histórico</option>
                        {zoneHistory.map((entry: any, idx: number) => (
                          <option key={idx} value={idx}>
                            {new Date(entry.date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                            {" ("}
                            {entry.zones.length} zonas{")"}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* View Mode Toggle */}
                    {(zones.length > 0 || rasterImage) && (
                      <select
                        className="text-xs h-8 px-2 bg-background text-foreground border border-border rounded-md shadow-sm cursor-pointer"
                        value={zoneViewMode}
                        onChange={(e) =>
                          setZoneViewMode(
                            e.target.value as
                              "both" | "kmeans" | "raster" | "none",
                          )
                        }
                      >
                        <option value="both">🗺️ Raster + Pontos</option>
                        <option value="raster">🖼️ Só Raster</option>
                        <option value="kmeans">⚪ Só Pontos</option>
                        <option value="none">❌ Ocultar Zonas</option>
                      </select>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      className="shadow-sm border border-border/50 text-xs h-8"
                      onClick={() => generateZones.mutate()}
                      disabled={generateZones.isPending}
                    >
                      {generateZones.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <MapIcon className="w-3 h-3 mr-1" />
                      )}
                      Gerar Zonas
                    </Button>
                  </div>

                  <MapContainer
                    center={[farm.latitude, farm.longitude]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer
                        checked
                        name="Google Maps (Satélite + Ruas)"
                      >
                        <TileLayer
                          attribution="&copy; Google Maps"
                          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                          maxZoom={20}
                        />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name="Mapa (Ruas)">
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                      </LayersControl.BaseLayer>

                      {mapReading?.satelliteImage &&
                        (mapReading?.imageBounds || fallbackBounds) && (
                          <LayersControl.Overlay
                            checked
                            name="Imagem de satélite (RGB)"
                          >
                            <ImageOverlay
                              url={mapReading.satelliteImage}
                              bounds={
                                (mapReading.imageBounds ||
                                  fallbackBounds) as unknown as [
                                  [number, number],
                                  [number, number],
                                ]
                              }
                              opacity={0.7}
                            />
                          </LayersControl.Overlay>
                        )}

                      {mapReading?.thermalImage &&
                        (mapReading?.imageBounds || fallbackBounds) && (
                          <LayersControl.Overlay name="Mapa Térmico (LST)">
                            <ImageOverlay
                              url={mapReading.thermalImage}
                              bounds={
                                (mapReading.imageBounds ||
                                  fallbackBounds) as unknown as [
                                  [number, number],
                                  [number, number],
                                ]
                              }
                              opacity={0.7}
                            />
                          </LayersControl.Overlay>
                        )}
                    </LayersControl>

                    {/* Raster Image Overlay (painted zones) */}
                    {zoneViewMode !== "none" &&
                      zoneViewMode !== "kmeans" &&
                      rasterImage &&
                      rasterBounds && (
                        <ImageOverlay
                          url={rasterImage}
                          bounds={
                            rasterBounds as unknown as [
                              [number, number],
                              [number, number],
                            ]
                          }
                          opacity={0.6}
                        />
                      )}

                    {/* Zones Visualization (K-Means Points) */}
                    {zoneViewMode !== "none" &&
                      zoneViewMode !== "raster" &&
                      zones?.map((zone, zIdx) => (
                        <React.Fragment key={`zone-group-${zone.id}`}>
                          {zone.coordinates.map((point, index) => {
                            let zoneLabel = zone.name.charAt(0);
                            if (zone.name.startsWith("Zona ")) {
                              const dirName = zone.name.substring(5);
                              if (dirName.startsWith("Nor"))
                                zoneLabel = dirName.startsWith("Nordeste")
                                  ? "NE"
                                  : "NO";
                              else if (dirName.startsWith("Sud"))
                                zoneLabel = dirName.startsWith("Sudeste")
                                  ? "SE"
                                  : "SO";
                              else zoneLabel = dirName.charAt(0);
                            }

                            const pointIcon = L.divIcon({
                              className: "custom-zone-marker",
                              html: `<div style="background-color: ${zone.color}cc; border: 1px solid ${zone.color}; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold; font-family: sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">${zoneLabel}</div>`,
                              iconSize: [16, 16],
                              iconAnchor: [8, 8],
                            });

                            return (
                              <Marker
                                key={`${zone.id}-${index}`}
                                position={[point.lat, point.lon]}
                                icon={pointIcon}
                              >
                                <Popup>
                                  <div className="text-xs">
                                    <strong>
                                      {zone.name} (T{zIdx + 1})
                                    </strong>
                                    <br />
                                    Área:{" "}
                                    {(zone as any)["areaHa"]
                                      ? (
                                          Number((zone as any)["areaHa"]) *
                                          10000
                                        ).toLocaleString("pt-BR", {
                                          maximumFractionDigits: 0,
                                        })
                                      : "N/A"}{" "}
                                    m²
                                    <br />
                                    Média Saúde:{" "}
                                    {zone.ndvi_avg
                                      ? zone.ndvi_avg.toFixed(2)
                                      : "N/A"}
                                    <br />
                                    Lat: {point.lat.toFixed(6)}
                                    <br />
                                    Lon: {point.lon.toFixed(6)}
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </React.Fragment>
                      ))}

                    <Marker position={[farm.latitude, farm.longitude]}>
                      <Popup>
                        <div className="text-center">
                          <strong>{farm.name}</strong>
                          <br />
                          {formatAreaHa(farm.sizeHa)}
                        </div>
                      </Popup>
                    </Marker>
                    {farm.polygon &&
                    Array.isArray(farm.polygon) &&
                    (farm.polygon as [number, number][]).length >= 3 ? (
                      <LeafletPolygon
                        positions={(farm.polygon as [number, number][]).map(
                          ([lon, lat]) => [lat, lon] as [number, number],
                        )}
                        pathOptions={{
                          color: "#2F447F",
                          fillColor: "#2F447F",
                          fillOpacity: 0.2,
                        }}
                      />
                    ) : (
                      <Circle
                        center={[farm.latitude, farm.longitude]}
                        radius={Math.sqrt((farm.sizeHa * 10000) / Math.PI)}
                        pathOptions={{
                          color: "#2F447F",
                          fillColor: "#2F447F",
                          fillOpacity: 0.2,
                        }}
                      />
                    )}
                  </MapContainer>
                </motion.div>
              </div>
            </div>
            <FarmHistoryChart readings={readings || []} />
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
              <div className="min-w-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  {/*@ts-ignore*/}
                  {user?.role === "admin" ||
                  user?.subscriptionStatus === "active" ? (
                    <PredictiveChart farmId={farmId} />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center bg-muted/10 border border-dashed border-border rounded-xl">
                      <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                        <BrainCircuit className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h3 className="font-bold text-lg mb-1">
                        Agrônomo IA (Premium)
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 text-center max-w-xs">
                        Previsões de safra e análise avançada de produtividade.
                      </p>
                      <Link href="/plans">
                        <Button
                          variant="default"
                          className="bg-emerald-500 hover:bg-emerald-600 text-black"
                        >
                          Desbloquear IA
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              </div>
              <div className="min-w-0">
                <BenchmarkChart farmId={farmId} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="reports" className="space-y-6">
            <p className="text-sm text-slate-400">
              A análise usa a leitura mais recente ao gerar um relatório. Cada
              relatório abaixo mantém seu próprio contexto; relatórios antigos
              ficam no histórico.
            </p>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-card p-6 rounded-2xl border border-border shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-accent" /> Relatórios do
                  agrônomo IA
                </h2>
                <Button
                  onClick={() => {
                    generateReport.mutate(
                      {
                        farmId,
                        sourceReadingId:
                          latestSyncedReadingId || latestReading?.id,
                      },
                      {
                        onSuccess: () => {
                          toast({
                            title: "Análise Gerada",
                            description:
                              "O relatório da fazenda foi atualizado com sucesso.",
                          });
                          // Reset the synced ID after it's used
                          setLatestSyncedReadingId(null);
                          // Invalidate to show new reports
                          queryClient.invalidateQueries({
                            queryKey: [api.reports.list.path, farmId],
                          });
                        },
                        onError: (error: any) => {
                          toast({
                            title: "Erro ao gerar análise",
                            description:
                              error.message ||
                              "Não foi possível gerar a análise com IA no momento.",
                            variant: "destructive",
                          });
                        },
                      },
                    );
                  }}
                  disabled={
                    generateReport.isPending ||
                    refreshReadings.isPending ||
                    !latestReading ||
                    (latestReading.isSimulated &&
                      import.meta.env.MODE === "production")
                  }
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
                  title={
                    latestReading?.isSimulated &&
                    import.meta.env.MODE === "production"
                      ? "Indisponível para dados simulados em produção"
                      : ""
                  }
                >
                  {generateReport.isPending && (
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  )}
                  {generateReport.isPending
                    ? "Analisando..."
                    : "Analisar Dados"}
                </Button>
              </div>

              <div className="space-y-4">
                {reports && reports.length > 0 ? (
                  orderedReports.map((report, index) => {
                    const source = reportSourceReading(report, readings || []);
                    return (
                      <details
                        key={report.id}
                        open={index === 0 ? true : undefined}
                        className="p-4 bg-muted/20 rounded-xl border border-border"
                      >
                        <summary className="cursor-pointer font-medium">
                          Relatório de {readingDateLabel(report.date)}
                          {index === 0 ? " · Mais recente" : ""}
                        </summary>
                        <div className="pt-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                              Relatório gerado
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {readingDateLabel(report.date)}
                            </span>
                          </div>
                          <p className="mb-3 text-sm text-slate-400">
                            Leitura utilizada:{" "}
                            {source
                              ? readingDateLabel(source.date)
                              : "Não identificada neste relatório antigo"}
                            {source && typeof source.ndvi === "number"
                              ? ` · NDVI ${source.ndvi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : ""}
                          </p>
                          {(!source || source.id !== latestReading?.id) && (
                            <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                              Este relatório não está vinculado à leitura mais
                              recente. Consulte a data e a leitura de origem
                              antes de comparar os valores.
                            </p>
                          )}
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mb-4">
                            {report.content}
                          </p>

                          {report.formalContent && (
                            <ReportConfigDialog
                              onGenerate={(config) =>
                                handleDownloadPDF(report, config)
                              }
                              trigger={
                                <Button
                                  disabled={pdfBusy}
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 hover:border-green-500/50 transition-all"
                                >
                                  <FileText className="w-4 h-4 mr-2" />{" "}
                                  {pdfBusy
                                    ? "Preparando PDF..."
                                    : "Baixar PDF Técnico"}
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </details>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum relatório de análise IA ainda. Clique em "Analisar
                    Dados" para gerar um.
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {(farm?.cropType.toLowerCase().includes("pasto") ||
            farm?.cropType.toLowerCase().includes("pastagem")) && (
            <TabsContent
              value="livestock"
              className="space-y-8 animate-in fade-in-50 duration-500"
            >
              {(() => {
                const ndvi = latestReading?.ndvi || 0.1;
                const dryMatterKg =
                  Math.max(0, ndvi) * 3200 * (farm?.sizeHa || 0);

                const availableForage = dryMatterKg * 0.5;
                const capacityUa = availableForage / 360;

                const uaColor =
                  ndvi < 0.3
                    ? "text-red-500"
                    : ndvi > 0.6
                      ? "text-emerald-500"
                      : "text-amber-500";
                const bgUaColor =
                  ndvi < 0.3
                    ? "bg-red-500/10"
                    : ndvi > 0.6
                      ? "bg-emerald-500/10"
                      : "bg-amber-500/10";

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`p-3 rounded-full ${bgUaColor}`}>
                            <Beef className={`w-8 h-8 ${uaColor}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Capacidade de Suporte
                            </p>
                            <h3 className="text-4xl font-black font-mono">
                              {Math.max(0, capacityUa).toFixed(0)}{" "}
                              <span className="text-xl text-muted-foreground">
                                UA
                              </span>
                            </h3>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Lotação máxima segura sustentada por <b>30 dias</b>.
                          (1 UA = 450kg de peso vivo).
                        </p>
                      </div>

                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="p-3 bg-primary/10 rounded-full">
                            <Scale className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Matéria Seca Estimada
                            </p>
                            <h3 className="text-3xl font-bold">
                              {(dryMatterKg / 1000).toFixed(1)}{" "}
                              <span className="text-xl text-muted-foreground">
                                Ton
                              </span>
                            </h3>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Biomassa comestível (forragem) mensurada através da
                          leitura ótica do satélite (NDVI).
                        </p>
                      </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                      <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5" />
                        Como a IA calcula o pastejo?
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        A cor verde da folhagem do pasto contém biomassa
                        estrutural que podemos inferir do espaço. Nossa
                        inteligência converte o índice NDVI da área mapeada em
                        quilos de Matéria Seca (MS). Assumimos uma eficiência de
                        pastejo segura de 50% (o gado come metade, a outra
                        metade garante o rebrote) e dividimos o saldo pelo
                        consumo de um mamífero adulto de 450kg (1 Unidade
                        Animal) ao longo de 1 mês.
                      </p>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
          )}
        </Tabs>

        {/* Hidden Report Template for DOM Capture */}
        {pdfReport && (
          <ReportTemplate
            ref={reportRef}
            farm={farm}
            currentReading={pdfReading}
            previousReading={
              pdfSnapshot?.previousReading?.farmId === farm.id
                ? pdfSnapshot.previousReading
                : null
            }
            historyData={dailyReadings(pdfHistory).map((reading) => ({
              ...reading,
              formattedDate: readingDateLabel(reading.date),
            }))}
            aiReport={pdfReport.formalContent || pdfReport.content}
            consultantName={
              pdfConfig?.consultantName || user?.name || "Equipe SYAZ"
            }
            readings={pdfHistory}
            zones={pdfReading?.id === zonesReadingId ? zones : []}
          />
        )}
      </main>
    </div>
  );
}
