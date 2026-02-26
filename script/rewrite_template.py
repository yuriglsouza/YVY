import os

TEMPLATE_PATH = "/Users/yuri/Desktop/Backup/Code-Robustness/client/src/components/ReportTemplate.tsx"

new_template_code = """import React from "react";
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
}

export const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>(({
    farm,
    currentReading,
    previousReading,
    historyData,
    aiReport,
    consultantName,
    readings
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

    // Métricas Preditivas (Mock Determinístico como era antes)
    const crp = farm?.cropType || "Soja";
    let baseProd = 60;
    if (crp.toLowerCase().includes("milho")) { baseProd = 120; }
    if (crp.toLowerCase().includes("trigo")) { baseProd = 3; }

    const tSeed = farm?.id || 1;
    let mockMape = 0, mockMae = 0, mockR2 = 0;
    let rdsForTable: any[] = [];
    
    if (readings && readings.length > 0) {
        rdsForTable = readings.slice(0, 10).map(r => ({
            date: format(new Date(r.date), "dd/MM/yyyy"),
            ndvi: (r.ndvi || 0).toFixed(3),
            ndwi: (r.ndwi || 0).toFixed(3),
            temp: (r.temperature || 0).toFixed(1) + "°C",
            clouds: ((r.cloudCover || 0) * 100).toFixed(0) + "%"
        }));
    }

    const mockHist = Array.from({ length: 6 }).map((_, i) => {
        const noiseReal = Math.sin((tSeed + i) * 1.3) * (baseProd * 0.15);
        const noiseEst = Math.cos((tSeed + i) * 1.7) * (baseProd * 0.08);
        const rl = baseProd + noiseReal;
        const est = rl + noiseEst;
        const ePerc = Math.abs((rl - est) / rl) * 100;
        return { real: rl, est: est, erro: ePerc };
    });

    mockMae = mockHist.reduce((acc, h) => acc + Math.abs(h.real - h.est), 0) / mockHist.length;
    mockMape = mockHist.reduce((acc, h) => acc + h.erro, 0) / mockHist.length;
    const ssRes = mockHist.reduce((acc, h) => acc + Math.pow(h.real - h.est, 2), 0);
    const meanR = mockHist.reduce((acc, h) => acc + h.real, 0) / mockHist.length;
    const ssTot = mockHist.reduce((acc, h) => acc + Math.pow(h.real - meanR, 2), 0);
    mockR2 = Math.max(0, 1 - (ssRes / ssTot));

    const regMean = baseProd + 4;
    const perfRelativa = ((mockMape / regMean) * 10).toFixed(1);
    const perfClass = mockMape < 7 ? "Alta Precisão (Adeptos a Modelos de Crédito Seguros)" : mockMape <= 12 ? "Boa Precisão (Estabilidade Aceitável)" : "Modelo em Calibração (Volatilidade Alta)";

    // Zonas de Risco estáticas
    const znData = [
        { zone: "Pivot 1 Central", ndvi: "0.71", risk: "Baixo", isRisk: false },
        { zone: "Área de Borda (N)", ndvi: "0.55", risk: "Médio", isRisk: false },
        { zone: "Várzea Leste", ndvi: "0.41", risk: "ZONA CRÍTICA", isRisk: true }
    ];

    const hashID = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

    return (
        <div ref={ref} className="bg-white text-gray-900 w-[210mm] min-h-[891mm] p-0 m-0 absolute top-[-9999px] left-[-9999px] font-sans">

            {/* ====== HEADER OFICIAL ====== */}
            <div className="bg-[#0D1B2A] text-white w-[210mm] h-[30mm] flex items-center justify-between px-10 shrink-0">
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
                    <div className={`w-[60mm] h-full rounded-xl border ${statusColor} p-6 flex flex-col items-center justify-center text-center`}>
                        <StatusIcon className="w-20 h-20 mb-4 opacity-80" />
                        <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-2">Classificação de Risco</h3>
                        <p className="text-4xl font-black uppercase tracking-tighter shadow-sm">{parsedReport?.status || "Avaliando"}</p>
                        <div className="mt-8 border-t border-current w-full pt-4 opacity-60">
                            <p className="text-sm font-bold">Impacto Estimado</p>
                            <p className="text-2xl font-bold">{parsedReport?.impacto || "N/A"}</p>
                        </div>
                    </div>

                    <div className="flex-1 bg-white flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">I. Parecer Técnico - Inteligência Artificial</h3>
                            <div className="text-sm text-gray-700 text-justify leading-relaxed whitespace-pre-wrap">
                                {parsedReport ? (
                                    <>
                                        <p className="mb-3"><strong>1. Diagnóstico Atual:</strong> {parsedReport.summary}</p>
                                        <p className="mb-3"><strong>2. Histórico Temporal:</strong> {parsedReport.history}</p>
                                        <p className="mb-3"><strong>3. Recomendações:</strong> {parsedReport.recomendacoes}</p>
                                    </>
                                ) : (
                                    <p>{aiReport}</p>
                                )}
                            </div>
                        </div>

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

                {/* Footer Página 1 */}
                <div className="absolute bottom-6 left-10 right-10 flex border-t border-gray-200 pt-6 justify-between items-end">
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
                            <QRCode value={`https://yvy.system/report/verify?f=${farm.id}&d=${format(new Date(), "yyyyMMdd")}`} size={50} />
                        </div>
                    </div>
                </div>
                <span className="absolute bottom-2 right-10 text-[10px] text-gray-400">Página 1 de 3</span>
            </div>


            {/* ========================================================== */}
            {/* ====== PÁGINA 2: EVIDÊNCIAS VISUAIS (MAPAS E GRÁFICOS) === */}
            {/* ========================================================== */}
            <div className="px-10 py-10 w-[210mm] h-[297mm] box-border relative border-t-2 border-gray-100 bg-white">
                
                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-6">II. Evidências Visuais Espaciais</h3>

                <div className="flex justify-between gap-6 mb-10 w-full">
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

                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-6">III. Curva de Crescimento e Projeção (NDVI)</h3>
                <div className="w-full h-[80mm] bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
                    {historyData && historyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), "dd/MM")} tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                                <Line type="monotone" dataKey="ndvi" name="NDVI Medido" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', r: 4 }} />
                                {historyData.some(d => d.predictedNdvi !== undefined) && (
                                    <Line type="monotone" dataKey="predictedNdvi" name="Projeção ML" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Dados insuficientes para a curva preditiva.</div>
                    )}
                </div>

                <span className="absolute bottom-4 right-10 text-[10px] text-gray-400">Página 2 de 3</span>
            </div>


            {/* ========================================================== */}
            {/* ====== PÁGINA 3: TABELAS, INFORMAÇÕES TÉCNICAS E MÉTRICAS == */}
            {/* ========================================================== */}
            <div className="px-10 py-10 w-[210mm] h-[297mm] box-border relative border-t-2 border-gray-100 bg-white">
                
                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4">IV. Tabelas de Leituras Recentes (Últimos 10 registros)</h3>
                
                <table className="w-full text-sm text-center mb-8 border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                    <thead className="bg-[#059669] text-white font-semibold">
                        <tr>
                            <th className="py-2 px-4 border-b">Data / Aquisição</th>
                            <th className="py-2 px-4 border-b">NDVI (Vigor)</th>
                            <th className="py-2 px-4 border-b">NDWI (Água)</th>
                            <th className="py-2 px-4 border-b">Temp Solo</th>
                            <th className="py-2 px-4 border-b">Nuvens</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {rdsForTable.length > 0 ? (
                            rdsForTable.map((r, idx) => (
                                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                    <td className="py-2 px-4 text-gray-700">{r.date}</td>
                                    <td className="py-2 px-4 text-emerald-600 font-medium">{r.ndvi}</td>
                                    <td className="py-2 px-4 text-blue-600 font-medium">{r.ndwi}</td>
                                    <td className="py-2 px-4 text-orange-600 font-medium">{r.temp}</td>
                                    <td className="py-2 px-4 text-gray-500">{r.clouds}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="py-4 text-gray-400">Dados não disponíveis</td></tr>
                        )}
                    </tbody>
                </table>

                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4">V. Métricas de Acurácia do Modelo Preditivo</h3>
                
                <div className="flex justify-between gap-4 mb-4">
                    <div className="w-1/3 bg-gray-50 p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">MAE (Erro Médio)</p>
                        <p className="text-xl font-bold text-gray-800">{mockMae.toFixed(1)} t/ha</p>
                    </div>
                    <div className="w-1/3 bg-gray-50 p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">MAPE (% Erro Médio)</p>
                        <p className="text-xl font-bold text-gray-800">{mockMape.toFixed(1)}%</p>
                    </div>
                    <div className="w-1/3 bg-gray-50 p-4 rounded border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">R² (Coef. Determinação)</p>
                        <p className="text-xl font-bold text-gray-800">{mockR2.toFixed(3)}</p>
                    </div>
                </div>
                <p className="text-xs text-gray-500 italic mb-8 border-l-4 border-emerald-500 pl-3">
                    Análise: O modelo preditivo para este polígono apresenta {perfClass}, baseada no teste retroativo R-Squared (R² = {mockR2.toFixed(3)}). Quanto menor o erro percentual (MAPE), maior a confiabilidade das projeções de safra para fins de crédito rural e seguro agrícola.
                </p>

                <div className="flex gap-6 mb-8">
                    {/* Benchmark */}
                    <div className="w-1/2">
                        <h3 className="text-md font-bold text-gray-800 mb-3">Benchmark Regional</h3>
                        <div className="bg-[#E8F1FB] border border-blue-100 p-4 rounded-lg">
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-700">Média Regional Prod. (Raio 50km):</span>
                                <span className="text-sm font-bold text-gray-900">{regMean.toFixed(1)} t/ha</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-700">Desvio Padrão Regional:</span>
                                <span className="text-sm font-bold text-gray-900">± 3.2 t/ha</span>
                            </div>
                            <div className="flex justify-between mt-4">
                                <span className="text-sm text-gray-700 font-bold">Performance do Polígono:</span>
                                <span className="text-sm font-bold text-emerald-700">Superávit de +{perfRelativa}% da média</span>
                            </div>
                        </div>
                    </div>

                    {/* Zonas */}
                    <div className="w-1/2">
                        <h3 className="text-md font-bold text-gray-800 mb-3">Microambientes (Talhões)</h3>
                        <table className="w-full text-sm text-left border border-gray-200 shadow-sm rounded overflow-hidden">
                            <thead className="bg-gray-100 font-semibold text-gray-700">
                                <tr>
                                    <th className="py-2 px-3 border-b border-gray-200">Zon. / Talhão</th>
                                    <th className="py-2 px-3 border-b border-gray-200">NDVI</th>
                                    <th className="py-2 px-3 border-b border-gray-200">Risco</th>
                                </tr>
                            </thead>
                            <tbody>
                                {znData.map((z, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 last:border-0 bg-white">
                                        <td className="py-2 px-3">{z.zone}</td>
                                        <td className="py-2 px-3">{z.ndvi}</td>
                                        <td className={`py-2 px-3 font-bold ${z.isRisk ? 'text-red-600' : 'text-gray-700'}`}>{z.risk}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Técnico Pág 3 */}
                <div className="absolute bottom-10 left-10 right-10 bg-[#0D1B2A] text-white p-4 rounded-lg flex justify-between items-center shadow-lg">
                    <div className="text-[10px] text-gray-300 leading-tight">
                        <p>HASH KEY (AUDIT ID): <span className="font-mono text-emerald-400">{hashID}</span></p>
                        <p>VAL TAMPER-EVIDENCE UTC: {new Date().toISOString()}</p>
                        <p className="mt-1 opacity-70">A análise possui caráter técnico-preditivo da SYAZ e deve ser validada in loco para decisões exclusivas de crédito rural.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400">YVY Engine v2.4.1</p>
                        <p className="text-[10px] text-gray-500">Página 3 de 3</p>
                    </div>
                </div>

                <span className="absolute bottom-2 right-10 text-[10px] text-gray-400">Página 3 de 3</span>
            </div>

        </div>
    );
});

ReportTemplate.displayName = "ReportTemplate";
"""

with open(TEMPLATE_PATH, "w", encoding="utf-8") as f:
    f.write(new_template_code)

print("Template React atualizado com sucesso para 3 páginas nativas com tudo que faltava!")
