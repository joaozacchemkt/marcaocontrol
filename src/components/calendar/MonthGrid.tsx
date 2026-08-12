import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DayCounts {
  events: number;
  tasks: number;
  finances: number;
}

interface MonthGridProps {
  month: Date;
  onMonthChange: (d: Date) => void;
  selected: Date | undefined;
  onSelect: (d: Date) => void;
  getCounts: (d: Date) => DayCounts;
  density: "compact" | "comfortable" | "spacious";
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const DENSITY: Record<MonthGridProps["density"], string> = {
  compact: "min-h-[56px] p-1.5",
  comfortable: "min-h-[84px] p-2",
  spacious: "min-h-[112px] p-3",
};

export function MonthGrid({
  month,
  onMonthChange,
  selected,
  onSelect,
  getCounts,
  density,
}: MonthGridProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 pb-3">
        <h2 className="truncate text-lg font-black capitalize tracking-tight sm:text-xl">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] font-bold uppercase"
            onClick={() => {
              const today = new Date();
              onMonthChange(startOfMonth(today));
              onSelect(today);
            }}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Mês anterior"
            onClick={() => onMonthChange(subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Próximo mês"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-border/50 pb-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="min-w-0 truncate text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 auto-rows-fr gap-1 pt-2">
        {days.map((day) => {
          const counts = getCounts(day);
          const outside = !isSameMonth(day, month);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const today = isToday(day);
          const hasActivity = counts.events + counts.tasks + counts.finances > 0;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "flex min-w-0 flex-col items-start gap-1 rounded-xl border border-transparent text-left transition-all duration-200",
                DENSITY[density],
                "hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                outside && "opacity-35",
                hasActivity && !isSelected && "bg-muted/25",
                isSelected && "border-primary/40 bg-primary/10 shadow-sm",
              )}
              aria-pressed={isSelected}
              aria-label={format(day, "dd 'de' MMMM", { locale: ptBR })}
            >
              <span
                className={cn(
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums",
                  today && "bg-foreground text-background",
                  isSelected && !today && "text-primary",
                )}
              >
                {format(day, "d")}
              </span>

              {hasActivity && (
                <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1">
                  {counts.events > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {counts.events}
                    </span>
                  )}
                  {counts.tasks > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {counts.tasks}
                    </span>
                  )}
                  {counts.finances > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {counts.finances}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
