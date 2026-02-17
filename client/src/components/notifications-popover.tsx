
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2, AlertTriangle, Droplets, Thermometer, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Alert {
    id: number;
    farmId: number;
    date: string;
    type: string;
    message: string;
    read: boolean;
}

export function NotificationsPopover() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: alerts, isLoading } = useQuery<Alert[]>({
        queryKey: ["alerts"],
        queryFn: async () => {
            const res = await fetch("/api/alerts");
            if (!res.ok) throw new Error("Failed to fetch alerts");
            return res.json();
        },
        refetchInterval: 30000, // Check every 30s
    });

    const markRead = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/alerts/${id}/read`, { method: "POST" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["alerts"] });
        },
    });

    const unreadCount = alerts?.filter((a) => !a.read).length || 0;

    const getIcon = (type: string) => {
        if (type.includes("NDVI")) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        if (type.includes("SECA") || type.includes("NDWI")) return <Droplets className="w-4 h-4 text-blue-500" />;
        if (type.includes("TEMPERATURA")) return <Thermometer className="w-4 h-4 text-red-500" />;
        return <Info className="w-4 h-4 text-gray-500" />;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-secondary">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4 border-b border-border/40 flex justify-between items-center bg-muted/20">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    <span className="text-xs text-muted-foreground">
                        {unreadCount} não lidas
                    </span>
                </div>
                <ScrollArea className="h-[300px]">
                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : alerts?.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                            Nenhuma notificação.
                        </div>
                    ) : (
                        <div className="divide-y divide-border/20">
                            {alerts?.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={cn(
                                        "p-4 hover:bg-muted/50 transition-colors cursor-default relative group",
                                        !alert.read ? "bg-primary/5" : ""
                                    )}
                                    onClick={() => !alert.read && markRead.mutate(alert.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1">{getIcon(alert.type)}</div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className={cn("text-xs font-medium", !alert.read && "text-foreground font-semibold")}>
                                                    {alert.type}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                    {format(new Date(alert.date), "dd MMM", { locale: ptBR })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-snug">
                                                {alert.message}
                                            </p>
                                        </div>
                                    </div>
                                    {!alert.read && (
                                        <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Check className="w-4 h-4 text-primary" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
