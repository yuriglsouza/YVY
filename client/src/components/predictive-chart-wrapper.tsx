
import { useState, useEffect } from "react";
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
    const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id.toString());

    // Ensure selection remains valid if farms change
    useEffect(() => {
        if (farms.length > 0 && !farms.find(f => f.id.toString() === selectedFarmId)) {
            setSelectedFarmId(farms[0].id.toString());
        }
    }, [farms, selectedFarmId]);

    return (
        <div className="col-span-1 lg:col-span-4">
            {/* 
        We pass the selector as a 'headerSlot' prop to the child component 
        so it renders neatly inside the card header
      */}
            <PredictiveChart
                farmId={Number(selectedFarmId)}
                headerSlot={
                    <Select value={selectedFarmId} onValueChange={setSelectedFarmId}>
                        <SelectTrigger className="w-full sm:w-[200px] bg-background/50 border-primary/20">
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
