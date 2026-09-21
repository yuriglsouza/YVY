import { useId, useState } from "react";
import { Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateLivestockFinancial, type LivestockInputs } from "@shared/livestock-financial";

const number = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LivestockFinancialDialog({ farmSizeHa }: { farmSizeHa: number }) {
  const id = useId();
  const [mode, setMode] = useState<"milk" | "weight">("milk");
  const [fields, setFields] = useState({
    areaHa: String(farmSizeHa), days: "30", animals: "", productionPerAnimalDay: "",
    unitPrice: "", pastureCostPerHa: "", dailyCostPerAnimal: "", otherCosts: "0",
  });
  const inputs = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() === "" ? NaN : Number(value)]));
  const results = calculateLivestockFinancial({ ...inputs, mode } as LivestockInputs);
  const unit = mode === "milk" ? "L" : "kg de peso vivo";
  const fieldLabels: Record<keyof typeof fields, string> = {
    areaHa: "Área de pastagem utilizada (ha)", days: "Período (dias)",
    animals: mode === "milk" ? "Vacas em lactação" : "Animais em engorda",
    productionPerAnimalDay: mode === "milk" ? "Leite comercializado (L/vaca/dia)" : "Ganho de peso (kg/animal/dia)",
    unitPrice: mode === "milk" ? "Preço do leite (R$/L)" : "Valor do ganho (R$/kg de peso vivo)",
    pastureCostPerHa: "Custo do pasto (R$/ha no período)",
    dailyCostPerAnimal: "Demais custos (R$/animal/dia)", otherCosts: "Outros custos totais do período (R$)",
  };
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" className="gap-2"><Calculator className="h-4 w-4" />Financeiro da Pastagem</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Resultado econômico da pastagem</DialogTitle>
        <DialogDescription>Simulação do período com os valores que você informar. Os parâmetros não são salvos ao sair da fazenda.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={id + "-mode"}>Atividade</Label>
        <select id={id + "-mode"} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mode}
          onChange={event => { setMode(event.target.value as "milk" | "weight"); setFields(previous => ({ ...previous, animals: "", productionPerAnimalDay: "", unitPrice: "" })); }}>
          <option value="milk">Produção de leite</option><option value="weight">Ganho de peso</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(fieldLabels) as (keyof typeof fields)[]).map(key => <div key={key} className="space-y-2">
          <Label htmlFor={id + key}>{fieldLabels[key]}</Label>
          <Input id={id + key} type="number" min={["areaHa", "days", "animals"].includes(key) ? (key === "areaHa" ? 0.01 : 1) : 0}
            step={["days", "animals"].includes(key) ? 1 : "any"} value={fields[key]}
            onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} />
        </div>)}
      </div>
      <p className="text-xs text-muted-foreground">Informe custos proporcionais ao mesmo período, sem repetir despesas entre campos. Na lotação, conte somente os animais considerados nesta simulação.</p>
      {results ? <div className="rounded-xl border bg-muted/30 p-4 space-y-3" aria-live="polite">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            [mode === "milk" ? "Receita estimada" : "Valor estimado do ganho de peso", money(results.revenue)],
            ["Custos do período", money(results.costs)],
            ["Resultado estimado", money(results.result)],
            ["Retorno sobre custos", results.roi === null ? "Indefinido (custo zero)" : number(results.roi) + "%"],
            ["Produção no período", number(results.production) + " " + unit],
            ["Lotação considerada", number(results.animalsPerHa) + " animais/ha"],
            ["Custo por animal no período", money(results.costPerAnimal)],
            ["Preço de equilíbrio", results.breakEvenPrice === null ? "Indefinido (produção zero)" : money(results.breakEvenPrice) + "/" + unit],
          ].map(([label, value]) => <div key={label}><p className="text-muted-foreground">{label}</p><p className="font-semibold break-words">{value}</p></div>)}
        </div>
      </div> : <p className="rounded-lg border p-4 text-sm" role="status">Preencha todos os campos com valores válidos para calcular. Informe zero onde não houver custo.</p>}
      <p className="text-xs text-muted-foreground">{mode === "weight"
        ? "O resultado considera somente o valor do peso ganho no período, não a venda integral nem a compra dos animais. Não é uma estimativa da margem completa de compra e venda."
        : "A estimativa considera o leite comercializado e os custos informados, sem estimar produção pelo satélite."} A lotação informada não representa recomendação de capacidade de suporte.</p>
    </DialogContent>
  </Dialog>;
}
