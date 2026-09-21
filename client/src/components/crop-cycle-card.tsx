import { CircleAlert, Sprout } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCropCycleSummary } from "@shared/agronomy";
import type { CropStage } from "@shared/crop-stage";

interface CropCycleCardProps {
  plantingDate?: string | null;
  harvestDate?: string | null;
  cropStage?: CropStage | null;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return "Não informada";
  return format(new Date(`${value}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function CropCycleCard({ plantingDate, harvestDate, cropStage }: CropCycleCardProps) {
  const cycle = getCropCycleSummary(plantingDate, harvestDate);
  const needsAttention = cycle.status === "missing" || cycle.status === "invalid" || cycle.status === "overdue";

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Sprout className="w-4 h-4 text-primary" /> Ciclo da cultura
          </CardTitle>
          <Badge variant={needsAttention ? "secondary" : "default"} className="whitespace-nowrap">
            {cycle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">Último estágio observado em campo</p>
          <p className="font-semibold break-words">{cropStage?.stage || "Ainda não registrado"}</p>
          {cropStage && <p className="text-xs text-muted-foreground mt-1">Observado em {formatDateOnly(cropStage.observedOn)} · Registro manual</p>}
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">Plantio</span>
            <span className="text-right font-medium">{formatDateOnly(plantingDate)}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">Colheita prevista</span>
            <span className="text-right font-medium">{formatDateOnly(harvestDate)}</span>
          </div>
        </div>

        {cycle.progressPercent !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{cycle.phaseLabel}</span>
              <span className="font-mono text-muted-foreground">{cycle.progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${cycle.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {cycle.daysElapsed !== null && <span>{cycle.daysElapsed} dias decorridos</span>}
          {cycle.daysRemaining !== null && <span>{cycle.daysRemaining} dias restantes</span>}
        </div>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Esta é uma leitura cronológica. Confirme o estágio fenológico durante a vistoria de campo.
        </p>
      </CardContent>
    </Card>
  );
}
