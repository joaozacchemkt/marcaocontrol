import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Automático", Icon: Monitor },
];

/** Seletor Claro / Escuro / Automático (segue o sistema). */
export function ThemeToggle({ showLabels = false, className }: { showLabels?: boolean; className?: string }) {
  const { choice, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className={cn("flex rounded-lg border bg-muted/40 p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            choice === value && "bg-background text-foreground shadow-sm",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {showLabels && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
