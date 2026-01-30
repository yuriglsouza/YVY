import { motion } from "framer-motion";

interface GaugeProps {
  value: number; // 0 to 1 normally, but can handle specific ranges
  label: string;
  min?: number;
  max?: number;
  color?: string;
}

export function Gauge({ value, label, min = 0, max = 1, color = "#16a34a" }: GaugeProps) {
  // Normalize value to 0-100 for stroke dasharray
  const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const percentage = normalizedValue * 100;
  
  // Circumference of half circle
  const radius = 40;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue * circumference);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg className="w-32 h-32 transform rotate-[180deg]" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
            strokeDasharray={circumference}
            strokeDashoffset="0"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
      </div>
      <div className="absolute top-10 flex flex-col items-center">
        <span className="text-2xl font-bold font-display tabular-nums tracking-tight">
          {value.toFixed(2)}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
          {label}
        </span>
      </div>
      
      {/* Min/Max Labels */}
      <div className="w-full flex justify-between px-4 mt-2 text-[10px] text-muted-foreground font-medium">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
