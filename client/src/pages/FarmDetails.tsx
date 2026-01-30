import { useFarm, useRefreshReadings } from "@/hooks/use-farms";
import { useReadings, useLatestReading } from "@/hooks/use-readings";
import { useReports, useGenerateReport } from "@/hooks/use-reports";
import { Sidebar } from "@/components/Sidebar";
import { Gauge } from "@/components/Gauge";
import { useRoute, Link } from "wouter";
import { Loader2, RefreshCw, FileText, Map as MapIcon, ChevronLeft, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Fix for leaflet marker icons
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function FarmDetails() {
  const [match, params] = useRoute("/farms/:id");
  const farmId = parseInt(params?.id || "0");
  
  const { data: farm, isLoading: isLoadingFarm } = useFarm(farmId);
  const { data: readings } = useReadings(farmId);
  const { data: latestReading } = useLatestReading(farmId);
  const { data: reports } = useReports(farmId);
  
  const refreshReadings = useRefreshReadings();
  const generateReport = useGenerateReport();

  if (isLoadingFarm) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background pl-64">
        <p className="text-destructive font-medium">Farm not found</p>
      </div>
    );
  }

  // Helpers for gauge colors
  const getColor = (val: number, type: 'NDVI' | 'NDWI' | 'NDRE' | 'RVI') => {
    if (type === 'NDVI') return val > 0.6 ? "#16a34a" : val > 0.3 ? "#ca8a04" : "#dc2626";
    if (type === 'NDWI') return val < 0.2 ? "#0284c7" : "#0ea5e9";
    return "#16a34a"; // Default
  };

  const chartData = readings?.map(r => ({
    ...r,
    formattedDate: format(new Date(r.date), "MMM d")
  })).reverse(); // Assuming API returns desc

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 lg:p-12 overflow-y-auto">
        
        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-display font-bold text-foreground">{farm.name}</h1>
              <div className="flex gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Sprout className="w-3 h-3" /> {farm.cropType}
                </span>
                <span className="flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded-md text-sm font-medium">
                  <Ruler className="w-3 h-3" /> {farm.sizeHa} ha
                </span>
              </div>
            </div>
            <Button 
              onClick={() => refreshReadings.mutate(farmId)}
              disabled={refreshReadings.isPending}
              variant="outline"
              className="rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshReadings.isPending && "animate-spin")} />
              Sync Satellite Data
            </Button>
          </div>
        </div>

        {/* Gauges Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {latestReading ? (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <Gauge value={latestReading.ndvi} label="NDVI (Health)" color={getColor(latestReading.ndvi, 'NDVI')} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <Gauge value={latestReading.ndwi} label="NDWI (Water)" color={getColor(latestReading.ndwi, 'NDWI')} min={-1} max={1} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <Gauge value={latestReading.ndre} label="NDRE (Chlorophyll)" color={getColor(latestReading.ndre, 'NDRE')} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <Gauge value={latestReading.rvi} label="RVI (Radar Veg)" color="#8b5cf6" max={3} />
              </motion.div>
            </>
          ) : (
             <div className="col-span-4 p-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
               No readings available. Click "Sync Satellite Data".
             </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Column */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card p-6 rounded-2xl border border-border shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-bold">Historical Trends</h2>
                <div className="flex gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span>
                  <span className="text-xs text-muted-foreground">NDVI</span>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} domain={[0, 1]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDVI" />
                    <Line type="monotone" dataKey="ndwi" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="NDWI" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-card p-6 rounded-2xl border border-border shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-display font-bold flex items-center gap-2">
                   <BrainCircuit className="w-5 h-5 text-accent" /> AI Agronomist
                 </h2>
                 <Button 
                   onClick={() => generateReport.mutate(farmId)}
                   disabled={generateReport.isPending}
                   size="sm" 
                   className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg"
                 >
                   {generateReport.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                   Analyze Data
                 </Button>
              </div>
              
              <div className="space-y-4">
                {reports && reports.length > 0 ? (
                  reports.slice(0, 3).map((report) => (
                    <div key={report.id} className="p-4 bg-muted/30 rounded-xl border border-border/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Report generated
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(report.date || new Date()), "PPP")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {report.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No AI analysis reports yet. Click "Analyze Data" to generate one.
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sidebar Column (Map) */}
          <div className="lg:col-span-1">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-[400px] lg:h-[600px] relative"
            >
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-border/50">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-primary" /> Location
                </h3>
              </div>
              
              <MapContainer 
                center={[farm.latitude, farm.longitude]} 
                zoom={14} 
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[farm.latitude, farm.longitude]}>
                  <Popup>
                    <div className="text-center">
                      <strong>{farm.name}</strong><br />
                      {farm.sizeHa} ha
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </motion.div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Icon for Sprout used in component
import { Sprout, Ruler } from "lucide-react";
