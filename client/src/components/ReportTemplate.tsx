import React from "react";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Leaf, Droplets, Thermometer, Wind, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { Farm, Reading } from "@shared/schema";

interface ReportTemplateProps {
    farm: Farm;
    currentReading: Reading | null;
    previousReading: Reading | null; // For comparison map
    historyData: any[]; // For the chart
    aiReport: string | null;
    consultantName?: string;
}

export const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>(({
    farm,
    currentReading,
    previousReading,
    historyData,
    aiReport,
    consultantName
}, ref) => {

    const currentDate = currentReading ? new Date(currentReading.date) : new Date();

    // Parse structural AI report if valid JSON, otherwise fallback to simple text
    let parsedReport = null;
    try {
        if (aiReport && aiReport.startsWith("{")) {
            parsedReport = JSON.parse(aiReport);
        }
    } catch (e) { }

    // Determine Status
    const statusColor = parsedReport?.status === 'Crítico' ? 'text-red-600 bg-red-50 border-red-200' :
        parsedReport?.status === 'Bom' ? 'text-amber-600 bg-amber-50 border-amber-200' :
            'text-emerald-700 bg-emerald-50 border-emerald-200';

    const StatusIcon = parsedReport?.status === 'Crítico' ? AlertTriangle :
        parsedReport?.status === 'Bom' ? Info : CheckCircle;

    return (
        // Wrapper total que o html2canvas vai fotografar
        <div ref={ref} className="bg-white text-gray-900 w-[210mm] min-h-[297mm] p-0 m-0 absolute top-[-9999px] left-[-9999px]">

            {/* ====== HEADER OFICIAL ====== */}
            <div className="bg-[#0D1B2A] text-white w-full h-[30mm] flex items-center justify-between px-10">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="SYAZ Logo" className="h-[15mm] object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <h1 className="text-3xl font-bold tracking-tight text-white m-0 self-center uppercase">SYAZ <span className="text-[#059669]">AGRO</span></h1>
                </div>
                <div className="text-right">
                    <h2 className="text-[#E6F6F1] text-lg font-bold mb-1">RELATÓRIO DE AUDITORIA TÉCNICA</h2>
                    <p className="text-sm text-gray-400">Consultor: {consultantName || "Equipe SYAZ"}</p>
                </div>
            </div>

            {/* ====== PÁGINA 1: RESUMO EXECUTIVO ====== */}
            <div className="px-10 py-8 w-[210mm] h-[267mm] box-border relative">

                {/* Meta-Strip */}
                <div className="flex bg-gray-50 rounded-lg p-4 border border-gray-200 mb-8 justify-between items-center shadow-sm">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Unidade Produtiva</p>
                        <p className="text-lg font-bold text-gray-900 truncate max-w-[60mm]">{farm.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Data de Emissão</p>
                        <p className="text-lg font-bold text-gray-900">{format(currentDate, "dd/MM/yyyy")}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Safra / Cultura</p>
                        <p className="text-lg font-bold text-gray-900 uppercase">{farm.cropType}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase font-bold">Área Total</p>
                        <p className="text-lg font-bold text-gray-900 text-[#059669]">{farm.sizeHa} ha</p>
                    </div>
                </div>

                {/* Bloco 2: Alerta Principal e Texto da IA */}
                <div className="flex gap-6 h-[100mm]">
                    {/* Alerta Visual (Dashboard Style) */}
                    <div className={`w-[60mm] h-full rounded-xl border ${statusColor} p-6 flex flex-col items-center justify-center text-center`}>
                        <StatusIcon className="w-20 h-20 mb-4 opacity-80" />
                        <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-2">Classificação de Risco</h3>
                        <p className="text-4xl font-black uppercase tracking-tighter shadow-sm">{parsedReport?.status || "Avaliando"}</p>
                        <div className="mt-8 border-t border-current w-full pt-4 opacity-60">
                            <p className="text-sm font-bold">Impacto Estimado</p>
                            <p className="text-2xl font-bold">{parsedReport?.impacto || "N/A"}</p>
                        </div>
                    </div>

                    {/* Parecer Técnico (IA) */}
                    <div className="flex-1 bg-white flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">I. Parecer Técnico - Inteligência Artificial</h3>
                            <div className="text-sm text-gray-700 text-justify leading-relaxed whitespace-pre-wrap">
                                {parsedReport ? (
                                    <>
                                        <p className="mb-3"><strong>1. Resumo Diagnóstico:</strong> {parsedReport.summary}</p>
                                        <p className="mb-3"><strong>2. Análise Temporal:</strong> {parsedReport.history}</p>
                                        <p className="mb-3"><strong>3. Recomendações:</strong> {parsedReport.recomendacoes}</p>
                                    </>
                                ) : (
                                    <p>{aiReport}</p>
                                )}
                            </div>
                        </div>

                        {/* Metadados Técnicos Compactos */}
                        <div className="mt-auto grid grid-cols-4 gap-2 border-t border-gray-100 pt-4">
                            <div className="bg-gray-50 p-2 rounded">
                                <p className="text-[10px] text-gray-500 font-bold uppercase"><Leaf className="inline w-3 h-3 mr-1" />NDVI Médio</p>
                                <p className="font-bold text-green-700 text-lg">{currentReading?.ndvi?.toFixed(2) || "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <p className="text-[10px] text-gray-500 font-bold uppercase"><Droplets className="inline w-3 h-3 mr-1" />NDWI Hídrico</p>
                                <p className="font-bold text-blue-700 text-lg">{currentReading?.ndwi?.toFixed(2) || "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <p className="text-[10px] text-gray-500 font-bold uppercase"><Thermometer className="inline w-3 h-3 mr-1" />Temp. Solo</p>
                                <p className="font-bold text-orange-700 text-lg">{currentReading?.temperature ? `${currentReading.temperature.toFixed(1)}°C` : "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <p className="text-[10px] text-gray-500 font-bold uppercase"><Wind className="inline w-3 h-3 mr-1" />Nuvens</p>
                                <p className="font-bold text-gray-700 text-lg">{currentReading?.cloudCover ? `${(currentReading.cloudCover * 100).toFixed(0)}%` : "N/A"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Página 1 - Assinatura e QR Code */}
                <div className="absolute bottom-10 left-10 right-10 flex border-t border-gray-200 pt-6 justify-between items-end">
                    <div className="w-[80mm] border-t border-gray-400 text-center pt-2">
                        <p className="font-bold text-sm text-gray-800">Assinatura do Consultor</p>
                        <p className="text-xs text-gray-500">Documento gerado eletronicamente em {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-800">Autenticidade do Relatório</p>
                            <p className="text-[10px] text-gray-500 max-w-[40mm]">Valide o chassi virtual e registro público utilizando o QR Code ao lado.</p>
                        </div>
                        <div className="p-1 bg-white border border-gray-200 rounded">
                            <QRCode
                                value={`https://yvy.system/report/verify?f=${farm.id}&d=${format(new Date(), "yyyyMMdd")}`}
                                size={50}
                            />
                        </div>
                    </div>
                </div>

                {/* Number mark */}
                <span className="absolute bottom-4 right-4 text-[10px] text-gray-400">1/2</span>
            </div>


            {/* ========================================================== */}
            {/* ====== PÁGINA 2: EVIDÊNCIAS VISUAIS (MAPAS E GRÁFICOS) === */}
            {/* ========================================================== */}
            <div className="px-10 py-10 w-[210mm] h-[297mm] box-border relative border-t-[30mm] border-transparent" style={{ marginTop: '0' }}>

                <h3 className="text-xl font-bold text-gray-800 border-b border-gray-300 pb-2 mb-6">II. Evidências Visuais Espaciais</h3>

                {/* Seção de Mapas Comparativos */}
                <div className="flex justify-between gap-6 mb-10 w-full">
                    {/* Leitura Anterior */}
                    <div className="w-1/2 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col bg-gray-50">
                        <div className="bg-gray-100 p-3 text-center border-b border-gray-200">
                            <p className="font-bold text-sm text-gray-600">Leitura Anterior</p>
                            <p className="text-xs text-gray-500">{previousReading ? format(new Date(previousReading.date), "dd/MM/yyyy") : "Sem registro anterior"}</p>
                        </div>
                        <div className="h-[75mm] w-full flex items-center justify-center bg-gray-200">
                            {previousReading?.satelliteImage ? (
                                <img src={previousReading.satelliteImage} className="w-full h-full object-cover" crossOrigin="anonymous" />
                            ) : (
                                <span className="text-xs text-gray-400">Indisponível</span>
                            )}
                        </div>
                    </div>

                    {/* Leitura Atual */}
                    <div className="w-1/2 rounded-xl overflow-hidden border-2 border-[#059669] shadow-md flex flex-col bg-white">
                        <div className="bg-[#E6F6F1] p-3 text-center border-b border-[#059669] border-opacity-20">
                            <p className="font-bold text-sm text-[#059669]">Cenário Atual (Vigor Verde NDVI)</p>
                            <p className="text-xs text-[#059669] font-medium">{currentReading ? format(new Date(currentReading.date), "dd/MM/yyyy") : "Hoje"}</p>
                        </div>
                        <div className="h-[75mm] w-full flex items-center justify-center bg-gray-100 relative">
                            {currentReading?.satelliteImage ? (
                                <img src={currentReading.satelliteImage} className="w-full h-full object-cover" crossOrigin="anonymous" />
                            ) : (
                                <span className="text-xs text-gray-400">Indisponível</span>
                            )}
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold shadow">
                                L2A Sentinel-2
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção Gráfico Preditivo (Recharts) */}
                <h3 className="text-xl font-bold text-gray-800 border-b border-gray-300 pb-2 mb-6">III. Curva de Crescimento e Projeção (NDVI)</h3>
                <div className="w-full h-[80mm] bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    {historyData && historyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => format(new Date(val), "dd/MM")}
                                    tick={{ fontSize: 10 }}
                                    stroke="#9CA3AF"
                                />
                                <YAxis
                                    domain={[0, 1]}
                                    tick={{ fontSize: 10 }}
                                    stroke="#9CA3AF"
                                />
                                {/* Linha NDVI Real */}
                                <Line
                                    type="monotone"
                                    dataKey="ndvi"
                                    name="NDVI Medido"
                                    stroke="#059669"
                                    strokeWidth={3}
                                    dot={{ fill: '#059669', r: 4 }}
                                />
                                {/* Linha de Projeção ML (Se existir) */}
                                {historyData.some(d => d.predictedNdvi !== undefined) && (
                                    <Line
                                        type="monotone"
                                        dataKey="predictedNdvi"
                                        name="Projeção ML"
                                        stroke="#10B981"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                            Dados temporais insuficientes para gerar a curva preditiva.
                        </div>
                    )}
                </div>

                <span className="absolute bottom-4 right-4 text-[10px] text-gray-400">2/2</span>
            </div>

            {/* The canvas screenshot stops here. A4 size strictly preserved via Tailwind widths */}
        </div>
    );
});

ReportTemplate.displayName = "ReportTemplate";
