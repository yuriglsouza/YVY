import { Link, useLocation } from "wouter";
import { Sprout, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Painel", icon: LayoutDashboard },
    { href: "/farms", label: "Minhas Fazendas", icon: Sprout },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-card border-r border-border/40 fixed left-0 top-0 flex flex-col z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none">AgriSat</h1>
            <p className="text-xs text-muted-foreground mt-1">Monitoramento via Satélite</p>
          </div>
        </div>

        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            
            return (
              <Link key={link.href} href={link.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
                isActive 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
                <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-4 py-4 rounded-2xl bg-secondary/30 border border-border/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Satélites Ativos</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Sentinel-2A</span>
              <span className="text-emerald-600 font-bold">CONECTADO</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Landsat 8</span>
              <span className="text-emerald-600 font-bold">CONECTADO</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Sinal</span>
                <span className="text-foreground font-medium">Forte (98%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-border/40">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
