
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
    ReferenceDot
} from "recharts";
import { Loader2, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useReadings } from "@/hooks/use-readings";

interface PredictionResponse {
    farmId: number;
    date: string;
    prediction: number;
    unit: string;
}

interface PredictiveChartProps {
    farmId: number;
    headerSlot?: React.ReactNode;
}

export function PredictiveChart({ farmId, headerSlot }: PredictiveChartProps) {
    // Default forecast date: 1 month from now
    const [targetDate, setTargetDate] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));

    // 1. Fetch Real Historical Data
    const { data: readings } = useReadings(farmId);

    // 2. Prediction Query
    const { data: predictionData, isLoading, error, refetch } = useQuery({
        queryKey: ["prediction", farmId, targetDate],
        queryFn: async () => {
            const res = await fetch(`/api/farms/${farmId}/prediction?date=${targetDate}`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Prediction failed");
            }
            return res.json() as Promise<PredictionResponse>;
        },
        enabled: false,
        retry: false
    });

    // Combine history + prediction
    // Sort readings by date ascending for chart
    const sortedReadings = [...(readings || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData = sortedReadings.map(r => ({
        date: r.date, // Assuming YYYY-MM-DD or ISO string
        ndvi: r.ndvi
    }));

    if (predictionData) {
        chartData.push({
            date: predictionData.date,
            ndvi: predictionData.prediction
        });
    }

    const handlePredict = () => {
        refetch();
    };

    return (
        <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Modelo Preditivo de Safra (IA)
                    </CardTitle>
                    <CardDescription>
                        Projeção de NDVI baseada em histórico e sazonalidade.
                    </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                    {/* Render the Farm Selector here */}
                    {headerSlot}

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-auto">
                            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="pl-9 w-full sm:w-[160px] bg-background/50 border-primary/20"
                            />
                        </div>
                        <Button onClick={handlePredict} disabled={isLoading} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 w-full sm:w-auto">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar Previsão"}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
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
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12, fill: '#A1A1AA' }}
                                    tickFormatter={(val) => {
                                        try { return format(new Date(val), "MMM yy"); } catch { return val; }
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} label={{ value: 'NDVI', angle: -90, position: 'insideLeft', fill: '#666' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181B', borderRadius: '4px', border: '1px solid #262626' }}
                                    labelFormatter={(label) => {
                                        try { return format(new Date(label), "dd MMM yyyy"); } catch { return label; }
                                    }}
                                    formatter={(value: number) => [value.toFixed(3), "NDVI"]}
                                />
                                {/* Historical Line */}
                                <Line
                                    type="monotone"
                                    dataKey="ndvi"
                                    stroke="#22C55E"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#22C55E" }}
                                    activeDot={{ r: 6 }}
                                />

                                {/* Prediction Dot */}
                                {predictionData && (
                                    <ReferenceDot
                                        x={predictionData.date}
                                        y={predictionData.prediction}
                                        r={6}
                                        fill="#EAB308"
                                        stroke="#EAB308"
                                        isFront={true}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Nenhum dado histórico disponível para esta fazenda.
                        </div>
                    )}
                </div>

                {predictionData && (
                    <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-between">
                        <div>
                            <h4 className="text-yellow-500 font-bold uppercase text-xs tracking-wider">Previsão Realizada</h4>
                            <p className="text-muted-foreground text-sm">
                                Para a data <b>{format(new Date(predictionData.date), "dd/MM/yyyy")}</b>, o modelo estima um NDVI de:
                            </p>
                        </div>
                        <div className="text-3xl font-mono font-bold text-foreground">
                            {predictionData.prediction.toFixed(3)}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
