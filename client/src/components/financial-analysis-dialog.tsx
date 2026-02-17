
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Zone {
    id: number;
    name: string;
    color: string;
    area_percentage: number;
}

interface FinancialAnalysisDialogProps {
    zones: Zone[];
    farmSizeHa: number;
}

export function FinancialAnalysisDialog({ zones, farmSizeHa }: FinancialAnalysisDialogProps) {
    const [open, setOpen] = useState(false);

    // Inputs
    const [costPerHa, setCostPerHa] = useState<number>(5000); // R$/ha
    const [pricePerBag, setPricePerBag] = useState<number>(120); // R$/saca

    // Productivity Assumptions (Bags/ha)
    const [highYield, setHighYield] = useState<number>(75);
    const [mediumYield, setMediumYield] = useState<number>(60);
    const [lowYield, setLowYield] = useState<number>(40);

    // Results
    const [results, setResults] = useState({
        totalCost: 0,
        grossRevenue: 0,
        netProfit: 0,
        roi: 0,
        avgYield: 0
    });

    useEffect(() => {
        if (!zones.length) return;

        // 1. Calculate Areas
        const highZone = zones.find(z => z.name === "Alta Produtividade")?.area_percentage || 0;
        const mediumZone = zones.find(z => z.name === "Média Produtividade")?.area_percentage || 0;
        const lowZone = zones.find(z => z.name === "Baixa Produtividade")?.area_percentage || 0;

        // 2. Total Production (Bags)
        const production = (
            (highZone * farmSizeHa * highYield) +
            (mediumZone * farmSizeHa * mediumYield) +
            (lowZone * farmSizeHa * lowYield)
        );

        // 3. Financials
        const totalCost = farmSizeHa * costPerHa;
        const grossRevenue = production * pricePerBag;
        const netProfit = grossRevenue - totalCost;
        const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
        const avgYield = production / farmSizeHa;

        setResults({
            totalCost,
            grossRevenue,
            netProfit,
            roi,
            avgYield
        });

    }, [costPerHa, pricePerBag, highYield, mediumYield, lowYield, zones, farmSizeHa]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600/20 text-green-700 hover:bg-green-50">
                    <Calculator className="w-4 h-4 mr-2" />
                    Análise Financeira (ROI)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Análise Financeira por Zona de Manejo
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">

                    {/* Inputs Column */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Parâmetros de Mercado</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Custo de Produção (R$/ha)</Label>
                                <Input
                                    type="number"
                                    value={costPerHa}
                                    onChange={(e) => setCostPerHa(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Preço da Saca (R$)</Label>
                                <Input
                                    type="number"
                                    value={pricePerBag}
                                    onChange={(e) => setPricePerBag(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pt-4">Produtividade Esperada (sc/ha)</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-green-600">Zona de Alta Vigor</Label>
                                <Input
                                    type="number" className="w-24 text-right"
                                    value={highYield} onChange={(e) => setHighYield(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-yellow-600">Zona de Média Vigor</Label>
                                <Input
                                    type="number" className="w-24 text-right"
                                    value={mediumYield} onChange={(e) => setMediumYield(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-red-600">Zona de Baixa Vigor</Label>
                                <Input
                                    type="number" className="w-24 text-right"
                                    value={lowYield} onChange={(e) => setLowYield(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Results Column */}
                    <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Projeção de Resultado</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Receita Bruta</p>
                                    <p className="text-lg font-bold text-green-700">{formatCurrency(results.grossRevenue)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                                    <p className={`text-lg font-bold ${results.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(results.netProfit)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="bg-background p-4 rounded-lg border border-border shadow-sm flex items-center justify-around">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">ROI (Retorno)</p>
                                <p className={`text-2xl font-bold flex items-center justify-center gap-1 ${results.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {results.roi > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    {results.roi.toFixed(1)}%
                                </p>
                            </div>
                            <div className="h-10 w-px bg-border"></div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Média da Fazenda</p>
                                <p className="text-xl font-bold text-foreground">
                                    {results.avgYield.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">sc/ha</span>
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground text-justify leading-relaxed">
                            *Cálculo baseado na distribuição de área das zonas de manejo identificadas pelo satélite Sentinel-2.
                            Serve como estimativa para planejamento financeiro.
                        </p>

                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
