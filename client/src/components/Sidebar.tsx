import { Link, useLocation } from "wouter";
import { Sprout, LayoutDashboard, Settings, LogOut, Menu, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsPopover } from "@/components/notifications-popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SidebarProps {
  className?: string;
}

export function SidebarContent() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Painel", icon: LayoutDashboard },
    { href: "/farms", label: "Minhas Fazendas", icon: Sprout },
    { href: "/clients", label: "Clientes", icon: Users },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-start justify-between mb-8 px-2">
          <div className="flex flex-col gap-2">
            <img src="/logo.jpg" alt="YVY Logo" className="h-16 w-auto object-contain self-start" />
            <p className="text-xs text-muted-foreground ml-1">Monitoramento via Satélite</p>
          </div>
          <NotificationsPopover />
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
              <span>Sentinel-1 (Radar)</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Sentinel-2 (Óptico)</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Landsat 8/9 (Térmico)</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Sentinel-3 (Clorofila)</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>MODIS (Contexto)</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
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

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("w-64 h-screen bg-card border-r border-border/40 fixed left-0 top-0 hidden lg:flex flex-col z-50", className)}>
      <SidebarContent />
    </div>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden fixed top-4 left-4 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm border-border">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 border-r border-border/40 w-72 bg-card">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}
