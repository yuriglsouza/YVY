import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiGoogle } from "react-icons/si";

export default function LoginPage() {
    const handleGoogleLogin = () => {
        window.location.href = "/auth/google";
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1500&q=80')] bg-cover bg-center opacity-10 pointer-events-none" />

            <Card className="w-full max-w-md shadow-2xl bg-white/90 backdrop-blur-sm relative z-10 border-green-100">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto mb-6 flex justify-center">
                        <img src="/logo.png" alt="SYAZ Orbital" className="h-20 w-auto object-contain" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-green-900">SYAZ ORBITAL</CardTitle>
                    <CardDescription className="text-green-700 font-medium">
                        Inteligência Artificial para Agricultura de Precisão
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <p className="text-center text-sm text-muted-foreground leading-relaxed">
                        Monitore suas fazendas, gere relatórios agronômicos e tome decisões baseadas em dados de satélite e IA.
                    </p>

                    <Button
                        size="lg"
                        className="w-full bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 transition-all text-base h-12 shadow-sm"
                        onClick={handleGoogleLogin}
                    >
                        <SiGoogle className="mr-3 w-5 h-5 text-red-500" />
                        Entrar com Google
                    </Button>

                    <Button
                        size="lg"
                        variant="ghost"
                        className="w-full text-xs text-muted-foreground border border-dashed border-border"
                        onClick={async () => {
                            try {
                                const res = await fetch("/api/dev-login", { method: "POST" });
                                if (res.ok) window.location.href = "/";
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                    >
                        [DEV] Entrar Imediatamente (Bypass)
                    </Button>

                    <div className="text-center text-xs text-muted-foreground pt-4">
                        <p>Acesso seguro e criptografado.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
