import { Link, useLocation } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

/** Atalho flutuante pra tela do assistente (some na própria tela). */
export function AssistantLauncher() {
  const { pathname } = useLocation();
  if (pathname === "/assistente") return null;
  return (
    <Link
      to="/assistente"
      search={{ de: pathname }}
      aria-label="Abrir assistente"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
    >
      <Sparkles className="h-6 w-6" />
    </Link>
  );
}
