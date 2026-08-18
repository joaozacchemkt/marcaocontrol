import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  MapPin,
  Plus,
  Timer,
  CheckCircle2,
  AlertCircle,
  CalendarX2,
  PanelRightClose,
  Pencil,
  Trash2,
  CheckCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface DayDetailsPanelProps {
  date: Date | undefined;
  events: any[];
  tasks: any[];
  finances: any[];
  onAddEvent: () => void;
  onAddTask: () => void;
  onCollapse?: (() => void) | undefined;
  onEditEvent?: ((event: any) => void) | undefined;
  onDeleteEvent?: ((event: any) => void) | undefined;
  onToggleTask?: ((task: any) => void) | undefined;
}

export function DayDetailsPanel({
  date,
  events,
  tasks,
  finances,
  onAddEvent,
  onAddTask,
  onCollapse,
  onEditEvent,
  onDeleteEvent,
  onToggleTask,
}: DayDetailsPanelProps) {
  const total = events.length + tasks.length + finances.length;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            {date ? format(date, "MMMM yyyy", { locale: ptBR }) : "—"}
          </p>
          <h3 className="truncate text-base font-bold tracking-tight">
            {date ? format(date, "EEEE, dd", { locale: ptBR }) : "Selecione um dia"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {total} {total === 1 ? "atividade" : "atividades"}
          </p>
        </div>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onCollapse}
            aria-label="Recolher painel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-8 text-center">
              <CalendarX2 className="h-5 w-5 text-muted-foreground/60" />
              <p className="text-xs font-medium text-muted-foreground">Nenhuma atividade neste dia</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onAddEvent}>
                  <Plus className="mr-1 h-3 w-3" /> Compromisso
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onAddTask}>
                  <Plus className="mr-1 h-3 w-3" /> Pendência
                </Button>
              </div>
            </div>
          ) : (
            <>
              {events.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Compromissos
                  </h4>
                  {events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-xl border border-border/50 bg-background/40 p-3 transition-colors hover:bg-background/80"
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-black text-primary">
                          {format(new Date(event.start_time), "HH:mm")}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold leading-tight">{event.title}</p>
                          {event.location && (
                            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                              {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className="line-clamp-2 text-[11px] text-muted-foreground/80">
                              {event.description}
                            </p>
                          )}
                          {(onEditEvent || onDeleteEvent) && (
                            <div className="flex items-center gap-1 pt-1">
                              {onEditEvent && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label="Editar compromisso"
                                  onClick={() => onEditEvent(event)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {onDeleteEvent && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Excluir compromisso">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{event.title}" será removido da agenda.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => onDeleteEvent(event)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              )}

              {tasks.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Pendências
                  </h4>
                  {tasks.map((task) => (
                    <article
                      key={task.id}
                      className={cn(
                        "rounded-xl border border-border/50 bg-background/40 p-3 transition-colors hover:bg-background/80",
                        task.status === "concluido" && "opacity-50",
                      )}
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                        <span className="shrink-0 rounded-md bg-muted p-1.5">
                          {task.status === "concluido" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : task.priority === "alta" ? (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <Timer className="h-3.5 w-3.5 text-primary" />
                          )}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <p
                            className={cn(
                              "truncate text-sm font-semibold leading-tight",
                              task.status === "concluido" && "text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {task.projects?.name && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-black uppercase">
                                {task.projects.name}
                              </Badge>
                            )}
                            <Badge
                              variant={task.priority === "alta" ? "destructive" : "outline"}
                              className="px-1.5 py-0 text-[9px] font-black uppercase"
                            >
                              {task.priority}
                            </Badge>
                          </div>
                          {task.waiting_for && (
                            <p className="flex items-center gap-1 text-[10px] italic text-muted-foreground">
                              <Clock className="h-3 w-3" /> Aguardando: {task.waiting_for}
                            </p>
                          )}
                          {onToggleTask && task.status !== undefined && !task.date && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] font-bold uppercase"
                              onClick={() => onToggleTask(task)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {task.status === "concluido" ? "Reabrir" : "Concluir"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              )}
              {finances.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Vencimentos
                  </h4>
                  {finances.map((item) => (
                    <article
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-3"
                    >
                      <p className="truncate text-sm font-semibold">{item.description || "Lançamento"}</p>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-black tabular-nums",
                          item.type === "receita" ? "text-emerald-500" : "text-destructive",
                        )}
                      >
                        {item.type === "receita" ? "+" : "-"}
                        {Number(item.amount || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {total > 0 && (
        <footer className="grid grid-cols-2 gap-2 border-t border-border/50 p-3">
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onAddEvent}>
            <Plus className="mr-1 h-3 w-3" /> Compromisso
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onAddTask}>
            <Plus className="mr-1 h-3 w-3" /> Pendência
          </Button>
        </footer>
      )}
    </div>
  );
}
