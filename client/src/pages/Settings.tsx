import { useState, useEffect } from "react";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Bell, Moon, Sun, Shield, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType, InsertUser } from "@shared/schema";

export default function Settings() {
    const { toast } = useToast();
    const [theme, setTheme] = useState("light");

    // Fetch User Settings
    const { data: user, isLoading } = useQuery<UserType>({
        queryKey: ["/api/settings"]
    });

    // Local state for form (initialized from data)
    const [formData, setFormData] = useState<InsertUser>({
        email: "",
        receiveAlerts: true
    });

    // Sync data to form
    useEffect(() => {
        if (user) {
            setFormData({
                email: user.email,
                receiveAlerts: user.receiveAlerts
            });
        }
    }, [user]);

    // Save Mutation
    const mutation = useMutation({
        mutationFn: async (data: InsertUser) => {
            const res = await apiRequest("PUT", "/api/settings", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
            toast({
                title: "Configurações salvas",
                description: "Suas preferências foram atualizadas com sucesso."
            });
        },
        onError: (error) => {
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível atualizar as configurações.",
                variant: "destructive"
            });
            console.error(error);
        }
    });

    const handleSave = () => {
        if (!formData.email) {
            toast({ title: "Email inválido", description: "Por favor insira um email.", variant: "destructive" });
            return;
        }
        mutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background pl-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
                    <p className="text-muted-foreground mb-8">Gerencie suas preferências e alertas.</p>

                    <div className="space-y-6">

                        {/* Perfil */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5" /> Perfil
                                </CardTitle>
                                <CardDescription>Suas informações de contato.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email para Alertas</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="exemplo@email.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Usaremos este email para enviar alertas críticos da lavoura.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notificações */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="w-5 h-5" /> Notificações
                                </CardTitle>
                                <CardDescription>Escolha como você quer ser avisado.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Alertas Críticos</Label>
                                        <p className="text-sm text-muted-foreground">Receba email quando NDVI, NDWI ou Temperatura atingirem níveis críticos.</p>
                                    </div>
                                    <Switch
                                        checked={formData.receiveAlerts}
                                        onCheckedChange={(c) => setFormData({ ...formData, receiveAlerts: c })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sistema */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5" /> Status do Sistema
                                </CardTitle>
                                <CardDescription>Conexões com serviços externos.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-green-500/10 border-green-500/20">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <div className="w-2 h-2 rounded-full bg-green-500" /> Google Earth Engine
                                    </span>
                                    <span className="text-xs text-green-600 font-bold">CONECTADO</span>
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-green-500/10 border-green-500/20">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <div className="w-2 h-2 rounded-full bg-green-500" /> Email Service (Nodemailer)
                                    </span>
                                    <span className="text-xs text-green-600 font-bold">ATIVO</span>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSave} disabled={mutation.isPending} className="gap-2">
                                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
                            </Button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
