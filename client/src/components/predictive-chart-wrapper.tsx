import { useState } from "react";
import { availableFarmId } from "@/lib/farm-selection";
import { PredictiveChart } from "@/components/predictive-chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Farm } from "@shared/schema";

export function PredictiveChartWrapper({ farms }: { farms: Farm[] }) {
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>(
    farms[0]?.id.toString(),
  );
  const effectiveFarmId = availableFarmId(farms, selectedFarmId);
  if (!effectiveFarmId) return null;

  return (
    <div className="col-span-1 lg:col-span-4">
      <PredictiveChart
        key={effectiveFarmId}
        farmId={Number(effectiveFarmId)}
        headerSlot={
          <Select value={effectiveFarmId} onValueChange={setSelectedFarmId}>
            <SelectTrigger
              aria-label="Fazenda da projeção"
              className="w-full sm:w-[200px] bg-background/50 border-primary/20"
            >
              <SelectValue placeholder="Selecione a fazenda" />
            </SelectTrigger>
            <SelectContent>
              {farms.map((farm) => (
                <SelectItem key={farm.id} value={farm.id.toString()}>
                  {farm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
