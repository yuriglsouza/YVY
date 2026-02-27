import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";
import { WifiOff } from "lucide-react";
import { useState, useEffect } from "react";

export default function LoginPage() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleGoogleLogin = () => {
        if (isOffline) return;
        window.location.href = "/auth/google";
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1500&q=80')] bg-cover bg-center opacity-10 pointer-events-none" />

            <Card className="w-full max-w-md shadow-2xl bg-white/95 backdrop-blur-md relative z-10 border border-[#D0D0D0]/30 rounded-2xl overflow-hidden">
                <CardHeader className="text-center space-y-3 pb-4 pt-8">
                    <div className="mx-auto mb-4 flex justify-center">
                        <img src="/logo.png" alt="SYAZ Orbital" className="h-16 w-auto object-contain" />
                    </div>
                    <CardTitle
                        className="text-3xl tracking-tight"
                        style={{ color: "#172649", fontFamily: "Arial, sans-serif", fontWeight: "bold" }}
                    >
                        SYAZ ORBITAL
                    </CardTitle>
                    <CardDescription
                        className="font-medium text-[15px]"
                        style={{ color: "#2F447F", fontFamily: "Campton, sans-serif", fontWeight: 300 }}
                    >
                        Inteligência Artificial para Agricultura de Precisão
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-2 pb-8 px-8">
                    <p
                        className="text-center text-sm leading-relaxed"
                        style={{ color: "#555555", fontFamily: "Campton, sans-serif", fontWeight: 300 }}
                    >
                        Monitore suas fazendas, gere relatórios agronômicos e tome decisões baseadas em dados de satélite e IA.
                    </p>

                    <Button
                        size="lg"
                        disabled={isOffline}
                        className="w-full text-white transition-all text-base h-12 shadow-md relative overflow-hidden group border-0 rounded-xl"
                        style={{ backgroundColor: isOffline ? "#D0D0D0" : "#2F447F", fontFamily: "Arial, sans-serif", fontWeight: "bold" }}
                        onClick={handleGoogleLogin}
                    >
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-[#172649] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <span className="relative z-10 flex items-center justify-center">
                            <SiGoogle className="mr-3 w-5 h-5" />
                            {isOffline ? "AGUARDANDO CONEXÃO..." : "ENTRAR COM GOOGLE"}
                        </span>
                    </Button>

                    <div className="text-center text-xs pt-4 border-t border-[#D0D0D0]/40 mt-6 pt-6">
                        <p style={{ color: "#000000", fontFamily: "Campton, sans-serif", fontWeight: 300 }}>
                            Acesso seguro e criptografado.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {isOffline && (
                <div className="mt-8 flex items-center justify-center px-6 py-3 rounded-full border shadow-lg animate-pulse" style={{ backgroundColor: "#FDFDFD", borderColor: "#172649" }}>
                    <WifiOff className="w-5 h-5 mr-3" style={{ color: "#172649" }} />
                    <span className="text-[14px]" style={{ color: "#172649", fontFamily: "Arial, sans-serif", fontWeight: "bold" }}>Você está Offline. Conecte-se para autenticar pela primeira vez.</span>
                </div>
            )}
        </div>
    );
}
