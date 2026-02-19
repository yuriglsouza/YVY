import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/Sidebar";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Plans() {
    const { data: user, refetch } = useUser();
    const { toast } = useToast();
    const [, setLocation] = useLocation();

    const handleSuccess = async (orderId: string) => {
        try {
            const res = await fetch("/api/subscriptions/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
            });

            if (!res.ok) throw new Error("Failed to process subscription");

            await refetch();
            toast({
                title: "Sucesso!",
                description: "Sua assinatura foi ativada. Bem-vindo ao Plano Pro!",
                variant: "default",
            });
            setLocation("/");
        } catch (error) {
            toast({
                title: "Erro",
                description: "Houve um problema ao confirmar seu pagamento.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-12 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-10 text-center">
                        <h1 className="text-3xl font-display font-bold mb-2">Planos e Assinaturas</h1>
                        <p className="text-muted-foreground">Escolha o plano ideal para sua operação.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Free Plan */}
                        <div className="border border-border rounded-xl p-8 bg-card/50 flex flex-col">
                            <div className="mb-4">
                                <h3 className="text-xl font-bold">Gratuito</h3>
                                <p className="text-3xl font-mono mt-2">R$ 0<span className="text-sm text-muted-foreground font-sans">/mês</span></p>
                            </div>
                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> Monitoramento Básico</li>
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> 1 Fazenda</li>
                                <li className="flex gap-2 items-center text-sm text-muted-foreground"><X className="w-4 h-4" /> Relatórios PDF</li>
                                <li className="flex gap-2 items-center text-sm text-muted-foreground"><X className="w-4 h-4" /> Análise IA Avançada</li>
                            </ul>
                            <button disabled className="w-full py-2 rounded-md bg-secondary/50 text-muted-foreground text-sm font-medium cursor-not-allowed">
                                Plano Atual
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className="border border-emerald-500/30 rounded-xl p-8 bg-emerald-500/5 relative flex flex-col">
                            <div className="absolute top-0 right-0 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                RECOMENDADO
                            </div>
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-emerald-400">Profissional</h3>
                                <p className="text-3xl font-mono mt-2">R$ 1,00<span className="text-sm text-muted-foreground font-sans">/mês</span></p>
                                <p className="text-xs text-emerald-500/80 mt-1">*Preço Promocional</p>
                            </div>
                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> Monitoramento Ilimitado</li>
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> Múltiplas Fazendas</li>
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> Relatórios Exportáveis</li>
                                <li className="flex gap-2 items-center text-sm"><Check className="w-4 h-4 text-emerald-500" /> Consultoria IA</li>
                            </ul>

                            {user?.subscriptionStatus === 'active' || user?.role === 'admin' ? (
                                <div className="w-full py-3 rounded-md bg-emerald-500/20 text-emerald-400 text-center font-bold border border-emerald-500/50">
                                    Você já é Premium! 🌟
                                </div>
                            ) : (
                                <div className="w-full">
                                    <PayPalScriptProvider options={{
                                        clientId: "AbaIyjFcMebp0Py3nDYh1BteVqOGB-gFEl358ImVI4IPzK7w8XUqYeIkEWlFG_30Dl64fEnLj4Bn1ezJ",
                                        currency: "BRL"
                                    }}>
                                        <PayPalButtons
                                            style={{ layout: "horizontal", tagline: false, height: 40 }}
                                            createOrder={(data, actions) => {
                                                return actions.order.create({
                                                    intent: "CAPTURE",
                                                    purchase_units: [
                                                        {
                                                            amount: {
                                                                currency_code: "BRL",
                                                                value: "1.00",
                                                            },
                                                            description: "Assinatura SYAZ Pro - Mensal"
                                                        },
                                                    ],
                                                });
                                            }}
                                            onApprove={async (data, actions) => {
                                                if (actions.order) {
                                                    const details = await actions.order.capture();
                                                    // Call backend to update user
                                                    handleSuccess(details.id!);
                                                }
                                            }}
                                        />
                                    </PayPalScriptProvider>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
