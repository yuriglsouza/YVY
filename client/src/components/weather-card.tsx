
import { useQuery } from "@tanstack/react-query";
import { CloudRain, Droplets, Thermometer, Wind, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeatherCardProps {
    latitude: number;
    longitude: number;
}

interface WeatherData {
    current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        rain: number;
        wind_speed_10m: number;
    };
}

export function WeatherCard({ latitude, longitude }: WeatherCardProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["weather", latitude, longitude],
        queryFn: async () => {
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m`
            );
            if (!res.ok) throw new Error("Weather fetch failed");
            return res.json() as Promise<WeatherData>;
        },
        // Refresh every 15 minutes
        refetchInterval: 1000 * 60 * 15,
    });

    if (isLoading) {
        return (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 h-full flex items-center justify-center min-h-[150px]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="bg-destructive/10 border-destructive/20 h-full flex items-center justify-center p-4">
                <p className="text-destructive text-sm font-medium">Clima indisponível</p>
            </Card>
        );
    }

    const { temperature_2m, relative_humidity_2m, rain, wind_speed_10m } = data.current;

    return (
        <Card className="bg-card/60 backdrop-blur-sm border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <CloudRain className="w-24 h-24" />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CloudRain className="w-4 h-4 text-primary" /> Clima em Tempo Real
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-2 mb-4">
                    <span className="text-4xl font-mono font-bold text-foreground">{temperature_2m.toFixed(1)}°C</span>
                    <span className="text-sm text-muted-foreground mb-1">Agora</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-1 p-2 bg-background/40 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Droplets className="w-3 h-3" /> Umidade
                        </div>
                        <span className="font-bold text-foreground">{relative_humidity_2m}%</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-background/40 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Wind className="w-3 h-3" /> Vento
                        </div>
                        <span className="font-bold text-foreground">{wind_speed_10m} km/h</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-background/40 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <CloudRain className="w-3 h-3" /> Chuva
                        </div>
                        <span className="font-bold text-foreground">{rain > 0 ? `${rain}mm` : 'Sem chuva'}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
