
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

interface ReportConfigDialogProps {
    onGenerate: (config: ReportConfig) => void;
    trigger?: React.ReactNode;
}

export interface ReportConfig {
    companyName: string;
    consultantName: string;
    comments: string;
}

export function ReportConfigDialog({ onGenerate, trigger }: ReportConfigDialogProps) {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<ReportConfig>({
        companyName: "",
        consultantName: "",
        comments: ""
    });

    const handleGenerate = () => {
        onGenerate(config);
        setOpen(false);
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Personalizar Relatório</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="company" className="text-right">
                            Empresa
                        </Label>
                        <Input
                            id="company"
                            placeholder="Sua Consultoria Ltda"
                            className="col-span-3"
                            value={config.companyName}
                            onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                        />
                    </div>
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
                </div>
                <DialogFooter>
                    <Button onClick={handleGenerate}>Gerar PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
