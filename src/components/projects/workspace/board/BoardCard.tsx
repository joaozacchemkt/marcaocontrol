import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Bell, CalendarDays, ListChecks, User, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isOverdue, type BoardTask } from "./board-types";

export interface BoardCardProps {
  task: BoardTask;
  subtaskCount?: number;
  hasReminder?: boolean;
  isOverlay?: boolean;
  onOpen?: (task: BoardTask) => void;
  onDelete?: (task: BoardTask) => void;
  selected?: boolean;
  onToggleSelect?: (task: BoardTask) => void;
}

const PRIORITY_VARIANT = {
  alta: "destructive",
  media: "default",
  baixa: "secondary",
} as const;

export function BoardCard({
  task,
  subtaskCount = 0,
  hasReminder = false,
  isOverlay = false,
  onOpen,
  onDelete,
  selected = false,
  onToggleSelect,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const overdue = isOverdue(task);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task)}
      className={cn(
        "select-none rounded-xl border bg-card p-3 shadow-sm transition-fluid cursor-grab active:cursor-grabbing",
        isOverlay && "cursor-grabbing border-primary shadow-xl ring-2 ring-primary/20",
        !isOverlay && "hover:border-primary/50 hover:shadow-md",
        overdue && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {!isOverlay && onToggleSelect && (
          <span
            className="pt-0.5"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              aria-label="Selecionar card"
              onCheckedChange={() => onToggleSelect(task)}
            />
          </span>
        )}
        <p
          className={cn(
            "flex-1 text-sm font-semibold leading-snug",
            task.status === "concluido" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {hasReminder && <Bell className="h-3.5 w-3.5 text-primary" />}
          {overdue && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
          {!isOverlay && onDelete && (
            <button
              type="button"
              aria-label="Excluir card"
              title="Excluir card"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(task);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {task.priority && (
          <Badge
            variant={PRIORITY_VARIANT[task.priority]}
            className="h-4 px-1.5 py-0 text-[9px] uppercase tracking-wider"
          >
            {task.priority}
          </Badge>
        )}
        {task.category && (
          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px]">
            {task.category}
          </Badge>
        )}
        {task.deadline && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "font-semibold text-destructive",
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {format(new Date(task.deadline), "dd MMM", { locale: ptBR })}
          </span>
        )}
        {task.responsible && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.responsible}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {subtaskCount}
          </span>
        )}
      </div>

      {task.status === "aguardando_terceiro" && task.waiting_for && (
        <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          Aguardando: {task.waiting_for}
        </p>
      )}
    </div>
  );
}
