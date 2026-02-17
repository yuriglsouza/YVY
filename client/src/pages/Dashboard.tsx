import { useFarms } from "@/hooks/use-farms";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { CreateFarmDialog } from "@/components/CreateFarmDialog";
import { PredictiveChartWrapper } from "@/components/predictive-chart-wrapper";
import { Link } from "wouter";
import { Loader2, Sprout, AlertTriangle, Droplets, Activity } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from "recharts";

const COLORS = ['#22C55E', '#EAB308', '#dc2626'];

import { type Farm, type Reading } from "@shared/schema";

type FarmWithReading = Farm & { latestReading?: Reading };

export default function Dashboard() {
  const { data: farms, isLoading, error } = useFarms() as { data: FarmWithReading[], isLoading: boolean, error: any };

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
        <p className="text-destructive font-medium">Falha ao carregar dados. Por favor, tente novamente.</p>
      </div>
    );
  }

  // Aggregated Data Calculation
  const totalFarms = farms?.length || 0;
  const totalArea = farms?.reduce((acc, f) => acc + f.sizeHa, 0) || 0;

  const ndviData = farms?.map(f => ({
    id: f.id,
    name: f.name,
    ndvi: f.latestReading?.ndvi || 0,
    status: (f.latestReading?.ndvi || 0) > 0.6 ? 'Ótimo' : (f.latestReading?.ndvi || 0) > 0.3 ? 'Atenção' : 'Crítico'
  })) || [];

  const alertsData = [
    { name: 'Saudável', value: ndviData.filter(d => d.status === 'Ótimo').length },
    { name: 'Atenção', value: ndviData.filter(d => d.status === 'Atenção').length },
    { name: 'Crítico', value: ndviData.filter(d => d.status === 'Crítico').length },
  ].filter(d => d.value > 0);

  // Mock trend data for demonstration (since we don't have historical API handy in this view)
  const healthTrendData = [
    { month: 'Jan', avg: 0.4 },
    { month: 'Fev', avg: 0.5 },
    { month: 'Mar', avg: 0.6 },
    { month: 'Abr', avg: 0.55 },
    { month: 'Mai', avg: 0.7 },
    { month: 'Jun', avg: 0.75 },
  ];

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <MobileNav />
      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-12 overflow-y-auto pt-16 lg:pt-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">CENTRO DE COMANDO</h1>
            <p className="text-muted-foreground mt-2 text-lg font-light tracking-wide">
              Visão global de operações e integridade da frota.
            </p>
          </div>
          <CreateFarmDialog />
        </header>

        {/* KPIs Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="orbital-card p-6 rounded-lg bg-card/60 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Fazendas</p>
                <p className="text-2xl font-mono font-bold text-foreground">{totalFarms}</p>
              </div>
            </div>
          </div>
          <div className="orbital-card p-6 rounded-lg bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/20 rounded-full">
                <Sprout className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Área Monitorada</p>
                <p className="text-2xl font-mono font-bold text-foreground">{totalArea} <span className="text-sm">ha</span></p>
              </div>
            </div>
          </div>
          <div className="orbital-card p-6 rounded-lg bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Média Hídrica</p>
                <p className="text-2xl font-mono font-bold text-foreground">Normal</p>
              </div>
            </div>
          </div>
          <div className="orbital-card p-6 rounded-lg bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-destructive/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Alertas Críticos</p>
                <p className="text-2xl font-mono font-bold text-destructive">{alertsData.find(d => d.name === 'Crítico')?.value || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-4 gap-8"
        >
          {/* Main Chart: Health by Farm (3/4 width) */}
          <div className="orbital-card p-6 rounded-lg col-span-1 lg:col-span-3 bg-card">
            <h3 className="text-lg font-bold font-display uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Análise de Saúde (NDVI) por Unidade
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ndviData}>
                  <defs>
                    <linearGradient id="gradOptimal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="gradWarning" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EAB308" stopOpacity={1} />
                      <stop offset="100%" stopColor="#EAB308" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#18181B', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Bar dataKey="ndvi" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {ndviData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.status === 'Ótimo' ? 'url(#gradOptimal)' : entry.status === 'Atenção' ? 'url(#gradWarning)' : 'url(#gradCritical)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Chart: Priority Alerts (1/4 width) */}
          <div className="orbital-card p-6 rounded-lg col-span-1 lg:col-span-1 bg-card flex flex-col h-full">
            <h3 className="text-lg font-bold font-display uppercase tracking-wider mb-6 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Alertas
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-[200px]">
              {ndviData.filter(d => d.status !== 'Ótimo').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                  <div className="p-4 bg-emerald-500/10 rounded-full mb-3">
                    <Sprout className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-sm font-display font-semibold text-emerald-500">Nominal</p>
                </div>
              ) : (
                ndviData.filter(d => d.status !== 'Ótimo').map((farm, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${farm.status === 'Crítico' ? 'bg-destructive' : 'bg-yellow-500'}`} />
                      <div className="overflow-hidden">
                        <p className="font-bold text-foreground text-xs uppercase tracking-wide truncate max-w-[80px]">{farm.name}</p>
                        <p className={`text-[10px] font-mono font-medium ${farm.status === 'Crítico' ? 'text-destructive' : 'text-yellow-500'}`}>
                          NDVI: {farm.ndvi.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Link href={`/farms/${farm.id}`}>
                      <button className="text-[10px] bg-white/5 hover:bg-white/10 text-foreground px-2 py-1 rounded uppercase font-bold tracking-wider transition-colors cursor-pointer">
                        Ver
                      </button>
                    </Link>
                  </div>
                ))
              )}
            </div>
            {/* Footer summary */}
            <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center text-xs text-muted-foreground uppercase tracking-wider font-mono">
              <span>Total:</span>
              <span className="text-foreground font-bold">{ndviData.filter(d => d.status !== 'Ótimo').length}</span>
            </div>
          </div>

          {/* Predictive Model Chart */}

          {/* Predictive Model Chart */}
          {farms && farms.length > 0 && (
            <PredictiveChartWrapper farms={farms} />
          )}

        </motion.div>
      </main>
    </div>
  );
}
