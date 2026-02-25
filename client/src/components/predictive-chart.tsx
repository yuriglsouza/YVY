
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    ComposedChart,
    ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Calendar, Loader2, AlertCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useReadings } from "@/hooks/use-readings";

interface ForecastPoint {
    date: string;
    ndvi: number;
    confidence: number;
}

interface PredictionResponse {
    farmId: number;
    date: string;
    prediction: number;
    yieldTons?: number;
    forecast: ForecastPoint[];
    trend: 'up' | 'down' | 'stable';
    unit: string;
}

interface PredictiveChartProps {
    farmId: number;
    headerSlot?: React.ReactNode;
}

export function PredictiveChart({ farmId, headerSlot }: PredictiveChartProps) {
    const [targetDate] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));

    // Scenario Modifiers
    const [rainModifier, setRainModifier] = useState<number>(0);
    const [tempModifier, setTempModifier] = useState<number>(0);

    // 1. Fetch Real Historical Data
    const { data: readings } = useReadings(farmId);

    // 2. Prediction Query
    const { data: predictionData, isLoading, error, refetch } = useQuery({
        queryKey: ["prediction", farmId, targetDate, rainModifier, tempModifier],
        queryFn: async () => {
            const res = await fetch(`/api/farms/${farmId}/prediction?date=${targetDate}&rainModifier=${rainModifier}&tempModifier=${tempModifier}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Falha na predição");
            }
            return res.json() as Promise<PredictionResponse>;
        },
        enabled: false,
        retry: false
    });

    // Sort readings by date ascending
    const sortedReadings = [...(readings || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build chart data: historical + forecast
    const chartData: any[] = sortedReadings.map(r => ({
        date: r.date,
        ndvi: r.ndvi,
        rvi: r.rvi,
        type: 'historical'
    }));

    // Add forecast data
    if (predictionData?.forecast?.length) {
        // Connect last historical point to forecast
        const lastHistorical = chartData[chartData.length - 1];
        if (lastHistorical) {
            // Bridge point: last historical value as forecast start
            chartData.push({
                date: lastHistorical.date,
                ndvi: lastHistorical.ndvi,
                forecast_ndvi: lastHistorical.ndvi,
                forecast_upper: lastHistorical.ndvi,
                forecast_lower: lastHistorical.ndvi,
                type: 'bridge'
            });
        }

        predictionData.forecast.forEach(f => {
            chartData.push({
                date: f.date,
                forecast_ndvi: f.ndvi,
                forecast_upper: Math.min(1, f.ndvi + f.confidence),
                forecast_lower: Math.max(0, f.ndvi - f.confidence),
                type: 'forecast'
            });
        });
    }

    const handlePredict = () => {
        refetch();
    };

    const TrendIcon = predictionData?.trend === 'up' ? TrendingUp
        : predictionData?.trend === 'down' ? TrendingDown : Minus;

    const trendColor = predictionData?.trend === 'up' ? 'text-emerald-400'
        : predictionData?.trend === 'down' ? 'text-red-400' : 'text-yellow-400';

    const trendLabel = predictionData?.trend === 'up' ? 'Tendência de Alta'
        : predictionData?.trend === 'down' ? 'Tendência de Queda' : 'Estável';

    return (
        <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        Modelo Preditivo (ML)
                    </CardTitle>
                    <CardDescription>
                        RandomForest com 9 features · Forecast 30 dias · Intervalo de Confiança
                    </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                    {headerSlot}
                    <Button onClick={handlePredict} disabled={isLoading} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 w-full sm:w-auto">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
                        {isLoading ? "Treinando..." : "Gerar Previsão"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Scenario Simulation Controls */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-primary/5">
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                            <span className="text-blue-400">🌧️</span> Cenário de Chuva
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant={rainModifier === -1 ? "default" : "outline"} onClick={() => setRainModifier(-1)} className={rainModifier === -1 ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>Seca</Button>
                            <Button size="sm" variant={rainModifier === 0 ? "default" : "outline"} onClick={() => setRainModifier(0)} className={rainModifier === 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>Normal</Button>
                            <Button size="sm" variant={rainModifier === 1 ? "default" : "outline"} onClick={() => setRainModifier(1)} className={rainModifier === 1 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>Chuva Ideal</Button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                            <span className="text-orange-400">🌡️</span> Cenário de Temperatura
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant={tempModifier === -2 ? "default" : "outline"} onClick={() => setTempModifier(-2)} className={tempModifier === -2 ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}>-2°C (Frio)</Button>
                            <Button size="sm" variant={tempModifier === 0 ? "default" : "outline"} onClick={() => setTempModifier(0)}>Média Histórica</Button>
                            <Button size="sm" variant={tempModifier === 2 ? "default" : "outline"} onClick={() => setTempModifier(2)} className={tempModifier === 2 ? "bg-red-600 hover:bg-red-700 text-white" : ""}>+2°C (Onda Calor)</Button>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>Erro: {(error as Error).message}</span>
                    </div>
                )}

                <div className="h-[350px] w-full">
                    {readings && readings.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: '#A1A1AA' }}
                                    tickFormatter={(val) => {
                                        try { return format(new Date(val), "dd MMM"); } catch { return val; }
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} label={{ value: 'NDVI', angle: -90, position: 'insideLeft', fill: '#666' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181B', borderRadius: '8px', border: '1px solid #262626' }}
                                    itemStyle={{ color: '#F8FAFC' }}
                                    labelStyle={{ color: '#94A3B8' }}
                                    labelFormatter={(label) => {
                                        try { return format(new Date(label), "dd MMM yyyy"); } catch { return label; }
                                    }}
                                    formatter={(value: number, name: string) => {
                                        if (name === "forecast_ndvi") return [value.toFixed(3), "NDVI Previsto 🤖"];
                                        if (name === "ndvi") return [value.toFixed(3), "NDVI Real"];
                                        if (name === "rvi") return [value.toFixed(3), "Radar (RVI) 📡"];
                                        if (name === "forecast_upper" || name === "forecast_lower") return [value.toFixed(3), "Confiança"];
                                        return [value.toFixed(3), name.toUpperCase()];
                                    }}
                                />

                                {/* Confidence Band (area between upper and lower) */}
                                <Area
                                    type="monotone"
                                    dataKey="forecast_upper"
                                    stroke="none"
                                    fill="#EAB308"
                                    fillOpacity={0.1}
                                    connectNulls={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="forecast_lower"
                                    stroke="none"
                                    fill="#18181B"
                                    fillOpacity={0.8}
                                    connectNulls={false}
                                />

                                {/* Historical NDVI Line */}
                                <Line
                                    type="monotone"
                                    dataKey="ndvi"
                                    stroke="#22C55E"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: "#22C55E" }}
                                    activeDot={{ r: 5 }}
                                    name="ndvi"
                                    connectNulls={false}
                                />

                                {/* Radar SAR Line */}
                                <Line
                                    type="monotone"
                                    dataKey="rvi"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 2, fill: "#10b981" }}
                                    name="rvi"
                                    connectNulls={false}
                                />

                                {/* Forecast NDVI Line (dashed yellow) */}
                                <Line
                                    type="monotone"
                                    dataKey="forecast_ndvi"
                                    stroke="#EAB308"
                                    strokeWidth={3}
                                    strokeDasharray="8 4"
                                    dot={{ r: 4, fill: "#EAB308", stroke: "#EAB308" }}
                                    activeDot={{ r: 6 }}
                                    name="forecast_ndvi"
                                    connectNulls={false}
                                />

                                {/* Separator line at last historical date */}
                                {predictionData?.forecast?.length && sortedReadings.length > 0 && (
                                    <ReferenceLine
                                        x={sortedReadings[sortedReadings.length - 1].date}
                                        stroke="#666"
                                        strokeDasharray="3 3"
                                        label={{ value: "Hoje", position: "top", fill: "#666", fontSize: 11 }}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Nenhum dado histórico disponível para esta fazenda.
                        </div>
                    )}
                </div>

                {/* Results Cards */}
                {predictionData && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* NDVI Previsto */}
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                            <div>
                                <h4 className="text-primary font-bold uppercase text-xs tracking-wider">NDVI Médio Previsto</h4>
                                <p className="text-muted-foreground text-xs mt-1">
                                    Próximos 30 dias
                                </p>
                            </div>
                            <div className="text-3xl font-mono font-bold text-foreground">
                                {predictionData.prediction.toFixed(3)}
                            </div>
                        </div>

                        {/* Tendência */}
                        <div className={`p-4 rounded-lg border flex items-center justify-between ${predictionData.trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/20'
                                : predictionData.trend === 'down' ? 'bg-red-500/10 border-red-500/20'
                                    : 'bg-yellow-500/10 border-yellow-500/20'
                            }`}>
                            <div>
                                <h4 className={`font-bold uppercase text-xs tracking-wider ${trendColor}`}>Tendência</h4>
                                <p className="text-muted-foreground text-xs mt-1">
                                    {trendLabel}
                                </p>
                            </div>
                            <TrendIcon className={`w-8 h-8 ${trendColor}`} />
                        </div>

                        {/* Estimativa de Colheita */}
                        {predictionData.yieldTons !== undefined && predictionData.yieldTons > 0 && (
                            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                <div>
                                    <h4 className="text-emerald-500 font-bold uppercase text-xs tracking-wider">Estimativa de Colheita</h4>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        Baseado no cenário atual
                                    </p>
                                </div>
                                <div className="text-2xl font-mono font-bold text-foreground">
                                    {predictionData.yieldTons.toFixed(1)} <span className="text-sm text-emerald-500/70">Ton</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
