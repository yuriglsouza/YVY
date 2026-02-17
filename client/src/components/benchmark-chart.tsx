
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Trophy, AlertTriangle } from "lucide-react";

interface BenchmarkData {
    farmNdvi: number;
    regionalNdvi: number;
    percentile: number;
    rank: string;
    history: Array<{ year: string; ndvi: number }>;
}

export function BenchmarkChart({ farmId }: { farmId: number }) {
    const { data, isLoading } = useQuery<BenchmarkData>({
        queryKey: ["benchmark", farmId],
        queryFn: async () => {
            const res = await fetch(`/api/farms/${farmId}/benchmark`);
            if (!res.ok) throw new Error("Benchmark fetch failed");
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </Card>
        );
    }

    if (!data) {
        return (
            <Card className="h-full flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-500 mb-2" />
                <p className="text-muted-foreground font-medium">Dados de benchmark indisponíveis</p>
                <p className="text-xs text-muted-foreground mt-1">Verifique se o servidor foi reiniciado para ativar este recurso.</p>
            </Card>
        );
    }

    const chartData = [
        { name: "Minha Fazenda", value: data.farmNdvi, color: "#10b981" }, // Emerald 500
        { name: "Média Regional", value: data.regionalNdvi, color: "#64748b" }, // Slate 500
    ];

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" /> Análise Comparativa de Saúde
                    </CardTitle>
                    <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20">
                        <Trophy className="w-3 h-3" /> {data.rank}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                            <XAxis type="number" domain={[0, 1]} hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                width={90}
                                tick={{ fill: "#e2e8f0", fontSize: 11 }}
                            />
                            <Tooltip
                                cursor={{ fill: "hsl(var(--muted)/0.2)" }}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                                }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-2 pt-4 border-t border-border/40 grid grid-cols-1 gap-2 text-center">
                    <div className="flex justify-between items-center px-2">
                        <span className="text-xs text-slate-300/80">NDVI Atual</span>
                        <span className="text-xl font-bold text-emerald-500">{data.farmNdvi.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center px-2">
                        <span className="text-xs text-slate-300/80">Média da Região</span>
                        <span className="text-xl font-bold text-slate-500">{data.regionalNdvi.toFixed(2)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
