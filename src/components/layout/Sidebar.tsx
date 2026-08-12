import { 
  Home, 
  CheckSquare, 
  Calendar, 
  Briefcase, 
  Users, 
  DollarSign, 
  Lightbulb, 
  Settings,
  Plus,
  LayoutDashboard
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { GlobalAddButton } from "./GlobalAddButton";

const menuItems = [
  { title: "Início", href: "/", icon: Home },
  { title: "Pendências", href: "/tarefas", icon: CheckSquare },
  { title: "Agenda", href: "/agenda", icon: Calendar },
  { title: "Projetos", href: "/projetos", icon: Briefcase },
  { title: "Contatos", href: "/contatos", icon: Users },
  { title: "Financeiro", href: "/financeiro", icon: DollarSign },
  { title: "Ideias", href: "/ideias", icon: Lightbulb },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform md:translate-x-0">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-10 px-3">
          <h1 className="text-xl font-bold tracking-tight text-primary">Marcão Control</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4">
          <button className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-95">
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </button>
        </div>
      </div>
    </aside>
  );
}
