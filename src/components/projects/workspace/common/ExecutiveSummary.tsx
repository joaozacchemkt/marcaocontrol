import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Clock, ListTodo } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";

interface TaskLike {
  id: string;
  title: string;
  status: string | null;
  deadline: string | null;
  waiting_for: string | null;
}

export interface ExecutiveSummaryProps {
  project: {
    next_action?: string | null;
    tasks?: TaskLike[] | null;
  };
}

/**
 * Responde, de forma enxuta, às perguntas executivas ao abrir um workspace:
 * o que fazer agora, o que está atrasado e de quem estou dependendo.
 */
export function ExecutiveSummary({ project }: ExecutiveSummaryProps) {
  const tasks = project.tasks ?? [];
  const open = tasks.filter((t) => t.status !== "concluido");

  const overdue = open.filter(
    (t) => t.deadline && isPast(parseLocalDate(t.deadline)) && !isToday(parseLocalDate(t.deadline)),
  );

  const waiting = open.filter((t) => t.status === "aguardando_terceiro");

  const nextTask = [...open]
    .filter((t) => t.deadline)
    .sort(
      (a, b) => parseLocalDate(a.deadline!)!.getTime() - parseLocalDate(b.deadline!)!.getTime(),
    )[0];

  const nextAction = project.next_action?.trim() || nextTask?.title || null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<ArrowRight className="h-4 w-4" />}
        label="Próxima ação"
        value={nextAction ?? "Nada definido"}
        hint={
          nextTask?.deadline
            ? format(parseLocalDate(nextTask.deadline)!, "dd MMM", { locale: ptBR })
            : undefined
        }
      />
      <SummaryCard
        icon={<ListTodo className="h-4 w-4" />}
        label="Em aberto"
        value={`${open.length}`}
        hint="pendências ativas"
      />
      <SummaryCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Atrasadas"
        value={`${overdue.length}`}
        hint={overdue[0]?.title}
        tone={overdue.length > 0 ? "danger" : undefined}
      />
      <SummaryCard
        icon={<Clock className="h-4 w-4" />}
        label="Aguardando terceiros"
        value={`${waiting.length}`}
        hint={waiting[0]?.waiting_for ?? undefined}
        tone={waiting.length > 0 ? "warning" : undefined}
      />
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "danger" | "warning" | undefined;
}

function SummaryCard({ icon, label, value, hint, tone }: SummaryCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          <span
            className={cn(
              tone === "danger" && "text-destructive",
              tone === "warning" && "text-amber-500",
            )}
          >
            {icon}
          </span>
        </div>
        <p className="mt-2 truncate text-lg font-semibold" title={value}>
          {value}
        </p>
        {hint && (
          <Badge variant="secondary" className="mt-2 max-w-full truncate text-[10px]">
            {hint}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
