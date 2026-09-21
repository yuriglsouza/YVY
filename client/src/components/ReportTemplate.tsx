import React from "react";
import { formatAreaHa } from "@/lib/format";
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
    readings?: Reading[];
    zones?: any[];
}

export const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>(({
    farm,
    currentReading: sourceReading,
    previousReading: sourcePreviousReading,
    historyData: sourceHistory,
    aiReport,
    consultantName,
    readings: sourceReadings,
    zones
}, ref) => {

    const isUsableReading = (r: Reading | null) => !!r && !r.isSimulated && !r.satelliteImage?.includes("images.unsplash.com");
    const containsSimulation = [sourceReading, sourcePreviousReading, ...(sourceReadings || [])].some(r => r && !isUsableReading(r));
    const currentReading = isUsableReading(sourceReading) ? sourceReading : null;
    const previousReading = isUsableReading(sourcePreviousReading) ? sourcePreviousReading : null;
    const readings = (sourceReadings || []).filter(isUsableReading);
    const historyData = sourceHistory.filter(r => !r.isSimulated && !r.satelliteImage?.includes("images.unsplash.com"));
    const readingDate = (date: string) => new Date(date.length === 10 ? date + "T12:00:00" : date);
    const currentDate = currentReading ? readingDate(currentReading.date) : null;

    // Parse structural AI report if valid JSON, otherwise fallback to simple text
    // Handles markdown block injections from LLMs (```json / ```)
    let parsedReport = null;
    try {
        if (aiReport) {
            const cleanReport = aiReport.replace(/```json/gi, '').replace(/```/g, '').trim();
            if (cleanReport.startsWith("{")) {
                parsedReport = JSON.parse(cleanReport);
            }
        }
    } catch (e) {
        console.error("AI Parse Error:", e);
    }

    // Marca SYAZ:
    // Azul Escuro Primário: #2F447F
    // Azul Profundo (Destaque): #172649
    // Cinza de Apoio: #D0D0D0
    // Preto: #000000

    // Determine Status Colors (adapting brand DNA logic)
    const ndviVal = currentReading?.ndvi || 0;
    const isCritical = parsedReport?.status === 'Crítico' || ndviVal < 0.45;
    const isGood = parsedReport?.status === 'Bom' || ndviVal > 0.65;

    const statusText = !currentReading ? 'SEM DADOS' : parsedReport?.status || (isCritical ? 'CRÍTICO' : isGood ? 'BOM' : 'MODERADO');
    const impactoText = 'Não quantificado';

    // Fallbacks visuais corporativos
    const statusColor = isCritical ? 'text-red-700 bg-red-50 border-red-300' :
        isGood ? 'text-[#172649] bg-[#ebf0f9] border-[#2F447F]' :
            'text-amber-700 bg-amber-50 border-amber-300'; // SYAZ Excellent Standard

    const StatusIcon = isCritical ? AlertTriangle :
        isGood ? CheckCircle : Info;

    let rdsForTable: any[] = [];

    if (readings && readings.length > 0) {
        rdsForTable = readings.slice(0, 10).map(r => ({
            date: format(readingDate(r.date), "dd/MM/yyyy"),
            ndvi: (r.ndvi || 0).toFixed(3),
            ndwi: (r.ndwi || 0).toFixed(3),
            temp: (r.temperature || 0).toFixed(1) + "°C",
            clouds: ((r.cloudCover || 0) * 100).toFixed(0) + "%"
        }));
    }

    // Only display zones supplied by the selected analysis.
    const znData = zones && zones.length > 0
        ? zones.map((z: any) => {
            const nv = parseFloat(z.ndvi_avg || z.ndviAvg || z.ndvi) || 0;
            const area = parseFloat(z.areaHa || z.area_ha || z.area) || 0;
            const riskClass = nv < 0.45 ? "ZONA CRÍTICA" : nv < 0.60 ? "Médio" : "Baixo";
            return {
                zone: z.name || z.label || `Zona`,
                ndvi: nv ? nv.toFixed(2) : "N/A",
                area: area ? (area * 10000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : "N/A",
                risk: riskClass,
                isRisk: nv < 0.45
            };
        })
        : [];

    const getProxyUrl = (url?: string) => {
        if (!url) return undefined;
        // Se for URL do Supabase, não precisa de proxy, pois é pública e tem CORS configurado
        if (url.includes('supabase.co')) return url;
        // Se for URL legada do Earth Engine, tentamos o proxy, mas se der 500 vai falhar graciosamente no onErrord a <img>
        if (url.includes(window.location.host) || url.includes('/api/proxy') || url.includes('data:image')) return url;
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    };

    return (
        // Forçando font-sans geral e Arial nos h1/h3
        <div ref={ref} className="bg-white text-black w-[210mm] min-h-[891mm] p-0 m-0 absolute top-[-9999px] left-[-9999px] font-sans">

            {/* ====== HEADER OFICIAL ====== */}
            <div className="bg-[#2F447F] text-white w-[210mm] h-[30mm] flex items-center justify-between px-10 shrink-0 border-b-4 border-[#172649]">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="SYAZ Logo" className="h-[15mm] object-contain bg-white/10 p-1 rounded" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <h1 className="text-3xl tracking-tight text-white m-0 self-center uppercase" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>SYAZ <span className="opacity-80">AGRO</span></h1>
                </div>
                <div className="text-right">
                    <h2 className="text-white text-lg mb-1" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>RELATÓRIO DE MONITORAMENTO</h2>
                    <p className="text-sm font-light text-gray-200">Consultor: <span className="font-bold">{consultantName || "Equipe SYAZ"}</span></p>
                </div>
            </div>

            {/* ====== PÁGINA 1: RESUMO EXECUTIVO ====== */}
            <div className="px-10 py-8 w-[210mm] h-[267mm] box-border relative border-b border-[#D0D0D0]">

                {containsSimulation && <p className="text-xs text-amber-800 mb-2">Registros simulados ou com imagens ilustrativas foram excluídos desta exportação.</p>}
                {/* Meta-Strip */}
                <div className="flex bg-gray-50 rounded p-4 border border-[#D0D0D0] mb-8 justify-between items-center shadow-sm">
                    <div>
                        <p className="text-[10px] text-[#2F447F] uppercase font-bold tracking-wider">Unidade Produtiva</p>
                        <p className="text-lg font-bold text-[#172649] pb-1 truncate max-w-[120mm]">{farm.name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-[#2F447F] uppercase font-bold tracking-wider">Data da Leitura</p>
                        <p className="text-lg font-bold text-[#172649]">{currentDate ? format(currentDate, "dd/MM/yyyy") : "Sem leitura"}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-[#2F447F] uppercase font-bold tracking-wider">Safra / Cultura</p>
                        <p className="text-lg font-bold text-[#172649] uppercase">{farm.cropType}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-[#2F447F] uppercase font-bold tracking-wider">Área Total</p>
                        <p className="text-lg font-bold text-[#2F447F]">{formatAreaHa(farm.sizeHa)}</p>
                    </div>
                </div>

                {/* Bloco 2: Alerta Principal e Texto da IA */}
                <div className="flex gap-8 h-[110mm]">
                    {/* Alerta Visual (Dashboard Style) */}
                    <div className={`w-[70mm] h-full rounded shadow-sm border ${statusColor} p-6 flex flex-col items-center justify-center text-center`}>
                        <StatusIcon className="w-24 h-24 mb-6 opacity-90" />
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Classificação de Risco</h3>
                        <p className="text-4xl font-black uppercase tracking-tighter" style={{ fontFamily: 'Arial, sans-serif' }}>{statusText}</p>
                        <div className="mt-8 border-t border-current w-full pt-4 opacity-75">
                            <p className="text-xs font-bold uppercase tracking-wider mb-1">Impacto Estimado</p>
                            <p className="text-lg font-bold">{impactoText}</p>
                        </div>
                    </div>

                    {/* Parecer Técnico (IA) */}
                    <div className="flex-1 bg-white flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl text-[#172649] border-b-2 border-[#D0D0D0] pb-2 mb-4" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>I. Parecer Técnico - Inteligência Artificial</h3>
                            <div className="text-sm text-black text-justify leading-relaxed whitespace-pre-wrap">
                                {parsedReport ? (
                                    <>
                                        <div className="mb-4">
                                            <p className="text-xs text-[#2F447F] font-bold uppercase tracking-wider mb-1">1. Diagnóstico Atual</p>
                                            <p className="font-light">{parsedReport.diagnostic || "Análise preliminar das bandas espectrais em andamento."}</p>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs text-[#2F447F] font-bold uppercase tracking-wider mb-1">2. Predição Climática e Interpretação</p>
                                            <p className="font-light">{parsedReport.prediction || "Modelagem de impacto em processo de cálculo."}</p>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs text-[#2F447F] font-bold uppercase tracking-wider mb-1">3. Recomendações Técnicas</p>
                                            <ul className="font-light list-disc pl-4 text-sm marker:text-[#2F447F]">
                                                {Array.isArray(parsedReport.recommendation)
                                                    ? parsedReport.recommendation.map((r: string, idx: number) => <li key={idx} className="mb-1">{r}</li>)
                                                    : <li>{parsedReport.recommendation || "Monitorar índices quinzenais regularmente."}</li>
                                                }
                                            </ul>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs text-[#2F447F] font-bold uppercase tracking-wider mb-1">4. Evolução do Período</p>
                                            <p className="font-light">
                                                {(() => {
                                                    if (!currentReading || !previousReading) return "Histórico selecionado insuficiente para cálculo evolutivo.";

                                                    const current = currentReading;
                                                    const past = previousReading;

                                                    if (!current.ndvi || !past.ndvi) return "Dados de vigor corrompidos no período selecionado.";

                                                    const deltaNdvi = current.ndvi - past.ndvi;
                                                    const percentChange = (deltaNdvi / past.ndvi) * 100;
                                                    const daysDiff = Math.max(1, Math.abs(Math.floor((new Date(current.date).getTime() - new Date(past.date).getTime()) / (1000 * 60 * 60 * 24))));

                                                    const direction = deltaNdvi > 0 ? "avanço" : deltaNdvi < 0 ? "retração" : "estabilidade";
                                                    const colorSpan = deltaNdvi > 0 ? "text-green-600 font-medium" : deltaNdvi < 0 ? "text-red-600 font-medium" : "text-gray-600 font-medium";

                                                    return (
                                                        <span>
                                                            Comparado à leitura de {daysDiff} dias atrás ({format(new Date(past.date), 'dd/MM/yyyy')}), a área apresentou um <span className={colorSpan}>{direction} de {Math.abs(percentChange).toFixed(1)}%</span> no índice de biomassa (de {past.ndvi.toFixed(2)} para {current.ndvi.toFixed(2)}).
                                                        </span>
                                                    );
                                                })()}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="font-light italic text-[#2F447F]">Relatório textual legado: <br />{aiReport}</p>
                                )}
                            </div>
                        </div>

                        {/* Metadados Técnicos Compactos */}
                        <div className="mt-auto grid grid-cols-4 gap-3 border-t border-[#D0D0D0] pt-4">
                            <div className="bg-gray-50 border border-gray-100 p-3 rounded">
                                <p className="text-[9px] text-[#2F447F] font-bold uppercase mb-1"><Leaf className="inline w-3 h-3 mr-1" />NDVI Médio</p>
                                <p className="font-bold text-[#172649] text-xl">{currentReading?.ndvi?.toFixed(2) || "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 p-3 rounded">
                                <p className="text-[9px] text-[#2F447F] font-bold uppercase mb-1"><Droplets className="inline w-3 h-3 mr-1" />NDWI Hídrico</p>
                                <p className="font-bold text-[#172649] text-xl">{currentReading?.ndwi?.toFixed(2) || "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 p-3 rounded">
                                <p className="text-[9px] text-[#2F447F] font-bold uppercase mb-1"><Thermometer className="inline w-3 h-3 mr-1" />Temp. Solo</p>
                                <p className="font-bold text-[#172649] text-xl">{currentReading?.temperature ? `${currentReading.temperature.toFixed(1)}°C` : "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 p-3 rounded">
                                <p className="text-[9px] text-[#2F447F] font-bold uppercase mb-1"><Wind className="inline w-3 h-3 mr-1" />Nuvens</p>
                                <p className="font-bold text-[#172649] text-xl">{currentReading?.cloudCover ? `${(currentReading.cloudCover * 100).toFixed(0)}%` : "N/A"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Página 1 */}
                <div className="absolute bottom-6 left-10 right-10 flex border-t border-[#D0D0D0] pt-6 justify-between items-end">
                    <div className="w-[80mm] border-t border-black text-center pt-2 mt-auto mb-2">
                        <p className="font-bold text-sm text-[#172649] uppercase">Assinatura do Consultor</p>
                        <p className="text-[10px] text-gray-500 font-light">Documento gerado eletronicamente em {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="text-right">
                            <p className="text-xs font-bold text-[#172649] uppercase">Consultar Fazenda</p>
                            <p className="text-[9px] text-gray-500 max-w-[40mm] font-light">Acesse a fazenda no sistema. O acesso pode exigir login.</p>
                        </div>
                        <div className="p-1.5 bg-white border-2 border-[#2F447F] rounded">
                            <QRCode value={`${typeof window === "undefined" ? "https://yvy-g8z9.vercel.app" : window.location.origin}/farms/${farm.id}`} size={50} fgColor="#172649" />
                        </div>
                    </div>
                </div>
                <span className="absolute bottom-2 right-10 text-[9px] text-gray-400 font-bold uppercase tracking-widest">Página 1 de 3</span>
            </div>


            {/* ========================================================== */}
            {/* ====== PÁGINA 2: EVIDÊNCIAS VISUAIS (MAPAS E GRÁFICOS) === */}
            {/* ========================================================== */}
            <div className="px-10 py-10 w-[210mm] h-[297mm] box-border relative border-b border-[#D0D0D0] bg-white">

                <h3 className="text-xl text-[#172649] border-b-2 border-[#D0D0D0] pb-2 mb-6" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>II. Evidências Visuais Espaciais</h3>

                <div className="flex justify-between gap-6 mb-10 w-full">
                    <div className="w-1/2 rounded shadow flex flex-col border border-[#D0D0D0]">
                        <div className="bg-gray-100 p-3 text-center border-b border-[#D0D0D0]">
                            <p className="font-bold text-xs text-[#2F447F] uppercase tracking-wider">Leitura Anterior</p>
                            <p className="text-sm font-light text-gray-600">{previousReading ? format(readingDate(previousReading.date), "dd/MM/yyyy") : "Sem registro anterior"}</p>
                        </div>
                        <div className="h-[75mm] w-full flex items-center justify-center bg-gray-200 relative">
                            {(() => {
                                if (!previousReading?.satelliteImage) {
                                    return <span className="text-xs text-gray-500 font-light px-4 text-center">Indisponível<br/><span className="text-[10px]">Sem leitura anterior registrada</span></span>;
                                }
                                if (previousReading.satelliteImage.includes("earthengine.googleapis.com")) {
                                    return <span className="text-xs text-gray-500 font-light px-4 text-center">Imagem anterior indisponível<br/><span className="text-[10px]">Motivo: leitura antiga sem imagem permanente.</span></span>;
                                }
                                return (
                                    <>
                                        <img
                                            src={getProxyUrl(previousReading.satelliteImage)}
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold shadow text-[#172649] border border-[#2F447F]">
                                            L2A Sentinel-2 / Histórico
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="w-1/2 rounded shadow flex flex-col border-2 border-[#2F447F]">
                        <div className="bg-[#2F447F] p-3 text-center">
                            <p className="font-bold text-xs text-white uppercase tracking-wider">Cenário Atual (Vigor Verde NDVI)</p>
                            <p className="text-sm font-light text-gray-200">{currentReading ? format(readingDate(currentReading.date), "dd/MM/yyyy") : "Sem leitura"}</p>
                        </div>
                        <div className="h-[75mm] w-full flex items-center justify-center bg-gray-100 relative">
                            {currentReading?.satelliteImage ? (
                                <img
                                    src={getProxyUrl(currentReading.satelliteImage)}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                />
                            ) : (
                                <span className="text-xs text-gray-400 font-light">Indisponível</span>
                            )}
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold shadow text-[#172649] border border-[#2F447F]">
                                L2A Sentinel-2
                            </div>
                        </div>
                    </div>
                </div>

                <h3 className="text-xl text-[#172649] border-b-2 border-[#D0D0D0] pb-2 mb-6" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>III. Curva de Crescimento e Projeção (NDVI)</h3>
                <div className="w-full h-[80mm] bg-white border border-[#D0D0D0] rounded p-6 shadow-sm mb-6">
                    {historyData && historyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D0D0D0" />
                                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), "dd/MM")} tick={{ fontSize: 10 }} stroke="#172649" />
                                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} stroke="#172649" />
                                <Line type="monotone" dataKey="ndvi" name="NDVI Medido" stroke="#2F447F" strokeWidth={3} dot={{ fill: '#172649', r: 4 }} />
                                {historyData.some(d => d.predictedNdvi !== undefined) && (
                                    <Line type="monotone" dataKey="predictedNdvi" name="Projeção ML" stroke="#60A5FA" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-light">Dados insuficientes para a curva preditiva.</div>
                    )}
                </div>

                <span className="absolute bottom-4 right-10 text-[9px] text-gray-400 font-bold uppercase tracking-widest">Página 2 de 3</span>
            </div>


            {/* ========================================================== */}
            {/* ====== PÁGINA 3: TABELAS, INFORMAÇÕES TÉCNICAS E MÉTRICAS == */}
            {/* ========================================================== */}
            <div className="px-10 py-10 w-[210mm] h-[297mm] box-border relative bg-white">

                <h3 className="text-xl text-[#172649] border-b-2 border-[#D0D0D0] pb-2 mb-4" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>IV. Tabelas de Leituras Recentes</h3>

                <table className="w-full text-sm text-center mb-4 shadow-sm rounded overflow-hidden">
                    <thead className="bg-[#2F447F] text-white">
                        <tr>
                            <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider">Data / Aquisição</th>
                            <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider">NDVI (Vigor)</th>
                            <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider">NDWI (Água)</th>
                            <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider">Temp Solo</th>
                            <th className="py-2 px-2 font-bold text-[10px] uppercase tracking-wider">Nuvens</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white border-l border-r border-[#D0D0D0]">
                        {rdsForTable.length > 0 ? (
                            rdsForTable.map((r, idx) => (
                                <tr key={idx} className="border-b border-[#D0D0D0] hover:bg-gray-50 text-xs">
                                    <td className="py-1 px-2 text-black font-light">{r.date}</td>
                                    <td className="py-1 px-2 text-[#2F447F] font-bold">{r.ndvi}</td>
                                    <td className="py-1 px-2 text-blue-600 font-medium">{r.ndwi}</td>
                                    <td className="py-1 px-2 text-orange-600 font-medium">{r.temp}</td>
                                    <td className="py-1 px-2 text-gray-600 font-light">{r.clouds}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="py-2 text-gray-400 border-b border-[#D0D0D0] font-light">Dados não disponíveis</td></tr>
                        )}
                    </tbody>
                </table>

                <h3 className="text-xl text-[#172649] border-b-2 border-[#D0D0D0] pb-2 mb-4" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>V. Métricas de Acurácia do Modelo Preditivo</h3>

                <p className="text-sm text-black mb-8">
                    MAE, MAPE e R² indisponíveis. Essas métricas exigem previsões comparadas
                    com medições reais de produtividade. Não há validação registrada para este relatório.
                </p>
                <p className="text-sm text-black mb-8">
                    Comparação regional de produtividade indisponível: não há uma base validada
                    para calcular média regional, desvio padrão ou desempenho relativo.
                </p>

                <div className="flex gap-6 mb-8">
                    {/* Zonas */}
                    <div className="w-full">
                        <h3 className="text-md font-bold text-[#172649] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Microambientes (Talhões)</h3>
                        <table className="w-full text-sm text-left border border-[#D0D0D0] shadow-sm rounded overflow-hidden">
                            <thead className="bg-[#172649] text-white">
                                <tr>
                                    <th className="py-2 px-3 font-bold text-[10px] uppercase tracking-wider">Zon. / Talhão</th>
                                    <th className="py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-center">NDVI</th>
                                    <th className="py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-center">Área (m²)</th>
                                    <th className="py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-center">Risco</th>
                                </tr>
                            </thead>
                            <tbody>
                                {znData.length === 0 && (
                                    <tr><td colSpan={4} className="p-3 text-gray-600">Não há zonas de manejo disponíveis para este relatório.</td></tr>
                                )}
                                {znData.map((z, idx) => (
                                    <tr key={idx} className="border-b border-[#D0D0D0] last:border-0 bg-white text-xs">
                                        <td className="py-1 px-3 font-light text-black">{z.zone}</td>
                                        <td className="py-1 px-3 font-bold text-[#2F447F] text-center">{z.ndvi}</td>
                                        <td className="py-1 px-3 font-light text-black text-center">{z.area}</td>
                                        <td className={`py-1 px-3 font-bold text-center uppercase text-[10px] tracking-wider ${z.isRisk ? 'text-red-700' : 'text-[#172649]'}`}>{z.risk}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Técnico Pág 3 */}
                <div className="absolute bottom-10 left-10 right-10 bg-[#172649] text-white p-5 rounded flex justify-between items-center shadow-md border-t-4 border-[#2F447F]">
                    <div className="text-[10px] text-gray-300 leading-relaxed font-light">
                        <p className="mb-1"><strong className="text-white">REFERÊNCIA DA LEITURA:</strong> Fazenda {farm.id} / Leitura {currentReading?.id ?? "indisponível"}</p>
                        <p className="mb-1"><strong className="text-white">GERADO EM UTC:</strong> {new Date().toISOString()}</p>
                        <p className="mt-2 opacity-80 text-[9px] uppercase tracking-wide">A análise possui caráter técnico-preditivo da SYAZ e deve ser validada in loco para decisões exclusivas de crédito rural.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-white uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>SYAZ Engine v2.4.1</p>
                        <p className="text-[10px] text-[#D0D0D0] mt-1 uppercase tracking-widest">Página 3 de 3</p>
                    </div>
                </div>

                <span className="absolute bottom-2 right-10 text-[9px] text-gray-400 font-bold uppercase tracking-widest">Página 3 de 3</span>
            </div>

        </div>
    );
});

ReportTemplate.displayName = "ReportTemplate";
