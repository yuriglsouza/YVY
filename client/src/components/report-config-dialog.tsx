
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, DollarSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface ReportConfigDialogProps {
    onGenerate: (config: ReportConfig) => void;
    trigger?: React.ReactNode;
}

export interface ReportConfig {
    consultantName: string;
    comments: string;
    includeFinancials: boolean;
    financials?: {
        costPerHa: number;
        pricePerBag: number;
        yields: {
            high: number;
            medium: number;
            low: number;
        };
    };
}

export function ReportConfigDialog({ onGenerate, trigger }: ReportConfigDialogProps) {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<ReportConfig>({
        consultantName: "",
        comments: "",
        includeFinancials: false,
        financials: {
            costPerHa: 5000,
            pricePerBag: 120,
            yields: { high: 75, medium: 60, low: 40 }
        }
    });

    const handleGenerate = () => {
        onGenerate(config);
        setOpen(false);
    };

    const updateFinancials = (field: string, value: number) => {
        if (!config.financials) return;
        setConfig({
            ...config,
            financials: {
                ...config.financials,
                [field]: value
            }
        });
    };

    const updateYields = (zone: 'high' | 'medium' | 'low', value: number) => {
        if (!config.financials) return;
        setConfig({
            ...config,
            financials: {
                ...config.financials,
                yields: {
                    ...config.financials.yields,
                    [zone]: value
                }
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline">
                        <FileText className="w-4 h-4 mr-2" />
                        Gerar Relatório
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Personalizar Relatório</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="consultant" className="text-right">
                            Consultor
                        </Label>
                        <Input
                            id="consultant"
                            placeholder="Seu Nome"
                            className="col-span-3"
                            value={config.consultantName}
                            onChange={(e) => setConfig({ ...config, consultantName: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="comments">Comentários Adicionais</Label>
                        <Textarea
                            id="comments"
                            placeholder="Observações técnicas específicas para este relatório..."
                            value={config.comments}
                            onChange={(e) => setConfig({ ...config, comments: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t mt-2">
                        <Switch
                            id="financials-mode"
                            checked={config.includeFinancials}
                            onCheckedChange={(checked) => setConfig({ ...config, includeFinancials: checked })}
                        />
                        <Label htmlFor="financials-mode" className="flex items-center gap-2 cursor-pointer">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            Incluir Análise Financeira (ROI)
                        </Label>
                    </div>

                    {config.includeFinancials && config.financials && (
                        <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Custo (R$/ha)</Label>
                                    <Input
                                        type="number"
                                        value={config.financials.costPerHa}
                                        onChange={(e) => updateFinancials('costPerHa', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Preço Saca (R$)</Label>
                                    <Input
                                        type="number"
                                        value={config.financials.pricePerBag}
                                        onChange={(e) => updateFinancials('pricePerBag', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Produtividade Esperada (sc/ha)</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-green-600">Alta</Label>
                                        <Input type="number" value={config.financials.yields.high} onChange={(e) => updateYields('high', Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-yellow-600">Média</Label>
                                        <Input type="number" value={config.financials.yields.medium} onChange={(e) => updateYields('medium', Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-red-600">Baixa</Label>
                                        <Input type="number" value={config.financials.yields.low} onChange={(e) => updateYields('low', Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
                <DialogFooter>
                    <Button onClick={handleGenerate}>Gerar PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
