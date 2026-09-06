import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReactNode } from "react";
import { PageTransition } from "./PageTransition";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      {/* Barra de topo só no mobile — abre a lateral */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-bold tracking-tight text-primary">Marcão Control</span>
      </header>

      <main className="p-4 md:ml-64 md:p-8">
        <div className="mx-auto max-w-7xl">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
