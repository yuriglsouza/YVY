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
// ... imports ...
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, ImageOverlay } from "react-leaflet";
// ...



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
  const handleDownloadPDF = async (reportContent: string, date: string, config?: ReportConfig) => {
    const doc = new jsPDF();

    // Brand Colors
    const BRAND_PRIMARY: [number, number, number] = [16, 185, 129]; // #10B981 Emerald
    const BRAND_SECONDARY: [number, number, number] = [59, 130, 246]; // #3B82F6 Blue
    const BRAND_DARK: [number, number, number] = [26, 28, 35]; // #1A1C23 Midnight Navy
    const BRAND_TEXT: [number, number, number] = [18, 20, 29]; // #12141D Deep Charcoal

    // Helper: Parse AI Content
    let structuredAnalysis: any = null;
    let simpleContent = reportContent;
    try {
      // Try to parse if it's the new structured format
      if (reportContent.trim().startsWith("{")) {
        structuredAnalysis = JSON.parse(reportContent);
      }
    } catch (e) {
      console.log("Legacy text content detected");
    }

    // Custom or Default Branding
    const consultant = config?.consultantName ? `Consultor: ${config.consultantName}` : "";

    // --- HEADER ---
    doc.setFillColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    doc.rect(0, 0, 210, 30, 'F'); // Darker, taller header

    // Add Logo & Header Text
    try {
      const logoUrl = '/logo.png';
      const logoData = await getBase64FromUrl(logoUrl);

      const img = new Image();
      img.src = logoUrl;
      await new Promise(r => img.onload = r);

      const maxWidth = 50;
      const maxHeight = 20;
      let w = img.width;
      let h = img.height;
      const ratio = Math.min(maxWidth / w, maxHeight / h);

      const logoW = w * ratio;
      const logoH = h * ratio;
      doc.addImage(logoData, 'PNG', 10, 5, logoW, logoH);

      // Header Title (Next to Logo)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14); // Slightly larger
      doc.setTextColor(16, 185, 129); // Emerald Text
      doc.text("RELATÓRIO DE INTELIGÊNCIA DE DADOS", 15 + logoW, 18);

      // Consultant Info (Right Aligned)
      if (consultant) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(9);
        doc.text(consultant, 200, 18, { align: "right" });
      }

      // --- WATERMARK (10% Opacity) ---
      const pageCount = doc.getNumberOfPages(); // We'll loop at end, but prepare data
      const wmWidth = 100;
      const wmHeight = (h / w) * wmWidth;
      const wmX = (210 - wmWidth) / 2;
      const wmY = (297 - wmHeight) / 2;

      // Store for later application
      (doc as any).watermarkData = { logoData, wmX, wmY, wmWidth, wmHeight };

    } catch (e) {
      // Fallback text if logo fails
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("SYAZ ORBITAL", 15, 20);
    }

    // --- FARM INFO BAR ---
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 30, 210, 10, 'F');

    doc.setTextColor(BRAND_TEXT[0], BRAND_TEXT[1], BRAND_TEXT[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    const dateStr = format(new Date(date), "dd/MM/yyyy");
    doc.text(`FAZENDA: ${farm?.name.toUpperCase()}`, 10, 36);
    doc.text(`DATA: ${dateStr}`, 140, 36);
    doc.text(`CULTURA: ${farm?.cropType.toUpperCase()}`, 175, 36);

    let startY = 45;

    // --- AI ANALYSIS SECTION (Grid Layout) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    doc.text("DIAGNÓSTICO E PREVISÃO (IA)", 10, startY);
    startY += 8;

    if (structuredAnalysis) {
      // 1. Diagnostic (Full Width)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const diagWidth = 180;
      const diagLines = doc.splitTextToSize(structuredAnalysis.diagnostic || "-", diagWidth);
      const lineHeight = 4;
      const diagBoxHeight = (diagLines.length * lineHeight) + 15;

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
      doc.rect(10, startY, 190, diagBoxHeight, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 0);
      doc.text("DIAGNÓSTICO TÉCNICO:", 15, startY + 6);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(diagLines, 15, startY + 12);

      startY += diagBoxHeight + 5;

      // GRID: Prediction (Left) + Recommendation (Right)
      const colW = 92;
      const gap = 6;

      const predLines = doc.splitTextToSize(structuredAnalysis.prediction || "-", colW - 10);
      const recText = Array.isArray(structuredAnalysis.recommendation) ? structuredAnalysis.recommendation.join("; ") : structuredAnalysis.recommendation;
      const recLines = doc.splitTextToSize(recText || "-", colW - 10);

      const predHeight = (predLines.length * lineHeight) + 15;
      const recHeight = (recLines.length * lineHeight) + 15;
      const maxRowHeight = Math.max(predHeight, recHeight, 30);

      // Prediction (Left)
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
      doc.rect(10, startY, colW, maxRowHeight, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 50, 150);
      doc.text("PREVISÃO / CENÁRIO:", 15, startY + 6);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(predLines, 15, startY + 12);

      // Recommendation (Right)
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.rect(10 + colW + gap, startY, colW, maxRowHeight, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 83, 9);
      doc.text("RECOMENDAÇÕES:", 15 + colW + gap, startY + 6);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(recLines, 15 + colW + gap, startY + 12);

      startY += maxRowHeight + 10;
    } else {
      const splitText = doc.splitTextToSize(simpleContent.replace(/\*\*/g, ""), 190);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(splitText, 10, startY);
      startY += (splitText.length * 4) + 10;
    }

    // --- SPLIT SECTION: TABLE (Left) + CHART (Right) ---
    const splitSectionY = startY;
    let maxSectionHeight = 0;

    // 1. LEFT: COMPACT TABLE (Width ~90mm)
    if (latestReading) {
      autoTable(doc, {
        startY: splitSectionY,
        tableWidth: 90,
        margin: { left: 10 },
        head: [['ÍNDICE', 'VALOR', 'STATUS']],
        body: [
          ['NDVI', latestReading.ndvi.toFixed(2), latestReading.ndvi > 0.6 ? 'ÓTIMO' : 'ATENÇÃO'],
          ['NDWI', latestReading.ndwi.toFixed(2), latestReading.ndwi > -0.1 ? 'BOM' : 'SECO'],
          ['NDRE', latestReading.ndre.toFixed(2), 'NORMAL'],
          ['OTCI', latestReading.otci ? latestReading.otci.toFixed(2) : '-', latestReading.otci && latestReading.otci > 2 ? 'ALTO' : 'MÉDIO'],
          ['LST', latestReading.temperature ? latestReading.temperature.toFixed(1) + '°C' : '-', latestReading.temperature && latestReading.temperature > 35 ? 'ALERTA' : 'IDEAL']
        ],
        theme: 'grid',
        headStyles: { fillColor: BRAND_PRIMARY, fontSize: 8, cellPadding: 1, halign: 'center' },
        bodyStyles: { fontSize: 8, cellPadding: 1, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } }
      });
      // @ts-ignore
      maxSectionHeight = Math.max(maxSectionHeight, doc.lastAutoTable.finalY - splitSectionY);
    }

    // 2. RIGHT: CHART (Width ~90mm)
    // Filter last 30 days
    if (readings && readings.length > 1) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const chartData = [...readings]
        .filter(r => new Date(r.date) >= thirtyDaysAgo)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (chartData.length > 0) {
        const chartX = 110;
        const chartY = splitSectionY;
        const chartW = 90;
        const chartH = 35; // Match approximate table height roughly

        doc.setFontSize(9);
        doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
        doc.text("VIGOR (NDVI) - 30 DIAS", chartX, chartY - 2);

        // Axis
        doc.setDrawColor(200);
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); // X
        doc.line(chartX, chartY, chartX, chartY + chartH); // Y

        const barWidth = (chartW / chartData.length) * 0.6;
        const gap = (chartW / chartData.length) * 0.4;

        chartData.forEach((r, i) => {
          const height = r.ndvi * chartH;
          const x = chartX + gap / 2 + (i * (barWidth + gap));
          const y = chartY + (chartH - height);

          doc.setFillColor(16, 185, 129);
          doc.rect(x, y, barWidth, height, 'F');
        });

        // Labels
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text(format(new Date(chartData[0].date), "dd/MM"), chartX, chartY + chartH + 3);
        doc.text(format(new Date(chartData[chartData.length - 1].date), "dd/MM"), chartX + chartW - 5, chartY + chartH + 3, { align: 'right' });

        maxSectionHeight = Math.max(maxSectionHeight, chartH + 10);
      }
    }

    startY += maxSectionHeight + 10;

    // --- FINANCIALS (Bottom Right or Footer) ---
    // Re-define footer vars for this section
    const footerY = startY;
    const colWidth = 90;

    // RIGHT COL: FINANCIALS
    // Relaxed Check: Show if config.financials exists AND includeFinancials is true (even if zones are empty)
    if (config?.financials && config?.includeFinancials) {
      const { costPerHa, pricePerBag, yields } = config.financials;

      // Fallback: If no zones, assume 100% Medium Yield
      let production = 0;
      if (zones.length > 0) {
        const highZone = zones.find(z => z.name.includes("Alta"))?.area_percentage || 0;
        const mediumZone = zones.find(z => z.name.includes("Média"))?.area_percentage || 0;
        const lowZone = zones.find(z => z.name.includes("Baixa"))?.area_percentage || 0;
        production = ((highZone * farm.sizeHa * yields.high) + (mediumZone * farm.sizeHa * yields.medium) + (lowZone * farm.sizeHa * yields.low));
      } else {
        // Fallback: Assume Medium Yield for entire farm
        production = 1.0 * farm.sizeHa * yields.medium;
      }

      const totalCost = farm.sizeHa * costPerHa;
      const grossRevenue = production * pricePerBag;
      const netProfit = grossRevenue - totalCost;
      const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

      const roiX = 110;
      const roiY = footerY;

      doc.setFontSize(10);
      doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
      doc.text("ANÁLISE FINANCEIRA (ESTIMADA)", roiX, roiY);

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.rect(roiX, roiY + 5, colWidth, 50, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(50);

      let py = roiY + 15;
      const row = (label: string, val: string, isBold = false) => {
        if (isBold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
        doc.text(label, roiX + 5, py);
        doc.text(val, roiX + colWidth - 5, py, { align: 'right' });
        py += 8;
      };

      row("Custo Total:", `R$ ${(totalCost / 1000).toFixed(1)}k`);
      row("Receita Bruta:", `R$ ${(grossRevenue / 1000).toFixed(1)}k`);
      doc.setDrawColor(220);
      doc.line(roiX + 5, py - 4, roiX + colWidth - 5, py - 4);

      doc.setTextColor(16, 185, 129);
      row("Lucro Líquido:", `R$ ${(netProfit / 1000).toFixed(1)}k`, true);

      doc.setTextColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
      doc.setFontSize(14);
      doc.text(`ROI: ${roi.toFixed(0)}%`, roiX + colWidth / 2, py + 5, { align: 'center' });
    } else {
      const notesX = 110;
      doc.text("NOTAS:", notesX, footerY);
      doc.setDrawColor(200);
      doc.rect(notesX, footerY + 5, colWidth, 50);
    }

    // --- LEFT COL: HORIZONTAL GAUGES (Data Intelligence) ---
    // Fills the empty space opposite to Financials/Notes
    if (latestReading) {
      const gaugeX = 10;
      const gaugeY = footerY;
      const gaugeW = 90;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
      doc.text("ÍNDICES DE VIGOR (MÉDIA)", gaugeX, gaugeY);

      let gy = gaugeY + 5;
      const items = [
        { label: "NDVI (Vigor)", val: latestReading.ndvi, min: 0, max: 1, stop1: [239, 68, 68], stop2: [234, 179, 8], stop3: [34, 197, 94] }, // Red -> Yellow -> Green
        { label: "NDWI (Água)", val: latestReading.ndwi, min: -0.5, max: 0.5, stop1: [239, 68, 68], stop2: [59, 130, 246], stop3: [30, 64, 175] }, // Red -> Blue -> Dark Blue
        { label: "NDRE (Nutrição)", val: latestReading.ndre, min: 0, max: 1, stop1: [239, 68, 68], stop2: [234, 179, 8], stop3: [34, 197, 94] },
        { label: "OTCI (Clorofila)", val: latestReading.otci || 0, min: 0, max: 5, stop1: [234, 179, 8], stop2: [34, 197, 94], stop3: [21, 128, 61] }, // Yellow -> Green -> Dark Green
        { label: "LST (Temperatura)", val: latestReading.temperature || 0, min: 10, max: 40, stop1: [34, 197, 94], stop2: [234, 179, 8], stop3: [239, 68, 68] } // Green -> Yellow -> Red
      ];

      items.forEach((item) => {
        // Label & Value
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        doc.text(item.label, gaugeX, gy + 3);
        doc.text(item.val.toFixed(2), gaugeX + gaugeW, gy + 3, { align: 'right' });

        // Gradient Bar
        const barY = gy + 5;
        const barH = 4;
        const steps = 30;
        const stepW = gaugeW / steps;

        for (let s = 0; s < steps; s++) {
          const t = s / (steps - 1);
          let r, g, b;

          if (t < 0.5) {
            // First Half
            const localT = t * 2;
            r = Math.round(item.stop1[0] + (item.stop2[0] - item.stop1[0]) * localT);
            g = Math.round(item.stop1[1] + (item.stop2[1] - item.stop1[1]) * localT);
            b = Math.round(item.stop1[2] + (item.stop2[2] - item.stop1[2]) * localT);
          } else {
            // Second Half
            const localT = (t - 0.5) * 2;
            r = Math.round(item.stop2[0] + (item.stop3[0] - item.stop2[0]) * localT);
            g = Math.round(item.stop2[1] + (item.stop3[1] - item.stop2[1]) * localT);
            b = Math.round(item.stop2[2] + (item.stop3[2] - item.stop2[2]) * localT);
          }

          doc.setFillColor(r, g, b);
          doc.rect(gaugeX + (s * stepW), barY, stepW + 0.5, barH, 'F'); // +0.5 to avoid gaps
        }

        // Marker (Triangle)
        // Normalize value to 0-1 range
        const normVal = Math.max(0, Math.min(1, (item.val - item.min) / (item.max - item.min)));
        const markerX = gaugeX + (normVal * gaugeW);

        doc.setFillColor(50, 50, 50);
        // Triangle pointing down
        doc.triangle(
          markerX - 1.5, barY - 1,
          markerX + 1.5, barY - 1,
          markerX, barY + 1.5,
          'F'
        );
        // Line marker through bar
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.line(markerX, barY, markerX, barY + barH);

        gy += 12; // Spacing
      });
    }

    // --- GLOSSARY & METHODOLOGY ---
    const glossaryY = footerY + 60;

    // Check if we have space on the page (A4 height ~297mm, Footer starts at 285)
    if (glossaryY < 240) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(10, glossaryY, 190, 35, 'FD');

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
      doc.text("METODOLOGIA E GLOSSÁRIO", 15, glossaryY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);

      const glossary = [
        "NDVI (Vigor): Índice de Vegetação. Valores > 0.6 indicam alta biomassa e saúde. < 0.3 sugere solo exposto ou estresse severo.",
        "NDWI (Água): Índice de Água. Monitora o estresse hídrico na planta. Valores negativos indicam baixa umidade.",
        "NDRE (Nutrição): Sensível à clorofila. Útil para detectar deficiências de Nitrogênio precocemente.",
        "OTCI (Sentinel-3): Índice de Clorofila Terrestre. Alta correlação com nitrogênio e produtividade em grandes culturas.",
        "LST (Temperatura): Temperatura da superfície. Altas temperaturas podem indicar estresse hídrico (fechamento estomático).",
        "Fonte de Dados: Imagens do satélite Sentinel-2 (ESA) processadas via Google Earth Engine. Resolução espacial de 10m."
      ];

      let gy = glossaryY + 11;
      glossary.forEach(item => {
        doc.text("• " + item, 15, gy);
        gy += 4.5;
      });
    }

    // --- FOOTER & WATERMARK LOOP ---
    const totalPages = doc.getNumberOfPages();
    const wm = (doc as any).watermarkData;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Watermark
      if (wm) {
        doc.saveGraphicsState();
        try {
          // @ts-ignore
          const gState = new doc.GState({ opacity: 0.1 });
          doc.setGState(gState);
        } catch (e) {
          // Fallback or ignore if GState fails
        }
        doc.addImage(wm.logoData, 'PNG', wm.wmX, wm.wmY, wm.wmWidth, wm.wmHeight);
        doc.restoreGraphicsState();
      }

      // Footer
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 285, 210, 12, 'F');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`SYAZ Orbital - Inteligência Agronômica | Página ${i} de ${totalPages}`, 105, 292, { align: "center" });
    }

    doc.save(`Relatorio_Tecnico_${farm?.name}_${date}.pdf`);
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

              <div className="absolute top-4 right-14 z-[400]">
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
                  <LayersControl.BaseLayer checked name="Satélite (Esri)">
                    <TileLayer
                      attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Mapa (Ruas)">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                  </LayersControl.BaseLayer>

                  {latestReading?.satelliteImage && latestReading?.imageBounds && (
                    <LayersControl.Overlay checked name="Análise Espectral (NDVI)">
                      <ImageOverlay
                        url={latestReading.satelliteImage}
                        bounds={latestReading.imageBounds as [[number, number], [number, number]]}
                        opacity={0.7}
                      />
                    </LayersControl.Overlay>
                  )}

                  {latestReading?.thermalImage && latestReading?.imageBounds && (
                    <LayersControl.Overlay name="Mapa Térmico (LST)">
                      <ImageOverlay
                        url={latestReading.thermalImage}
                        bounds={latestReading.imageBounds as [[number, number], [number, number]]}
                        opacity={0.7}
                      />
                    </LayersControl.Overlay>
                  )}
                </LayersControl>

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

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="h-auto"
            >
              <BenchmarkChart farmId={farmId} />
            </motion.div>
          </div>

        </div >
      </main >
    </div >
  );
}
