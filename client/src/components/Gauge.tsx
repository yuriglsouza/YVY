import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface GaugeProps {
  value: number; // 0 to 1 normally, but can handle specific ranges
  label: string;
  min?: number;
  max?: number;
  color?: string; // Solid color or fallback
  status?: string; // Qualitative status: "Bom", "Atenção", etc.
  statusColor?: string; // Color for the status text
  gradientId?: string; // ID of a gradient to use for the stroke
}

const indexExplanations: Record<string, string> = {
  "NDVI": "Vigor da vegetação e saúde da planta.",
  "NDWI": "Estresse hídrico e teor de água nas folhas.",
  "NDRE": "Clorofila e nitrogênio (detecção precoce).",
  "RVI": "Biomassa e estrutura física (Radar).",
  "OTCI": "Conteúdo de clorofila em macro-escala.",
  "TEMP": "Temperatura da superfície (Calor/Estresse).",
};

export function Gauge({
  value,
  label,
  min = 0,
  max = 1,
  color = "#16a34a",
  status,
  statusColor = "text-muted-foreground",
  gradientId
}: GaugeProps) {
  // Normalize value to 0-100 for stroke dasharray
  const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const strokeDashoffset = (Math.PI * 40) - (normalizedValue * Math.PI * 40);

  // Extract base label name for dictionary lookup (remove extra chars like (Água))
  const cleanLabel = label.split(" ")[0].toUpperCase().replace(".", "");
  const explanation = indexExplanations[cleanLabel] || indexExplanations[Object.keys(indexExplanations).find(k => label.toUpperCase().includes(k)) || ""];

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg className="w-32 h-32 transform rotate-[180deg]" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gradient-ndvi" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="gradient-water" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
          {/* Background Track - Make it subtle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
            strokeDasharray={Math.PI * 40}
            strokeDashoffset="0"
          />
          {/* Active Arc */}
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={gradientId ? `url(#${gradientId})` : color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={Math.PI * 40}
            initial={{ strokeDashoffset: Math.PI * 40 }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
      </div>

      {/* Value and Label */}
      <div className="absolute top-8 flex flex-col items-center">
        <span className="text-2xl font-bold font-display tabular-nums tracking-tight text-foreground">
          {value.toFixed(2)}
        </span>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help group">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1 group-hover:text-primary transition-colors">
                  {label}
                </span>
                {explanation && <Info className="w-3 h-3 text-muted-foreground/50 mb-1 group-hover:text-primary transition-colors" />}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-center bg-card border-border text-foreground text-xs">
              <p>{explanation}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Qualitative Status Badge */}
        {status && (
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-background/50 backdrop-blur-sm shadow-sm ${statusColor} mt-1`}>
            {status}
          </div>
        )}
      </div>

      {/* Min/Max Labels */}
      <div className="w-full flex justify-between px-4 mt-6 text-[10px] text-muted-foreground font-medium opacity-50">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
