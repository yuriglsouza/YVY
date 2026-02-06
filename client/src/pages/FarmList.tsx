import { useFarms } from "@/hooks/use-farms";
import { Sidebar } from "@/components/Sidebar";
import { CreateFarmDialog } from "@/components/CreateFarmDialog";
import { Link } from "wouter";
import { Loader2, MapPin, Ruler, Sprout, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function FarmList() {
    const { data: farms, isLoading, error } = useFarms();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background pl-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background pl-64">
                <p className="text-destructive font-medium">Falha ao carregar fazendas.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar />
            <main className="flex-1 ml-64 p-8 lg:p-12 overflow-y-auto">
                <header className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-4xl font-display font-bold text-foreground">Minhas Fazendas</h1>
                        <p className="text-muted-foreground mt-2 text-lg">Gerencie seus campos cadastrados.</p>
                    </div>
                    <CreateFarmDialog />
                </header>

                {farms?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center orbital-border rounded-xl bg-card/50">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                            <Sprout className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-2xl font-bold font-display">Nenhuma fazenda ainda</h2>
                        <p className="text-muted-foreground mt-2 max-w-md">
                            Adicione sua primeira fazenda para começar a monitorar.
                        </p>
                        <div className="mt-8">
                            <CreateFarmDialog />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {farms?.map((farm, idx) => (
                            <motion.div
                                key={farm.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                            >
                                <Link href={`/farms/${farm.id}`} className="block group h-full">
                                    <div className="orbital-card rounded-lg overflow-hidden transition-all duration-300 h-full flex flex-col hover:border-primary/50">
                                        <div className="h-48 bg-muted relative overflow-hidden">
                                            {farm.imageUrl ? (
                                                <img
                                                    src={farm.imageUrl}
                                                    alt={farm.name}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center">
                                                    <MapPin className="w-12 h-12 text-primary/20" />
                                                </div>
                                            )}
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded text-xs font-mono font-bold text-primary orbital-border">
                                                ATIVO
                                            </div>
                                        </div>

                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors">
                                                        {farm.name}
                                                    </h3>
                                                    <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-auto">
                                                <div className="bg-secondary/30 p-3 rounded-xl">
                                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                                                        <Sprout className="w-3 h-3" /> Cultura
                                                    </div>
                                                    <p className="font-semibold text-foreground">{farm.cropType}</p>
                                                </div>
                                                <div className="bg-secondary/30 p-3 rounded-xl">
                                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                                                        <Ruler className="w-3 h-3" /> Tamanho
                                                    </div>
                                                    <p className="font-semibold text-foreground">{farm.sizeHa} ha</p>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex items-center text-primary font-medium text-sm group-hover:translate-x-1 transition-transform">
                                                Ver Detalhes <ArrowRight className="w-4 h-4 ml-2" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
