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
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-r border-white/5">
      <div className="p-6">
        <div className="flex items-start justify-between mb-8 px-2">
          <div className="flex flex-col gap-2">
            <img src="/logo.jpg" alt="SYAZ Logo" className="h-16 w-auto object-contain self-start mix-blend-screen" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/80 ml-1">Satellite Intelligence</p>
          </div>
          <NotificationsPopover />
        </div>

        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));

            return (
              <Link key={link.href} href={link.href} className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-all duration-200 group font-medium border border-transparent",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}>
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-muted-foreground group-hover:text-foreground")} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-4 py-4 rounded-lg bg-black/20 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">System Status</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Sentinel-1 SAR", status: "online" },
              { label: "Sentinel-2 MSI", status: "online" },
              { label: "Landsat 8/9 OLI", status: "online" },
              { label: "Sentinel-3 OLCI", status: "online" },
              { label: "MODIS Terra/Aqua", status: "online" },
            ].map((sat) => (
              <div key={sat.label} className="flex items-center justify-between text-[11px] font-mono text-muted-foreground/80">
                <span>{sat.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-500 font-bold uppercase tracking-wider">RDY</span>
                </div>
              </div>
            ))}

            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">UPLINK</span>
                <span className="text-emerald-400 font-mono">99.8%</span>
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
