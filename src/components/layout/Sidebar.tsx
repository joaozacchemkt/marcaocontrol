import {
  Home,
  CheckSquare,
  Calendar,
  Briefcase,
  Users,
  DollarSign,
  Lightbulb,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlobalAddButton } from "./GlobalAddButton";
import { GlobalSearch } from "../search/GlobalSearch";

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

interface SidebarProps {
  /** No mobile a barra fica fora da tela até isso virar true. */
  open?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ open = false, onNavigate }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Fundo escuro no mobile quando a barra está aberta */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onNavigate}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-8 px-3">
            <h1 className="text-xl font-bold tracking-tight text-primary">Marcão Control</h1>
          </div>

          <div className="mb-6 px-3">
            <GlobalSearch />
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-fluid active:scale-[0.98]",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:pl-4 hover:text-accent-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <item.icon className="relative z-10 mr-3 h-5 w-5 transition-transform duration-200 group-hover:scale-105" />
                  <span className="relative z-10">{item.title}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            <GlobalAddButton />
          </div>
        </div>
      </aside>
    </>
  );
}
