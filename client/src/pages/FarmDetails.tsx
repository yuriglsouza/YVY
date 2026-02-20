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
import { Loader2, RefreshCw, FileText, Map as MapIcon, ChevronLeft, BrainCircuit, Sprout, Ruler, Trash2, DollarSign, Leaf, CloudRain, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
// ... imports ...
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, ImageOverlay } from "react-leaflet";
// ...



import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PredictiveChart } from "@/components/predictive-chart";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ReportConfigDialog, ReportConfig } from "@/components/report-config-dialog";
import { FinancialAnalysisDialog } from "@/components/financial-analysis-dialog";
import { useUser } from "@/hooks/use-user"; // Add hook

// Fix for leaflet marker icons
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// PDF Generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  const hex2rgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  // PDF Generation Logic - Strict 2 Pages Enterprise SaaS
  const handleDownloadPDF = async (reportContent: string, date: string, config?: ReportConfig) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (margin * 2); // 170mm

    const cDarkHeader = hex2rgb("#0D1B2A");
    const cEmerald = hex2rgb("#00B894");
    const cLightGray = hex2rgb("#F3F4F6");
    const cLightGreen = hex2rgb("#E6F6F1");
    const cBlueCol = hex2rgb("#E8F1FB");
    const cOrangeCol = hex2rgb("#FFF2E6");
    const cGrayFooter = hex2rgb("#F5F5F5");
    const cPrimaryText = hex2rgb("#111111");
    const cSecondaryText = hex2rgb("#6B7280");
    const cBorder = hex2rgb("#E5E7EB");

    let structuredAnalysis: any = null;
    let simpleContent = reportContent;
    try {
      if (reportContent.trim().startsWith("{")) {
        structuredAnalysis = JSON.parse(reportContent);
      }
    } catch (e) {
      console.log("Legacy text detected");
    }

    let logoData: string | null = null;
    let logoW = 0, logoH = 0;
    try {
      const img = new Image();
      img.src = '/logo.png';
      await new Promise(r => img.onload = r);
      logoData = await getBase64FromUrl('/logo.png');
      const ratio = Math.min(50 / img.width, 16 / img.height);
      logoW = img.width * ratio;
      logoH = img.height * ratio;
    } catch (e) { }

    const consultant = config?.consultantName ? `Consultor: ${config.consultantName}` : "Equipe SYAZ";

    const drawHeader = (startY: number) => {
      // 22mm Header
      doc.setFillColor(cDarkHeader[0], cDarkHeader[1], cDarkHeader[2]);
      doc.rect(0, startY, pageWidth, 22, 'F');
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, startY + 3, logoW, logoH);
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("SYAZ", margin, startY + 14);
      }
      doc.setTextColor(cEmerald[0], cEmerald[1], cEmerald[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const tt = "RELATÓRIO DE INTELIGÊNCIA DE DADOS";
      doc.text(tt, (pageWidth - doc.getTextWidth(tt)) / 2, startY + 14);

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(consultant, pageWidth - margin, startY + 14, { align: "right" });

      // Thin divider
      doc.setDrawColor(cEmerald[0], cEmerald[1], cEmerald[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, startY + 22, pageWidth - margin, startY + 22);
      return startY + 26;
    };

    // --- PAGE 1: FIXED MAP STRUCTURE ---
    let cy = drawHeader(0);

    // 2. FARM STATUS STRIP (16mm)
    doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
    doc.rect(margin, cy, contentWidth, 16, 'F');
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const dtStr = format(new Date(date), "dd/MM/yyyy");
    let fName = farm?.name.toUpperCase() || "";
    if (fName.length > 20) fName = fName.substring(0, 18) + "...";
    doc.text(`FAZENDA: ${fName}`, margin + 5, cy + 10);
    doc.text(`DATA: ${dtStr}  |  CULTURA: ${farm?.cropType.toUpperCase()}`, pageWidth / 2, cy + 10, { align: "center" });
    doc.text(`ÁREA: ${farm?.sizeHa} ha`, pageWidth - margin - 5, cy + 10, { align: "right" });
    cy += 16 + 8;

    const leftW = contentWidth * 0.45; // Approx 76.5mm
    const rightW = contentWidth * 0.51; // Approx 86.7mm
    const rightX = margin + contentWidth * 0.49; // Adding gap between cols

    const cyCols = cy;

    // ================= LEFT ZONE (MAP ANCHOR COLUMN) ================= 
    let leftCy = cyCols;
    const imgSize = 75;
    const leftCx = margin + (leftW - imgSize) / 2;

    if (latestReading?.satelliteImage) {
      try {
        const sat = await getBase64FromUrl(latestReading.satelliteImage);
        // Soft Shadow
        doc.setFillColor(245, 245, 245);
        doc.rect(leftCx + 2, leftCy + 2, imgSize, imgSize, 'F');
        // Image & Border
        doc.addImage(sat, 'JPEG', leftCx, leftCy, imgSize, imgSize);
        doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
        doc.setLineWidth(0.5);
        doc.rect(leftCx, leftCy, imgSize, imgSize, 'S');
      } catch (e) {
        doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
        doc.rect(leftCx, leftCy, imgSize, imgSize, 'F');
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
        const fw = doc.getTextWidth("Satellite Image Not Available");
        doc.text("Satellite Image Not Available", leftCx + (imgSize - fw) / 2, leftCy + (imgSize / 2));
      }
    } else {
      doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
      doc.rect(leftCx, leftCy, imgSize, imgSize, 'F');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
      const fw = doc.getTextWidth("Satellite Image Not Available");
      doc.text("Satellite Image Not Available", leftCx + (imgSize - fw) / 2, leftCy + (imgSize / 2));
    }
    leftCy += imgSize + 5;

    // Caption
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Sentinel-2 Capture | Processed by SYAZ Engine", margin + leftW / 2, leftCy, { align: "center" });
    leftCy += 20;

    // Technical Metadata Block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text("METADADOS TÉCNICOS", margin, leftCy);
    leftCy += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);

    doc.text("Última atualização:", margin, leftCy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text(`${dtStr}`, margin + leftW - 5, leftCy, { align: 'right' });
    leftCy += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Área analisada:", margin, leftCy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text(`${farm?.sizeHa} hectares`, margin + leftW - 5, leftCy, { align: 'right' });
    leftCy += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Configuração Orbital:", margin, leftCy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text(`Multi-Spectral`, margin + leftW - 5, leftCy, { align: 'right' });
    leftCy += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Resolução espacial:", margin, leftCy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text(`10m / px`, margin + leftW - 5, leftCy, { align: 'right' });


    // ================= RIGHT ZONE (EXECUTIVE ANALYSIS) =================
    let rightCy = cyCols;

    // Helper to draw rounded rects
    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      doc.roundedRect(x, y, w, h, r, r, 'F');
    };

    if (structuredAnalysis) {
      // Box 1: AI Diagnostic (Max 70mm height)
      doc.setFillColor(cLightGreen[0], cLightGreen[1], cLightGreen[2]);
      roundedRect(rightX, rightCy, rightW, 70, 2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(cEmerald[0], cEmerald[1], cEmerald[2]);
      doc.text("DIAGNÓSTICO TÉCNICO – ANÁLISE IA", rightX + 8, rightCy + 8);

      let fs = 10;
      let diagTxt = doc.splitTextToSize(structuredAnalysis.diagnostic || "-", rightW - 16);
      let lh = fs * 1.4 * 0.352;

      if (diagTxt.length * lh > 50) {
        fs = 9;
        lh = fs * 1.4 * 0.352;
        diagTxt = doc.splitTextToSize(structuredAnalysis.diagnostic || "-", rightW - 16);
        while (diagTxt.length * lh > 50 && diagTxt.length > 0) {
          diagTxt.pop();
          if (diagTxt.length > 0) diagTxt[diagTxt.length - 1] = diagTxt[diagTxt.length - 1].substring(0, 40) + '...';
        }
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs);
      doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
      doc.text(diagTxt, rightX + 8, rightCy + 16);
      rightCy += 70 + 8; // 8mm gap

      // Calculate remaining space in Right Column to balance modules
      const remH = 297 - margin - rightCy; // filling until bottom margin
      const modH = (remH - 6) / 2; // Two modules, 6mm gap between them

      // Module 1: PREVISÃO / CENÁRIO
      doc.setFillColor(cBlueCol[0], cBlueCol[1], cBlueCol[2]);
      roundedRect(rightX, rightCy, rightW, modH, 2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
      doc.text("PREVISÃO / CENÁRIO", rightX + 8, rightCy + 8);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const prTxtOrig = doc.splitTextToSize(structuredAnalysis.prediction || "-", rightW - 16);
      let pLimit = Math.floor((modH - 12) / (9 * 1.4 * 0.352));
      let prTxt = prTxtOrig.length > pLimit ? prTxtOrig.slice(0, pLimit) : prTxtOrig;
      if (prTxtOrig.length > pLimit && prTxt.length > 0) prTxt[pLimit - 1] += "...";
      doc.text(prTxt, rightX + 8, rightCy + 15);

      rightCy += modH + 6;

      // Module 2: RECOMENDAÇÕES ESTRATÉGICAS
      doc.setFillColor(cOrangeCol[0], cOrangeCol[1], cOrangeCol[2]);
      roundedRect(rightX, rightCy, rightW, modH, 2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RECOMENDAÇÕES ESTRATÉGICAS", rightX + 8, rightCy + 8);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const recRaw = Array.isArray(structuredAnalysis.recommendation) ? structuredAnalysis.recommendation : [structuredAnalysis.recommendation];
      const recBullets = recRaw.slice(0, 6).map((r: string) => `• ${r}`);
      const reTxt = doc.splitTextToSize(recBullets.join('\n'), rightW - 16);

      let rLimit = Math.floor((modH - 12) / (9 * 1.4 * 0.352));
      let reTxtF = reTxt.length > rLimit ? reTxt.slice(0, rLimit) : reTxt;
      if (reTxt.length > rLimit && reTxtF.length > 0) reTxtF[rLimit - 1] += "...";

      doc.text(reTxtF, rightX + 8, rightCy + 15);
    }

    // --- PAGE 2: ANALYTICS & PERFORMANCE DASHBOARD ---
    doc.addPage();
    cy = drawHeader(0);

    // 1. SECTION 1: OPERACIONAL CONSOLIDADO (Top 25%)
    doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
    roundedRect(margin, cy, contentWidth, 25, 2);

    // Left Accent Line
    doc.setFillColor(cEmerald[0], cEmerald[1], cEmerald[2]);
    doc.rect(margin, cy, 3, 25, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text("STATUS OPERACIONAL CONSOLIDADO", margin + 10, cy + 6);

    const ndviScore = latestReading?.ndvi || 0;
    const gScore = (ndviScore * 100).toFixed(0);
    const w1 = contentWidth / 3;

    // Col 1: Score
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Score Global", margin + 10, cy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text(`${gScore}`, margin + 10, cy + 22);

    // Col 2: Tendência
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Tendência (NDVI)", margin + 10 + w1, cy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    let trend = "Estável";
    if (readings && readings.length > 1) {
      const prev = readings[1].ndvi;
      if (ndviScore > prev + 0.05) trend = "Alta";
      if (ndviScore < prev - 0.05) trend = "Queda";
    }
    doc.setTextColor(trend === "Alta" ? cEmerald[0] : trend === "Queda" ? 220 : cSecondaryText[0],
      trend === "Alta" ? cEmerald[1] : trend === "Queda" ? 38 : cSecondaryText[1],
      trend === "Alta" ? cEmerald[2] : trend === "Queda" ? 38 : cSecondaryText[2]);
    doc.text(trend.toUpperCase(), margin + 10 + w1, cy + 22);

    // Col 3: Risco Climático
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("Risco Climático", margin + 10 + (w1 * 2), cy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const lst = latestReading?.temperature || 0;
    const climaR = lst > 35 ? "Alto" : lst > 30 ? "Moderado" : "Baixo";
    doc.setTextColor(climaR === "Baixo" ? cEmerald[0] : climaR === "Alto" ? 220 : 251,
      climaR === "Baixo" ? cEmerald[1] : climaR === "Alto" ? 38 : 191,
      climaR === "Baixo" ? cEmerald[2] : climaR === "Alto" ? 38 : 36);
    doc.text(climaR.toUpperCase(), margin + 10 + (w1 * 2), cy + 22);
    cy += 25 + 6;

    // 2. SECTION 2: MÉTRICAS PRINCIPAIS (Card Grid)
    if (latestReading) {
      const gList = [
        { label: "NDVI", val: latestReading.ndvi, min: 0, max: 1, u: "" },
        { label: "NDWI", val: latestReading.ndwi, min: -0.5, max: 0.5, u: "" },
        { label: "NDRE", val: latestReading.ndre, min: 0, max: 1, u: "" },
        { label: "OTCI", val: latestReading.otci || 0, min: 0, max: 5, u: "" },
        { label: "LST", val: latestReading.temperature || 0, min: 10, max: 40, u: "°C" }
      ];

      // Layout: 3 Top, 2 Bottom
      const cw = (contentWidth - 14) / 3;
      const ch = 28;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
      doc.text("MÉTRICAS PRINCIPAIS", margin, cy + 4);
      cy += 6;

      gList.forEach((m, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        // if 2nd row and only 2 items, center them or just left align (left align is cleaner)
        const cx = margin + (col * (cw + 7));
        const ccy = cy + (row * (ch + 6));

        // Soft shadow sim
        doc.setFillColor(245, 245, 245);
        roundedRect(cx + 1, ccy + 1, cw, ch, 2);

        doc.setFillColor(255, 255, 255);
        roundedRect(cx, ccy, cw, ch, 2);

        let p = (m.val - m.min) / (m.max - m.min);
        p = Math.max(0, Math.min(1, p));
        const isInv = m.label === "LST";
        const cGood = isInv ? 1 - p : p;

        let barColor = [220, 38, 38];
        if (cGood > 0.6) barColor = cEmerald;
        else if (cGood > 0.3) barColor = [251, 191, 36];

        // Accent line on left border
        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.roundedRect(cx, ccy, 3, ch, 2, 2, 'F');
        doc.rect(cx + 1.5, ccy, 1.5, ch, 'F');

        doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, ccy, cw, ch, 2, 2, 'S');

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
        doc.text(m.label, cx + 8, ccy + 6);

        // Value
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
        doc.text(m.val.toFixed(2) + m.u, cx + 8, ccy + 18);

        // Simple Progress Bar
        const barW = cw - 16;
        doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
        doc.rect(cx + 8, ccy + 22, barW, 3, 'F');

        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.rect(cx + 8, ccy + 22, barW * p, 3, 'F');
      });
      cy += (ch * 2) + 12;
    } else {
      cy += 70;
    }

    // 3. SECTION 3: HISTÓRICO NDVI (Full width Chart - Line)
    if (readings && readings.length > 1) {
      const tdAgo = new Date();
      tdAgo.setDate(tdAgo.getDate() - 30);
      const chD = [...readings].filter(r => new Date(r.date) >= tdAgo).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (chD.length > 0) {
        const cH = 35;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
        doc.text("VIGOR (NDVI) – ÚLTIMOS 30 DIAS", margin, cy + 4);

        const gY = cy + 8;
        doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
        doc.setLineWidth(0.2);
        doc.line(margin, gY, margin + contentWidth, gY);
        doc.line(margin, gY + (cH / 2), margin + contentWidth, gY + (cH / 2));
        doc.line(margin, gY + cH, margin + contentWidth, gY + cH);

        doc.setDrawColor(cBlueCol[0] - 25, cBlueCol[1] - 25, cBlueCol[2] - 10);
        doc.setLineWidth(1);

        const ptX = (idx: number) => margin + (idx * (contentWidth / Math.max(1, chD.length - 1)));
        const ptY = (v: number) => gY + (cH - Math.min(Math.max((v / 1.0) * cH, 0), cH));

        for (let i = 0; i < chD.length - 1; i++) {
          doc.line(ptX(i), ptY(chD[i].ndvi), ptX(i + 1), ptY(chD[i + 1].ndvi));
        }

        doc.setFillColor(cBlueCol[0] - 25, cBlueCol[1] - 25, cBlueCol[2] - 10);
        chD.forEach((r, i) => {
          doc.circle(ptX(i), ptY(r.ndvi), 1.2, 'F');
        });

        doc.setFontSize(8);
        doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
        doc.setFont("helvetica", "normal");
        doc.text(format(new Date(chD[0].date), "dd/MM"), margin, gY + cH + 4);
        doc.text(format(new Date(chD[chD.length - 1].date), "dd/MM"), margin + contentWidth, gY + cH + 4, { align: 'right' });
        cy += cH + 18;
      }
    } else {
      cy += 40;
    }

    // 4. SECTION 4: ESG + FINANCE
    const mdW = (contentWidth - 10) / 2;

    let defaultEsg = "A área monitorada apresenta indicativos sólidos de manejo sustentável, mantendo um balanço de carbono estruturalmente positivo. As práticas atuais estão alinhadas rigorosamente aos principais protocolos ESG (Ambiental, Social e Governança) globais validados de forma autônoma pela SYAZ IA. Esse cenário promove a conservação contínua da biomassa e favorece destacadamente a elegibilidade operacional da fazenda para futuras emissões de certificações verdes e auditorias de compliance.";
    let eL = doc.splitTextToSize(defaultEsg, mdW - 10);
    if (structuredAnalysis?.esg && structuredAnalysis.esg !== '-') {
      eL = doc.splitTextToSize(structuredAnalysis.esg, mdW - 10);
    }

    // Altura Dinâmica da Caixa com base no número de linhas de eL
    const linesH = eL.length * 3.5; // Espaçamento aproximado por linha
    const mdH = 26 + linesH; // 26mm base (padding + labels Carbono) + altura do texto flexível

    // ESG BOX
    doc.setFillColor(cLightGreen[0], cLightGreen[1], cLightGreen[2]);
    roundedRect(margin, cy, mdW, mdH, 2);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cEmerald[0], cEmerald[1], cEmerald[2]);
    doc.text("SUSTENTABILIDADE (ESG)", margin + 5, cy + 6);
    doc.setFontSize(10);
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.setFont("helvetica", "normal");
    const cs = latestReading?.carbonStock ?? 0;
    const co = latestReading?.co2Equivalent ?? 0;
    doc.text("Estoque Carbono:", margin + 5, cy + 12);
    doc.setFont("helvetica", "bold");
    doc.text(`${cs.toFixed(1)} t`, margin + mdW - 5, cy + 12, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.text("CO2 Eq.:", margin + 5, cy + 17);
    doc.setFont("helvetica", "bold");
    doc.text(`${co.toFixed(1)} tCO2e`, margin + mdW - 5, cy + 17, { align: 'right' });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text(eL, margin + 5, cy + 24, { lineHeightFactor: 1.2 });

    // FINANCE
    const fiX = margin + mdW + 10;
    doc.setFillColor(cLightGray[0], cLightGray[1], cLightGray[2]);
    roundedRect(fiX, cy, mdW, mdH, 2);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text("ANÁLISE FINANCEIRA", fiX + 5, cy + 6);

    if (config?.financials && config?.includeFinancials) {
      const { costPerHa, pricePerBag, yields } = config.financials;
      let prd = farm.sizeHa * yields.medium;
      if (zones.length > 0) {
        const hZ = zones.find(z => z.name.includes("Alta"))?.area_percentage || 0;
        const mZ = zones.find(z => z.name.includes("Média"))?.area_percentage || 0;
        const lZ = zones.find(z => z.name.includes("Baixa"))?.area_percentage || 0;
        prd = ((hZ * farm.sizeHa * yields.high) + (mZ * farm.sizeHa * yields.medium) + (lZ * farm.sizeHa * yields.low));
      }
      const cT = farm.sizeHa * costPerHa;
      const gR = prd * pricePerBag;
      const nP = gR - cT;
      const roi = cT > 0 ? (nP / cT) * 100 : 0;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Custo Total:", fiX + 5, cy + 12);
      doc.text(`R$ ${(cT / 1000).toFixed(1)}k`, fiX + mdW - 5, cy + 12, { align: 'right' });
      doc.text("Receita Bruta:", fiX + 5, cy + 17);
      doc.text(`R$ ${(gR / 1000).toFixed(1)}k`, fiX + mdW - 5, cy + 17, { align: 'right' });
      doc.setFont("helvetica", "bold");
      doc.text("Lucro Líquido:", fiX + 5, cy + 22);
      doc.text(`R$ ${(nP / 1000).toFixed(1)}k`, fiX + mdW - 5, cy + 22, { align: 'right' });
      doc.text("ROI:", fiX + 5, cy + 28);
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235); // Slight blue accent
      doc.text(`${roi.toFixed(0)}%`, fiX + mdW - 5, cy + 28, { align: 'right' });
    }
    cy += mdH + 6;



    // --- FOOTER EXCLUSIVO DA PÁGINA 2 ---
    const fY = pageHeight - margin - 20;
    doc.setFillColor(cGrayFooter[0], cGrayFooter[1], cGrayFooter[2]);
    roundedRect(margin, fY, contentWidth, 20, 2);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(cSecondaryText[0], cSecondaryText[1], cSecondaryText[2]);
    doc.text("GLOSSÁRIO: NDVI/NDRE vigores fotossintéticos | OTCI Clorofila | NDWI estresse hídrico | LST temperatura.", margin + 4, fY + 6);
    doc.text("FONTE: ESA Sentinel-2 processed by SYAZ Engine.", margin + 4, fY + 11);
    doc.text("LEGAL: Este reporte gerado via SYAZ SaaS tem fins preditivos e auxiliares. Valide in-loco para decisões finais.", margin + 4, fY + 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cPrimaryText[0], cPrimaryText[1], cPrimaryText[2]);
    doc.text("Página 2 de 2", margin + contentWidth - 4, fY + 14, { align: 'right' });

    doc.save(`SYAZ_Report_${farm?.name}_${date}.pdf`);
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


        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" />
              Monitoramento
            </TabsTrigger>
            <TabsTrigger value="sustainability" className="gap-2">
              <Sprout className="w-4 h-4" />
              Sustentabilidade (ESG)
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

                      {latestReading?.satelliteImage && !!latestReading?.imageBounds && (
                        <LayersControl.Overlay checked name="Análise Espectral (NDVI)">
                          <ImageOverlay
                            url={latestReading.satelliteImage}
                            bounds={latestReading.imageBounds as unknown as [[number, number], [number, number]]}
                            opacity={0.7}
                          />
                        </LayersControl.Overlay>
                      )}

                      {latestReading?.thermalImage && !!latestReading?.imageBounds && (
                        <LayersControl.Overlay name="Mapa Térmico (LST)">
                          <ImageOverlay
                            url={latestReading.thermalImage}
                            bounds={latestReading.imageBounds as unknown as [[number, number], [number, number]]}
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
            </div>
          </TabsContent>

          <TabsContent value="sustainability" className="space-y-8 animate-in fade-in-50 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-500/20 rounded-full">
                    <Leaf className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Estoque de Carbono</p>
                    <h3 className="text-2xl font-bold">{latestReading?.carbonStock?.toFixed(1) || 0} t</h3>
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
                    <h3 className="text-2xl font-bold">{latestReading?.co2Equivalent?.toFixed(1) || 0} tCO2e</h3>
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
                    <h3 className="text-2xl font-bold">R$ {((latestReading?.co2Equivalent || 0) * 15 * 5.5).toFixed(2)}</h3>
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
                  <AreaChart data={readings
                    ?.filter(r => r.co2Equivalent && r.co2Equivalent > 0)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []}>
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
                    <Area type="monotone" dataKey="co2Equivalent" stroke="#10b981" fillOpacity={1} fill="url(#colorCo2)" />
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
          </TabsContent>
        </Tabs>

      </main >
    </div >
  );
}
