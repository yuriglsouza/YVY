import React from "react";
import { useFarm, useRefreshReadings } from "@/hooks/use-farms";
import { useMutation } from "@tanstack/react-query";
import { useReadings, useLatestReading } from "@/hooks/use-readings";
import { useReports, useGenerateReport } from "@/hooks/use-reports";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Gauge } from "@/components/Gauge";
import { Link, useRoute, useLocation } from "wouter";
import { WeatherCard } from "@/components/weather-card";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { Loader2, RefreshCw, FileText, Map as MapIcon, ChevronLeft, BrainCircuit, Sprout, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PredictiveChart } from "@/components/predictive-chart";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ReportConfigDialog, ReportConfig } from "@/components/report-config-dialog";
import { FinancialAnalysisDialog } from "@/components/financial-analysis-dialog";

// Fix for leaflet marker icons
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// PDF Generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const { data: farm, isLoading: isLoadingFarm, error: farmError } = useFarm(farmId);
  const { data: readings } = useReadings(farmId);
  const { data: latestReading } = useLatestReading(farmId);
  /* ... hooks ... */
  const { data: reports } = useReports(farmId);

  const refreshReadings = useRefreshReadings();
  const generateReport = useGenerateReport();
  const [showThermal, setShowThermal] = React.useState(false);

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

  const generateZones = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/farms/${farmId}/zones/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate zones");
      return res.json();
    },
    onSuccess: (data) => {
      setZones(data);
      toast({ title: "Zonas Geradas", description: "O mapa de manejo foi atualizado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao gerar zonas.", variant: "destructive" });
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

  // PDF Generation Logic
  const handleDownloadPDF = (reportContent: string, date: string, config?: ReportConfig) => {
    const doc = new jsPDF();

    // Custom or Default Branding
    const company = config?.companyName || "YVY ORBITAL";
    const consultant = config?.consultantName ? `Consultor: ${config.consultantName}` : "";

    // Header Color (Green default)
    doc.setFillColor(22, 163, 74); // Green
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(company, 10, 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório Agronômico de Precisão", 10, 22);

    if (consultant) {
      doc.text(consultant, 200, 15, { align: "right" });
    }

    // Farm Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Fazenda: ${farm?.name}`, 10, 40);
    doc.text(`Data do Relatório: ${format(new Date(date), "dd/MM/yyyy")}`, 10, 46);
    doc.text(`Cultura: ${farm?.cropType}`, 10, 52);

    // Custom Comments Section
    let startY = 65;
    if (config?.comments) {
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      doc.text("Notas do Consultor:", 10, 60);

      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      const splitComments = doc.splitTextToSize(config.comments, 190);
      doc.text(splitComments, 10, 66);

      startY = 66 + (splitComments.length * 5) + 10;
    }

    // Financial Analysis Section (New)
    if (config?.includeFinancials && config.financials && zones.length > 0) {
      // Calculate logic (same as FinancialDialog)
      const { costPerHa, pricePerBag, yields } = config.financials;

      const highZone = zones.find(z => z.name.includes("Alta"))?.area_percentage || 0;
      const mediumZone = zones.find(z => z.name.includes("Média"))?.area_percentage || 0;
      const lowZone = zones.find(z => z.name.includes("Baixa"))?.area_percentage || 0;

      const production = (
        (highZone * farm.sizeHa * yields.high) +
        (mediumZone * farm.sizeHa * yields.medium) +
        (lowZone * farm.sizeHa * yields.low)
      );

      const totalCost = farm.sizeHa * costPerHa;
      const grossRevenue = production * pricePerBag;
      const netProfit = grossRevenue - totalCost;
      const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      const avgYield = production / farm.sizeHa;

      // Render Table
      autoTable(doc, {
        startY: startY,
        head: [['Análise Financeira Estimada', 'Valores']],
        body: [
          ['Custo de Produção Base', `R$ ${costPerHa.toFixed(2)} / ha`],
          ['Produtividade Média Estimada', `${avgYield.toFixed(1)} sc/ha`],
          ['Receita Bruta Total', `R$ ${grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Lucro Líquido Projetado', `R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Retorno sobre Investimento (ROI)', `${roi.toFixed(1)}%`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] }, // Green
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 100 },
          1: { halign: 'right' }
        }
      });

      // Update startY for next section
      // @ts-ignore
      startY = doc.lastAutoTable.finalY + 10;
    }

    // Content Body
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Header for AI Analysis if we have space, otherwise add new page? 
    // For now assuming it fits or autoTable handles paging for the next tables but text needs manual handling.
    if (startY > 250) { doc.addPage(); startY = 20; }

    doc.text("Análise de Inteligência Artificial:", 10, startY - 4);

    // Strip markdown characters (**, ##) for cleaner PDF text
    const cleanContent = reportContent
      .replace(/\*\*/g, "")
      .replace(/##/g, "")
      .replace(/__/g, "");

    const splitText = doc.splitTextToSize(cleanContent, 190);
    doc.text(splitText, 10, startY);

    // Calculate Y position based on text height
    // 10 is the font size, 0.3527 converted points to mm (approx), 1.2 line height factor
    const textHeight = splitText.length * (10 * 0.3527 * 1.2);
    const finalY = startY + textHeight + 10;

    // Add readings table if available
    if (latestReading) {
      autoTable(doc, {
        startY: finalY,
        head: [['Índice', 'Valor', 'Status']],
        body: [
          ['NDVI (Vigor)', latestReading.ndvi.toFixed(2), latestReading.ndvi > 0.6 ? 'Ótimo' : 'Atenção'],
          ['NDWI (Água)', latestReading.ndwi.toFixed(2), latestReading.ndwi > -0.1 ? 'Bom' : 'Seco'],
          ['NDRE (Clorofila)', latestReading.ndre.toFixed(2), 'Normal'],
          ['Temp. Superfície', latestReading.temperature ? latestReading.temperature.toFixed(1) + '°C' : 'N/A', '-']
        ],
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] }
      });
    }

    // Legend / Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Gerado automaticamente por Yvy Orbital AI System", 10, 290);

    doc.save(`Relatorio_${farm?.name}_${date}.pdf`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-x-hidden">

        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Painel
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
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
            </div>
            <div className="flex gap-2">
              <FinancialAnalysisDialog zones={zones} farmSizeHa={farm.sizeHa} />
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
            </div>
          </div>
        </div>

        {/* Gauges Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          {latestReading ? (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <Gauge
                  value={latestReading.ndvi}
                  label="NDVI"
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
                <Gauge
                  value={latestReading.rvi}
                  label="RVI (Radar)"
                  max={3}
                  {...getGaugeStatus(latestReading.rvi, 'RVI')}
                />
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
            {latestReading?.satelliteImage && (
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
                  <img
                    src={showThermal ? (latestReading.thermalImage || latestReading.satelliteImage) : latestReading.satelliteImage}
                    alt="Satellite View"
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-medium">
                          {showThermal ? 'Temperatura da Superfície (LST)' : 'Visualização Cor Verdadeira (TCI)'}
                        </p>
                        <p className="text-xs opacity-75">
                          {showThermal ? 'Landsat 8/9 (100m)' : 'Sentinel-2 / MODIS Composite'}
                        </p>
                      </div>

                      {showThermal && latestReading.temperature && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 text-[10px] font-medium opacity-90">
                            <span>{(latestReading.temperature - 3).toFixed(1)}°C</span>
                            <div className="w-24 h-2 rounded-full bg-gradient-to-r from-[#0000ff] via-[#00ff00] to-[#ff0000] border border-white/20"></div>
                            <span>{(latestReading.temperature + 3).toFixed(1)}°C</span>
                          </div>
                          <span className="text-[10px] opacity-75">Escala Dinâmica (Média ±3°C)</span>
                        </div>
                      )}
                    </div>
                  </div>
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
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Legend content={<CustomLegend />} />
                    <Line type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDVI" />
                    <Line type="monotone" dataKey="ndwi" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDWI" />
                    <Line type="monotone" dataKey="otci" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="OTCI" />
                    <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp. (LST)" />

                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              <PredictiveChart farmId={farmId} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18 }}
            >
              <BenchmarkChart farmId={farmId} />
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
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-border/50">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-primary" /> Localização
                </h3>
              </div>

              <div className="absolute top-4 right-4 z-[400]">
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
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Zones Visualization */}
                {zones?.map((zone) => (
                  zone.coordinates.map((point, index) => (
                    <Circle
                      key={`${zone.id}-${index}`}
                      center={[point.lat, point.lon]}
                      radius={8}
                      pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.5, stroke: false }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>{zone.name}</strong><br />
                          Lat: {point.lat.toFixed(6)}<br />
                          Lon: {point.lon.toFixed(6)}
                        </div>
                      </Popup>
                    </Circle>
                  ))
                ))}

                <Marker position={[farm.latitude, farm.longitude]}>
                  <Popup>
                    <div className="text-center">
                      <strong>{farm.name}</strong><br />
                      {farm.sizeHa} ha
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[farm.latitude, farm.longitude]}
                  radius={Math.sqrt((farm.sizeHa * 10000) / Math.PI)}
                  pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }}
                />
              </MapContainer>
            </motion.div>
          </div>

        </div >
      </main >
    </div >
  );
}
