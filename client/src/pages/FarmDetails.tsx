import React from "react";
import { useFarm, useRefreshReadings } from "@/hooks/use-farms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useReadings, useLatestReading } from "@/hooks/use-readings";
import { useReports, useGenerateReport } from "@/hooks/use-reports";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Gauge } from "@/components/Gauge";
import { Link, useRoute, useLocation } from "wouter";
import { WeatherCard } from "@/components/weather-card";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { Loader2, RefreshCw, FileText, Map as MapIcon, ChevronLeft, BrainCircuit, Sprout, Ruler, Trash2, DollarSign, Leaf, CloudRain, Activity, ClipboardCheck, Cloud, Radio, Calendar, Beef, Scale, ShieldCheck, ShieldAlert, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ... imports ...
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon as LeafletPolygon, LayersControl, ImageOverlay } from "react-leaflet";
import { point, featureCollection } from "@turf/helpers";
import convex from "@turf/convex";

import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PredictiveChart } from "@/components/predictive-chart";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ReportConfigDialog, ReportConfig } from "@/components/report-config-dialog";
import { FinancialAnalysisDialog } from "@/components/financial-analysis-dialog";
import { useUser } from "@/hooks/use-user"; // Add hook
import { TaskBoard } from "@/components/task-board";

// Fix for leaflet marker icons
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// PDF Generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { ReportTemplate } from "@/components/ReportTemplate";

import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper to load image for PDF
const getBase64FromUrl = async (url: string): Promise<string> => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      resolve(reader.result as string);
    }
  });
};

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const indexExplanations: Record<string, string> = {
  "NDVI": "Vigor da vegetação e saúde da planta.",
  "NDWI": "Estresse hídrico e teor de água nas folhas.",
  "NDRE": "Clorofila e nitrogênio (detecção precoce).",
  "RVI": "Biomassa e estrutura física (Radar).",
  "OTCI": "Conteúdo de clorofila em macro-escala.",
  "TEMP. (LST)": "Temperatura da superfície (Calor/Estresse).",
};

const CustomLegend = (props: any) => {
  const { payload } = props;

  return (
    <div className="flex justify-center gap-6 mt-4 flex-wrap">
      {payload.map((entry: any, index: number) => {
        const explanation = indexExplanations[entry.value.toUpperCase()] || "Índice de monitoramento.";
        return (
          <TooltipProvider key={`item-${index}`}>
            <UITooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help opacity-80 hover:opacity-100 transition-opacity">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  ></span>
                  <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {entry.value}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-card border-border text-foreground">
                <p>{explanation}</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

export default function FarmDetails() {
  const { toast } = useToast();
  const [match, params] = useRoute("/farms/:id");
  const [location] = useLocation();

  // Robust ID extraction: try params first, then fallback to parsing location path
  let farmId = parseInt(params?.id || "0");
  if (!farmId || isNaN(farmId)) {
    // Remove trailing slash and split
    const parts = location.replace(/\/$/, '').split('/');
    const lastPart = parts[parts.length - 1];
    if (!isNaN(parseInt(lastPart))) {
      farmId = parseInt(lastPart);
    }
  }


  const { data: user } = useUser(); // Added hook call
  const { data: farm, isLoading: isLoadingFarm, error: farmError } = useFarm(farmId);
  const { data: readings } = useReadings(farmId);
  const { data: latestReading } = useLatestReading(farmId);
  /* ... hooks ... */
  const { data: reports } = useReports(farmId);

  const refreshReadings = useRefreshReadings();
  const generateReport = useGenerateReport();
  const [showThermal, setShowThermal] = React.useState(false);
  const [selectedReadingIdx, setSelectedReadingIdx] = React.useState<number | null>(null);
  const reportRef = React.useRef<HTMLDivElement>(null);

  // WARM-UP PING: Acorda o serviço de Inteligência Artificial no Render.com (que tem coldstart longo e dá timeout na Vercel)
  React.useEffect(() => {
    // Fire and forget genérico para a URL base conhecida do AI Engine
    fetch('https://yvy.onrender.com/ping')
      .then(res => console.log('Pinged AI Engine:', res.ok))
      .catch(err => console.debug('AI Ping pending/fail', err));
  }, []);

  // Calculate a fallback bounds if the reading doesn't have it but the farm has polygon/coords
  const fallbackBounds = React.useMemo(() => {
    if (!farm) return null;
    if (farm.polygon && Array.isArray(farm.polygon) && farm.polygon.length > 0) {
      const coords = farm.polygon as [number, number][]; // [lon, lat]
      const lats = coords.map(c => c[1]);
      const lons = coords.map(c => c[0]);
      return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
    }
    // Very rough fallback based on center and size
    const offset = Math.sqrt(farm.sizeHa) * 0.0005;
    return [[farm.latitude - offset, farm.longitude - offset], [farm.latitude + offset, farm.longitude + offset]];
  }, [farm]);

  // Sorted readings for temporal slider (oldest first) - filtered to 1 reading per Day to avoid dupe comparisons
  const sortedReadings = React.useMemo(() => {
    if (!readings) return [];

    const uniqueMap = new Map();
    // Use reverse to ensure later readings in the array overwrite older ones if they have same date
    [...readings].reverse().forEach(r => {
      const day = r.date.split('T')[0];
      uniqueMap.set(day, r);
    });

    return Array.from(uniqueMap.values())
      .filter(r => r.satelliteImage)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [readings]);

  // The reading shown on the map (selected or latest)
  const mapReading = selectedReadingIdx !== null && sortedReadings[selectedReadingIdx]
    ? sortedReadings[selectedReadingIdx]
    : latestReading;

  // Zones State
  interface Zone {
    id: number;
    name: string;
    color: string;
    coordinates: Array<{ lat: number, lon: number }>;
    ndvi_avg: number;
    area_percentage: number;
  }

  const [zones, setZones] = React.useState<Zone[]>([]);
  const [rasterImage, setRasterImage] = React.useState<string | null>(null);
  const [rasterBounds, setRasterBounds] = React.useState<[[number, number], [number, number]] | null>(null);
  const [zoneViewMode, setZoneViewMode] = React.useState<'both' | 'kmeans' | 'raster' | 'none'>('both');

  // Zone History
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
      const res = await fetch(`/api/farms/${farmId}/zones/generate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.detail || "Falha ao gerar zonas de manejo");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Support both old format (array) and new format ({ zones, raster_image, raster_bounds })
      const zonesArray = Array.isArray(data) ? data : (data.zones || data);
      setZones(zonesArray);

      // Set raster overlay if available
      if (data.raster_image) {
        setRasterImage(data.raster_image);
        setRasterBounds(data.raster_bounds || null);
      }

      queryClient.invalidateQueries({ queryKey: ["zone-history", farmId] });
      toast({ title: "Zonas Geradas", description: "O mapa de manejo foi atualizado com dados reais do Sentinel-2." });
    },
    onError: (err: Error) => {
      toast({
        title: "Zonas Indisponíveis",
        description: err.message || "Dados de satélite insuficientes para gerar zonas de manejo. Tente sincronizar o satélite primeiro.",
        variant: "destructive",
        className: "border-l-4 border-yellow-500"
      });
    }
  });

  if (isLoadingFarm) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (farmError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Erro ao carregar fazenda</p>
          <p className="text-muted-foreground text-sm">{farmError.message}</p>
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background pl-64 gap-2">
        <p className="text-destructive font-medium text-lg">Fazenda não encontrada</p>
        <div className="p-4 bg-muted/50 rounded-lg text-xs font-mono text-left space-y-1 border border-border">
          <p><strong>Debug Info:</strong></p>
          <p>URL: {location}</p>
          <p>Params ID: {params?.id || 'null'}</p>
          <p>Parsed ID: {farmId}</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = "/"}>Voltar ao Painel</Button>
      </div>
    );
  }

  // Helpers for gauge colors
  // Helpers for gauge status
  const getGaugeStatus = (val: number, type: 'NDVI' | 'NDWI' | 'NDRE' | 'RVI' | 'TEMP' | 'OTCI') => {
    if (type === 'NDVI') {
      if (val > 0.6) return { status: "Ótimo", statusColor: "text-green-600 border-green-200 bg-green-50", gradientId: "gradient-ndvi" };
      if (val > 0.3) return { status: "Atenção", statusColor: "text-yellow-600 border-yellow-200 bg-yellow-50", gradientId: "gradient-ndvi" };
      return { status: "Crítico", statusColor: "text-red-600 border-red-200 bg-red-50", gradientId: "gradient-ndvi" };
    }
    if (type === 'NDWI') {
      if (val > -0.1) return { status: "Bom", statusColor: "text-blue-600 border-blue-200 bg-blue-50", gradientId: "gradient-water" };
      if (val > -0.3) return { status: "Moderado", statusColor: "text-yellow-600 border-yellow-200 bg-yellow-50", gradientId: "gradient-water" };
      return { status: "Seco", statusColor: "text-red-600 border-red-200 bg-red-50", gradientId: "gradient-water" };
    }
    if (type === 'NDRE') {
      if (val > 0.5) return { status: "Bom", statusColor: "text-green-600 border-green-200 bg-green-50", gradientId: "gradient-ndvi" };
      if (val > 0.2) return { status: "Atenção", statusColor: "text-yellow-600 border-yellow-200 bg-yellow-50", gradientId: "gradient-ndvi" };
      return { status: "Baixo", statusColor: "text-red-600 border-red-200 bg-red-50", gradientId: "gradient-ndvi" };
    }
    if (type === 'RVI') {
      if (val > 0.5) return { status: "Vigoroso", statusColor: "text-purple-600 border-purple-200 bg-purple-50", color: "#8b5cf6" };
      return { status: "Baixo", statusColor: "text-muted-foreground border-border", color: "#8b5cf6" };
    }
    // ESTRESSE TÉRMICO
    if (type === 'TEMP') {
      if (val > 35) return { status: "Estresse Térmico", statusColor: "text-red-600 border-red-200 bg-red-50", color: "#ef4444" };
      if (val > 30) return { status: "Alerta", statusColor: "text-yellow-600 border-yellow-200 bg-yellow-50", color: "#f59e0b" };
      if (val < 10) return { status: "Frio", statusColor: "text-blue-600 border-blue-200 bg-blue-50", color: "#3b82f6" };
      return { status: "Ideal", statusColor: "text-green-600 border-green-200 bg-green-50", color: "#22c55e" };
    }
    // OTCI (CLOROFILA)
    if (type === 'OTCI') {
      if (val > 2.0) return { status: "Exuberante", statusColor: "text-green-700 border-green-300 bg-green-100", color: "#15803d" };
      if (val > 1.0) return { status: "Bom", statusColor: "text-green-600 border-green-200 bg-green-50", color: "#22c55e" };
      return { status: "Baixo", statusColor: "text-yellow-600 border-yellow-200 bg-yellow-50", color: "#eab308" };
    }
    return { status: "N/A", statusColor: "text-muted-foreground", color: "#000" };
  };

  const chartData = readings?.map(r => ({
    ...r,
    formattedDate: format(new Date(r.date), "d 'de' MMM")
  })).reverse();

  const hex2rgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };
  // PDF Generation Logic - Strict 2 Pages Enterprise SaaS
  const handleDownloadPDF = async (reportContent: string, date: string, config?: ReportConfig) => {
    try {
      if (!reportRef.current) throw new Error("Template de relatório não encontrado no DOM");

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // Print notification
      toast({ title: "Iniciando captura", description: "O motor está renderizando os gráficos em alta definição..." });

      // Capture Page HTML Engine
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution (retina alike)
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdfWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdfHeight = doc.internal.pageSize.getHeight();

      // First page
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);

      // Page 2 (Maps + Recharts Engine) 
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, -pdfHeight, pdfWidth, imgHeight);

      // Page 3 (Tables, Benchmarks, Authenticity Hash)
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, -(pdfHeight * 2), pdfWidth, imgHeight);

      doc.save(`SYAZ_Report_Auditoria_${farm?.name || "Fazenda"}_${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast({ title: "Relatório de Auditoria Exportado", description: "O laudo contendo Inteligência Artificial e Biometria visual foi salvo." });
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      toast({
        title: "Erro fatal no Gerador de PDF",
        description: error.message || String(error),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileNav />
      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-x-hidden">

        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Painel
          </Link>
          <div className="flex flex-col xl:flex-row flex-wrap justify-between items-start xl:items-center gap-4">
            <div>
              <h1 className="text-4xl font-display font-bold text-foreground">{farm.name}</h1>
              <div className="flex gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Sprout className="w-3 h-3" /> {farm.cropType}
                </span>
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Ruler className="w-3 h-3" /> {farm.sizeHa} ha
                </span>
              </div>
              <div className="flex flex-col gap-1 mt-4 sm:mt-0">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Última Sincronização
                </p>
                <div className="flex flex-col gap-2">
                  <p className="font-semibold text-lg">
                    {farm.lastSyncAt ? format(new Date(farm.lastSyncAt), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR }) : (latestReading ? format(new Date(latestReading.date), "dd 'de' MMMM, yyyy", { locale: ptBR }) : "Sem dados")}
                  </p>
                  {latestReading?.cloudCover !== undefined && latestReading.cloudCover !== null && latestReading.cloudCover > 0.6 && (
                    <Badge variant="secondary" className="w-fit bg-slate-800 text-slate-100 hover:bg-slate-700 flex items-center gap-1.5 shadow-sm">
                      <Cloud className="w-3 h-3 text-slate-400" />
                      Nuvens ({(latestReading.cloudCover * 100).toFixed(0)}%)
                      <span className="text-emerald-400 mx-1">•</span>
                      <Radio className="w-3 h-3 text-emerald-400" />
                      Radar SAR Ativo
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/*@ts-ignore*/}
              {(user?.role === 'admin' || user?.subscriptionStatus === 'active') ? (
                <FinancialAnalysisDialog zones={zones} farmSizeHa={farm.sizeHa} />
              ) : (
                <Link href="/plans">
                  <Button variant="outline" className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 gap-2">
                    <DollarSign className="w-4 h-4" /> Análise Financeira (Premium)
                  </Button>
                </Link>
              )}
              <Button
                onClick={async () => {
                  if (confirm("Tem certeza que deseja excluir esta fazenda? Esta ação não pode ser desfeita.")) {
                    try {
                      await fetch(`/api/farms/${farmId}`, { method: 'DELETE' });
                      toast({ title: "Fazenda Excluída", description: "A fazenda foi removida com sucesso." });
                      window.location.href = "/"; // Force navigation or useLocation
                    } catch (error) {
                      toast({ title: "Erro", description: "Falha ao excluir fazenda.", variant: "destructive" });
                    }
                  }
                }}
                variant="destructive"
                className="rounded-xl"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
              <Button
                onClick={() => {
                  refreshReadings.mutate(farmId, {
                    onSuccess: (data: any) => {
                      setSelectedReadingIdx(null); // Resetar slider para a data mais atual
                      if (data.isMock) {
                        toast({
                          title: "Simulação Ativada",
                          description: data.message || "Dados simulados gerados devido à falha na conexão.",
                          variant: "default",
                          className: "border-l-4 border-yellow-500"
                        });
                      } else {
                        toast({ title: "Dados Atualizados", description: "Sincronização com Sentinel concluída." });
                      }
                    },
                    onError: () => toast({ title: "Erro na Sincronização", description: "Falha crítica ao conectar ao servidor.", variant: "destructive" })
                  });
                }}
                disabled={refreshReadings.isPending}
                variant="outline"
                className="rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", refreshReadings.isPending && "animate-spin")} />
                Sincronizar Satélite
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary"
                onClick={() => window.open(`/api/farms/${farmId}/readings/export-csv`, "_blank")}
                disabled={!readings || readings.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>


        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="mb-6 flex-wrap h-auto justify-start">
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" />
              Monitoramento
            </TabsTrigger>
            {(farm?.cropType.toLowerCase().includes('pasto') || farm?.cropType.toLowerCase().includes('pastagem')) && (
              <TabsTrigger value="livestock" className="gap-2 bg-amber-500/10 text-amber-600 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                <Beef className="w-4 h-4" />
                Pecuária (Lotação)
              </TabsTrigger>
            )}
            <TabsTrigger value="sustainability" className="gap-2">
              <Sprout className="w-4 h-4" />
              Sustentabilidade (ESG)
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 bg-emerald-500/10 text-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <ClipboardCheck className="w-4 h-4" />
              Ações Diárias (Verificação)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring">
            {/* Gauges Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
              {latestReading ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <Gauge
                      value={latestReading.ndvi}
                      label={(latestReading.cloudCover ?? 0) > 0.6 ? "NDVI (Obstruído ☁️)" : "NDVI"}
                      {...getGaugeStatus(latestReading.ndvi, 'NDVI')}
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <Gauge
                      value={latestReading.ndwi}
                      label="NDWI (Água)"
                      min={-1} max={1}
                      {...getGaugeStatus(latestReading.ndwi, 'NDWI')}
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <Gauge
                      value={latestReading.ndre}
                      label="NDRE"
                      {...getGaugeStatus(latestReading.ndre, 'NDRE')}
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <Gauge
                      value={latestReading.otci || 0}
                      label="OTCI (Clorofila)"
                      max={4}
                      {...getGaugeStatus(latestReading.otci || 0, 'OTCI')}
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <div className={cn("relative", (latestReading.cloudCover ?? 0) > 0.6 ? "ring-2 ring-emerald-500 rounded-full" : "")}>
                      <Gauge
                        value={latestReading.rvi}
                        label={(latestReading.cloudCover ?? 0) > 0.6 ? "RVI (Alerta SAR📡)" : "RVI (Radar)"}
                        max={3}
                        {...getGaugeStatus(latestReading.rvi, 'RVI')}
                      />
                    </div>
                  </motion.div>
                  {/* LST Last */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <Gauge
                      value={latestReading.temperature || 0}
                      label="Temp. (LST)"
                      min={0} max={60}
                      {...getGaugeStatus(latestReading.temperature || 0, 'TEMP')}
                    />
                  </motion.div>
                </>
              ) : (
                <div className="col-span-6 p-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                  Nenhuma leitura disponível. Clique em "Sincronizar Satélite".
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Main Chart Column */}
              <div className="lg:col-span-2 space-y-8">
                {mapReading?.satelliteImage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card p-6 rounded-2xl border border-border shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-display font-bold flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${showThermal ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                        {showThermal ? ' Mapa Térmico (LST)' : ' Captura do Satélite (RGB)'}
                      </h2>
                      <div className="flex bg-secondary/30 p-1 rounded-lg gap-1">
                        <button
                          onClick={() => setShowThermal(false)}
                          className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            !showThermal ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          RGB
                        </button>
                        <button
                          onClick={() => setShowThermal(true)}
                          className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            showThermal ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Térmico
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-[600px] overflow-hidden rounded-xl border border-border/50 relative group bg-black/95">
                      {showThermal ? (
                        mapReading.thermalImage || mapReading.satelliteImage ? (
                          <img
                            src={mapReading.thermalImage || mapReading.satelliteImage}
                            alt="Satellite View"
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                            <Cloud className="w-12 h-12 mb-4 opacity-50" />
                            <p>Imagem Térmica Indisponível</p>
                          </div>
                        )
                      ) : (
                        mapReading.satelliteImage ? (
                          <img
                            src={mapReading.satelliteImage}
                            alt="Satellite View"
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                            <Cloud className="w-12 h-12 mb-4 opacity-50" />
                            <p>Imagem de Satélite Indisponível</p>
                          </div>
                        )
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm font-medium">
                              {showThermal ? 'Temperatura da Superfície (LST)' : 'Visualização Cor Verdadeira (TCI)'}
                            </p>
                            <p className="text-xs opacity-75">
                              {showThermal ? 'Landsat 8/9 (100m)' : 'Sentinel-2 / MODIS Composite'}
                              {mapReading.date && (
                                <> · 📅 {new Date(mapReading.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</>
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
                              <span className="text-[10px] opacity-75">Escala Dinâmica (Média ±3°C)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Temporal Slider (Posicionado sobre a Imagem RGB) */}
                      {sortedReadings.length > 1 && (
                        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[400] w-[calc(100%-20px)] md:w-[350px]">
                          <div className="bg-background/90 backdrop-blur text-foreground px-3 py-2 rounded-xl border border-border/50 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium">Comparativo Temporal</span>
                              <span className="ml-auto text-xs font-mono text-primary">
                                {mapReading?.date ? new Date(mapReading.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                              </span>
                              {mapReading && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-background">
                                  NDVI {mapReading.ndvi?.toFixed(3)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {new Date(sortedReadings[0].date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={sortedReadings.length - 1}
                                value={selectedReadingIdx !== null ? selectedReadingIdx : sortedReadings.length - 1}
                                onChange={(e) => setSelectedReadingIdx(parseInt(e.target.value))}
                                className="w-full h-1.5 accent-primary cursor-pointer"
                              />
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {new Date(sortedReadings[sortedReadings.length - 1].date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card p-6 rounded-2xl border border-border shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold">Tendências Históricas</h2>
                    <div className="flex gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span>
                      <span className="text-xs text-muted-foreground">NDVI</span>
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} domain={['auto', 'auto']} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#ef4444', fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ color: '#1f2937' }}
                        />
                        <Legend content={<CustomLegend />} />
                        <Line yAxisId="left" type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDVI" />
                        <Line yAxisId="left" type="monotone" dataKey="ndwi" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDWI" />
                        <Line yAxisId="left" type="monotone" dataKey="otci" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="OTCI" />
                        <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp. (LST)" />

                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  {/*@ts-ignore*/}
                  {(user?.role === 'admin' || user?.subscriptionStatus === 'active') ? (
                    <PredictiveChart farmId={farmId} />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center bg-muted/10 border border-dashed border-border rounded-xl">
                      <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                        <BrainCircuit className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h3 className="font-bold text-lg mb-1">Agrônomo IA (Premium)</h3>
                      <p className="text-muted-foreground text-sm mb-4 text-center max-w-xs">
                        Previsões de safra e análise avançada de produtividade.
                      </p>
                      <Link href="/plans">
                        <Button variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-black">
                          Desbloquear IA
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>





                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card p-6 rounded-2xl border border-border shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-display font-bold flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-accent" /> Agrônomo IA
                    </h2>
                    <Button
                      onClick={() => generateReport.mutate(farmId)}
                      disabled={generateReport.isPending}
                      size="sm"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg"
                    >
                      {generateReport.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                      Analisar Dados
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {reports && reports.length > 0 ? (
                      reports.slice(0, 2).map((report) => (
                        <div key={report.id} className="p-4 bg-muted/30 rounded-xl border border-border/50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                              Relatório gerado
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(report.date || new Date()), "PPP")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mb-4">
                            {report.content}
                          </p>

                          {report.formalContent && (
                            <ReportConfigDialog
                              onGenerate={(config) => handleDownloadPDF(report.formalContent!, report.date?.toString() || "", config)}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 hover:border-green-500/50 transition-all"
                                >
                                  <FileText className="w-4 h-4 mr-2" /> Baixar PDF Técnico
                                </Button>
                              }
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum relatório de análise IA ainda. Clique em "Analisar Dados" para gerar um.
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <WeatherCard latitude={farm.latitude} longitude={farm.longitude} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-[400px] lg:h-[600px] relative"
                >
                  <div className="absolute top-4 left-14 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-border/50">
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
                            // Convert saved zones to the expected format
                            const mappedZones = entry.zones.map((z: any, i: number) => ({
                              id: z.id || i,
                              name: z.name,
                              color: z.color,
                              coordinates: z.coordinates,
                              ndvi_avg: z.ndviAvg || 0,
                              area_percentage: z.areaHa ? (z.areaHa / (farm.sizeHa || 1)) * 100 : 33,
                            }));
                            setZones(mappedZones);
                          }
                        }}
                        defaultValue="-1"
                      >
                        <option value="-1">📜 Histórico</option>
                        {zoneHistory.map((entry: any, idx: number) => (
                          <option key={idx} value={idx}>
                            {new Date(entry.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            {" ("}{entry.zones.length} zonas{")"}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* View Mode Toggle */}
                    {(zones.length > 0 || rasterImage) && (
                      <select
                        className="text-xs h-8 px-2 bg-background text-foreground border border-border rounded-md shadow-sm cursor-pointer"
                        value={zoneViewMode}
                        onChange={(e) => setZoneViewMode(e.target.value as 'both' | 'kmeans' | 'raster' | 'none')}
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
                      {generateZones.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MapIcon className="w-3 h-3 mr-1" />}
                      Gerar Zonas
                    </Button>
                  </div>

                  <MapContainer
                    center={[farm.latitude, farm.longitude]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer checked name="Google Maps (Satélite + Ruas)">
                        <TileLayer
                          attribution='&copy; Google Maps'
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

                      {mapReading?.satelliteImage && (mapReading?.imageBounds || fallbackBounds) && (
                        <LayersControl.Overlay checked name="Análise Espectral (NDVI)">
                          <ImageOverlay
                            url={mapReading.satelliteImage}
                            bounds={(mapReading.imageBounds || fallbackBounds) as unknown as [[number, number], [number, number]]}
                            opacity={0.7}
                          />
                        </LayersControl.Overlay>
                      )}

                      {mapReading?.thermalImage && (mapReading?.imageBounds || fallbackBounds) && (
                        <LayersControl.Overlay name="Mapa Térmico (LST)">
                          <ImageOverlay
                            url={mapReading.thermalImage}
                            bounds={(mapReading.imageBounds || fallbackBounds) as unknown as [[number, number], [number, number]]}
                            opacity={0.7}
                          />
                        </LayersControl.Overlay>
                      )}
                    </LayersControl>

                    {/* Raster Image Overlay (painted zones) */}
                    {zoneViewMode !== 'none' && zoneViewMode !== 'kmeans' && rasterImage && rasterBounds && (
                      <ImageOverlay
                        url={rasterImage}
                        bounds={rasterBounds as unknown as [[number, number], [number, number]]}
                        opacity={0.6}
                      />
                    )}

                    {/* Zones Visualization (K-Means Points) */}
                    {zoneViewMode !== 'none' && zoneViewMode !== 'raster' &&
                      zones?.map((zone, zIdx) => (
                        <React.Fragment key={`zone-group-${zone.id}`}>
                          {zone.coordinates.map((point, index) => {
                            // Extraimos a primeira letra significativa (ex: "Zona Sul" -> "S", "Zona Nordeste" -> "NE")
                            let zoneLabel = zone.name.charAt(0);
                            if (zone.name.startsWith("Zona ")) {
                              const dirName = zone.name.substring(5); // Remove "Zona "
                              if (dirName.startsWith("Nor")) zoneLabel = dirName.startsWith("Nordeste") ? "NE" : "NO";
                              else if (dirName.startsWith("Sud")) zoneLabel = dirName.startsWith("Sudeste") ? "SE" : "SO";
                              else zoneLabel = dirName.charAt(0); // S, N, L, O, C
                            }

                            const pointIcon = L.divIcon({
                              className: 'custom-zone-marker',
                              html: `<div style="background-color: ${zone.color}cc; border: 1px solid ${zone.color}; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold; font-family: sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">${zoneLabel}</div>`,
                              iconSize: [16, 16],
                              iconAnchor: [8, 8]
                            });

                            return (
                              <Marker
                                key={`${zone.id}-${index}`}
                                position={[point.lat, point.lon]}
                                icon={pointIcon}
                              >
                                <Popup>
                                  <div className="text-xs">
                                    <strong>{zone.name} (T{zIdx + 1})</strong><br />
                                    Área: {(zone as any)['areaHa'] ? (Number((zone as any)['areaHa']) * 10000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : "N/A"} m²<br />
                                    Média Saúde: {zone.ndvi_avg ? zone.ndvi_avg.toFixed(2) : "N/A"}<br />
                                    Lat: {point.lat.toFixed(6)}<br />
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
                          <strong>{farm.name}</strong><br />
                          {farm.sizeHa} ha
                        </div>
                      </Popup>
                    </Marker>
                    {farm.polygon && Array.isArray(farm.polygon) && (farm.polygon as [number, number][]).length >= 3 ? (
                      <LeafletPolygon
                        positions={(farm.polygon as [number, number][]).map(([lon, lat]) => [lat, lon] as [number, number])}
                        pathOptions={{ color: '#2F447F', fillColor: '#2F447F', fillOpacity: 0.2 }}
                      />
                    ) : (
                      <Circle
                        center={[farm.latitude, farm.longitude]}
                        radius={Math.sqrt((farm.sizeHa * 10000) / Math.PI)}
                        pathOptions={{ color: '#2F447F', fillColor: '#2F447F', fillOpacity: 0.2 }}
                      />
                    )}
                  </MapContainer>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="h-auto"
                >
                  <BenchmarkChart farmId={farmId} />
                </motion.div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sustainability" className="space-y-8 animate-in fade-in-50 duration-500">
            {(() => {
              const calcCarbonStock = (reading: any) => {
                if (reading?.carbonStock && reading.carbonStock > 0) return reading.carbonStock;
                const baseNdvi = Math.max(0, reading?.ndvi || 0);
                return (farm?.sizeHa || 0) * baseNdvi * 45.5;
              };
              const calcCo2 = (reading: any) => {
                if (reading?.co2Equivalent && reading.co2Equivalent > 0) return reading.co2Equivalent;
                return calcCarbonStock(reading) * 3.67;
              };

              const currentCarbon = calcCarbonStock(latestReading);
              const currentCo2 = calcCo2(latestReading);
              const currentCredit = currentCo2 * 15 * 5.5;

              // Generate readings with co2 mapped for chart
              const chartReadings = (readings || [])
                .map(r => ({ ...r, displayCo2: calcCo2(r) }))
                .filter(r => r.displayCo2 > 0)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              // Compliance Variables
              const isCompliant = !farm?.isDeforested;

              return (
                <>
                  {/* COMPLIANCE AUDIT PANEL */}
                  <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6 ${isCompliant ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                    <div className={`p-4 rounded-full ${isCompliant ? 'bg-emerald-500/20 text-emerald-500' : 'bg-destructive/20 text-destructive'}`}>
                      {isCompliant ? <ShieldCheck className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold mb-1 ${isCompliant ? 'text-emerald-500' : 'text-destructive'}`}>
                        {isCompliant ? 'Certidão de Conformidade Ambiental Ativa' : 'Alerta Crítico: Risco de Embargo (Uso do Solo)'}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {isCompliant ? (
                          <>A inteligência artificial orbital da SYAZ Monitoramento garante que este polígono encontra-se <b>Livre de Desmatamento</b> e desprovido de sobreposição em áreas de conservação restrita. Propriedade 100% elegível para linhas de Crédito Rural (Plano Safra / Funcafé) e Acordos de Moratória da Soja.</>
                        ) : (
                          <>O satélite detectou <b>Supressão Recente de Vegetação Nativa</b> nos limites do polígono. Operações de crédito bancário e financiamento agrícola podem ser bloqueadas até a submissão formal das licenças (ASV) ao IBAMA/Órgão Ambiental.</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-500/20 rounded-full">
                          <Leaf className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Estoque de Carbono</p>
                          <h3 className="text-2xl font-bold">{currentCarbon.toFixed(1)} t</h3>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Biomassa estim. via Satélite (NDVI).</p>
                    </div>

                    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-full">
                          <CloudRain className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">CO2 Equivalente</p>
                          <h3 className="text-2xl font-bold">{currentCo2.toFixed(1)} tCO2e</h3>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Potencial de sequestro atmosférico.</p>
                    </div>

                    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-yellow-500/20 rounded-full">
                          <DollarSign className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Crédito Potencial</p>
                          <h3 className="text-2xl font-bold">R$ {currentCredit.toFixed(2)}</h3>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Estimativa (@ $15 USD/ton).</p>
                    </div>
                  </div>

                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Evolução do Sequestro de CO2
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartReadings}>
                          <defs>
                            <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), "dd/MM")} stroke="#666" />
                          <YAxis stroke="#666" />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                          <Area type="monotone" dataKey="displayCo2" stroke="#10b981" fillOpacity={1} fill="url(#colorCo2)" name="tCO2e" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                    <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5" />
                      Como funciona nosso Modelo de Carbono?
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Utilizamos imagens de satélite Sentinel-2 e algoritmos de aprendizado de máquina para estimar a biomassa vegetal acima do solo.
                      O modelo converte o vigor vegetativo (NDVI e EVI) em toneladas de matéria seca, e aplica fatores de conversão (IPCC Tier 1)
                      para determinar o carbono estocado. O CO2 equivalente (tCO2e) representa quanto dióxido de carbono foi removido da atmosfera
                      pela fotossíntese da sua lavoura.
                      <br /><br />
                      <strong>Nota:</strong> Esta é uma estimativa estratégica. A certificação de créditos de carbono requer auditoria de solo presencial.
                    </p>
                  </div>
                </>
              );
            })()}
          </TabsContent>

          {(farm?.cropType.toLowerCase().includes('pasto') || farm?.cropType.toLowerCase().includes('pastagem')) && (
            <TabsContent value="livestock" className="space-y-8 animate-in fade-in-50 duration-500">
              {(() => {
                const ndvi = latestReading?.ndvi || 0.1;
                // Calculo Simplificado: 1 un NDVI ~ 3200 kg Matéria Seca/ha
                const dryMatterKg = Math.max(0, ndvi) * 3200 * (farm?.sizeHa || 0);

                // Suporte: 1 UA (450kg) consome ~12kg MS/dia. 30 dias = 360kg.
                // Eficiencia de pastejo seguro consideramos 50%
                const availableForage = dryMatterKg * 0.5;
                const capacityUa = availableForage / 360;

                const uaColor = ndvi < 0.3 ? "text-red-500" : ndvi > 0.6 ? "text-emerald-500" : "text-amber-500";
                const bgUaColor = ndvi < 0.3 ? "bg-red-500/10" : ndvi > 0.6 ? "bg-emerald-500/10" : "bg-amber-500/10";

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`p-3 rounded-full ${bgUaColor}`}>
                            <Beef className={`w-8 h-8 ${uaColor}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Capacidade de Suporte</p>
                            <h3 className="text-4xl font-black font-mono">{Math.max(0, capacityUa).toFixed(0)} <span className="text-xl text-muted-foreground">UA</span></h3>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Lotação máxima segura sustentada por <b>30 dias</b>. (1 UA = 450kg de peso vivo).
                        </p>
                      </div>

                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="p-3 bg-primary/10 rounded-full">
                            <Scale className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Matéria Seca Estimada</p>
                            <h3 className="text-3xl font-bold">{(dryMatterKg / 1000).toFixed(1)} <span className="text-xl text-muted-foreground">Ton</span></h3>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Biomassa comestível (forragem) mensurada através da leitura ótica do satélite (NDVI).
                        </p>
                      </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                      <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5" />
                        Como a IA calcula o pastejo?
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        A cor verde da folhagem do pasto contém biomassa estrutural que podemos inferir do espaço.
                        Nossa inteligência converte o índice NDVI da área mapeada em quilos de Matéria Seca (MS).
                        Assumimos uma eficiência de pastejo segura de 50% (o gado come metade, a outra metade garante o rebrote)
                        e dividimos o saldo pelo consumo de um mamífero adulto de 450kg (1 Unidade Animal) ao longo de 1 mês.
                      </p>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
          )}

          <TabsContent value="tasks" className="animate-in fade-in-50 duration-500">
            <TaskBoard farmId={farmId} />
          </TabsContent>
        </Tabs>

        {/* Hidden Report Template for DOM Capture */}
        <ReportTemplate
          ref={reportRef}
          farm={farm}
          currentReading={latestReading || null}
          previousReading={
            (() => {
              if (sortedReadings.length < 2) return null;
              if (!latestReading) return sortedReadings[sortedReadings.length - 2];
              const latestTime = new Date(latestReading.date).getTime();
              // Procurar agressivamente por uma leitura que seja no mínimo 20 dias mais velha que a atual
              const olderReadings = sortedReadings.filter(r => (latestTime - new Date(r.date).getTime()) > 20 * 24 * 60 * 60 * 1000);
              if (olderReadings.length > 0) {
                return olderReadings[olderReadings.length - 1]; // pega a mais recente dentre as velhas
              }
              // Se não tiver (ex: cliente sincronizou hoje e ontem pela 1º vez), devolve a estritamente anterior
              return sortedReadings[sortedReadings.length - 2];
            })()
          }
          historyData={chartData || []}
          aiReport={reports?.[0]?.formalContent || ""}
          consultantName={user?.name || "Equipe SYAZ"}
          readings={readings || []}
          zones={zones.length > 0 ? zones : (zoneHistory && zoneHistory.length > 0 ? (zoneHistory[0] as any)?.zones || [] : [])}
        />

      </main >
    </div >
  );
}
