import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudRain, Droplets, Thermometer, Wind, Loader2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { assessApplicationWeather } from "@shared/agronomy";

interface WeatherCardProps {
    latitude: number;
    longitude: number;
    cropType?: string;
}

interface WeatherData {
    current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        rain: number;
        wind_speed_10m: number;
    };
    daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
    };
}

export function WeatherCard({ latitude, longitude, cropType }: WeatherCardProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["weather", latitude, longitude],
        queryFn: async () => {
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                current: "temperature_2m,relative_humidity_2m,rain,wind_speed_10m",
                daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
                timezone: "auto"
            });
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
            if (!res.ok) throw new Error("Weather fetch failed");
            return res.json() as Promise<WeatherData>;
        },
        refetchInterval: 1000 * 60 * 15,
    });

    if (isLoading) {
        return (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 h-full flex items-center justify-center min-h-[250px]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="bg-destructive/10 border-destructive/20 h-full flex items-center justify-center p-4">
                <p className="text-destructive text-sm font-medium">Clima indisponível para esta região</p>
            </Card>
        );
    }

    const { temperature_2m, relative_humidity_2m, rain, wind_speed_10m } = data.current;
    const applicationWeather = assessApplicationWeather({
        temperatureC: temperature_2m,
        humidityPercent: relative_humidity_2m,
        rainMm: rain,
        windKmh: wind_speed_10m,
    });

    // Slice off today (index 0) if we only want "next days", or keep 1-5
    const forecastDays = data.daily?.time ? data.daily.time.slice(1, 6) : [];

    return (
        <Card className="bg-card/60 backdrop-blur-sm border-primary/20 overflow-hidden relative flex flex-col h-full">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                <CloudRain className="w-32 h-32" />
            </div>

            <CardHeader className="pb-2 pt-4 shrink-0">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CloudRain className="w-4 h-4 text-primary" /> Clima Local
                </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col flex-grow justify-between pb-4">
                {/* Agora */}
                <div className="mb-4">
                    <div className="flex items-end gap-2 mb-3">
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
                </div>

                <div className="mb-4 rounded-xl border border-border/50 bg-background/30 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider">Condição para aplicação</span>
                        <span className={`flex items-center gap-1 text-xs font-semibold ${applicationWeather.status === "compatible" ? "text-emerald-500" : "text-amber-500"}`}>
                            {applicationWeather.status === "compatible"
                                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Meteorologia compatível</>
                                : <><AlertTriangle className="h-3.5 w-3.5" /> Requer atenção</>}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <span className={applicationWeather.checks.temperature ? "text-emerald-500" : "text-amber-500"}>Temperatura até 30°C</span>
                        <span className={applicationWeather.checks.humidity ? "text-emerald-500" : "text-amber-500"}>Umidade a partir de 65%</span>
                        <span className={applicationWeather.checks.wind ? "text-emerald-500" : "text-amber-500"}>Vento entre 3,2 e 8 km/h</span>
                        <span className={applicationWeather.checks.rain ? "text-emerald-500" : "text-amber-500"}>Sem chuva no momento</span>
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                        Triagem meteorológica para {cropType || "a cultura"}. Não autoriza aplicação: confirme estágio da cultura, alvo, bula, receituário agronômico e condições medidas no talhão.
                    </p>
                </div>

                {/* Previsão Futura */}
                {forecastDays.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-border/40">
                        <div className="flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                            <Calendar className="w-3 h-3" /> Previsão (Próximos Dias)
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/20">
                            {forecastDays.map((dateStr, idx) => {
                                // Since we sliced from index 1, the matching data index is idx + 1
                                const dataIdx = idx + 1;
                                const maxTemp = data.daily.temperature_2m_max[dataIdx];
                                const minTemp = data.daily.temperature_2m_min[dataIdx];
                                const precip = data.daily.precipitation_sum[dataIdx];
                                const prob = data.daily.precipitation_probability_max[dataIdx];

                                const dateObj = new Date(dateStr + "T12:00:00"); // avoid tz shifts
                                const dayName = format(dateObj, "EEE", { locale: ptBR });

                                return (
                                    <div key={dateStr} className="flex-shrink-0 flex flex-col items-center p-2 rounded-lg bg-background/20 border border-border/30 min-w-[65px]">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{dayName}</span>
                                        {precip > 0 ? (
                                            <CloudRain className="w-4 h-4 text-blue-400 mb-1" />
                                        ) : (
                                            <Thermometer className="w-4 h-4 text-orange-400 mb-1" />
                                        )}
                                        <div className="flex gap-1 text-[10px] font-mono font-bold">
                                            <span className="text-red-400">{Math.round(maxTemp)}°</span>
                                            <span className="text-blue-400">{Math.round(minTemp)}°</span>
                                        </div>
                                        {precip > 0 && (
                                            <span className="text-[9px] text-blue-400 mt-1">{prob}%</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
