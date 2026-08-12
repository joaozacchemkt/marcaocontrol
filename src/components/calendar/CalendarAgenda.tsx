import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalendarAgenda() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .not('deadline', 'is', null)
        .order('deadline', { ascending: true });
      
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const selectedDateTasks = tasks?.filter(task => 
    task.deadline && isSameDay(parseISO(task.deadline), date || new Date())
  ) || [];

  const selectedDateEvents = events?.filter(event => 
    isSameDay(parseISO(event.start_time), date || new Date())
  ) || [];

  const isLoading = tasksLoading || eventsLoading;

  // Modificadores para destacar dias com eventos
  const modifiers = {
    booked: (d: Date) => {
      const hasTask = tasks?.some(t => t.deadline && isSameDay(parseISO(t.deadline), d));
      const hasMeeting = events?.some(e => isSameDay(parseISO(e.start_time), d));
      return !!(hasTask || hasMeeting);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Selecione uma Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border-none mx-auto"
              locale={ptBR}
              modifiers={modifiers}
              modifiersClassNames={{
                booked: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full relative"
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumo do Mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Pendências com prazo</span>
              <span className="font-semibold text-foreground">{tasks?.length || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Compromissos agendados</span>
              <span className="font-semibold text-foreground">{events?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm flex flex-col min-h-[600px] shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-xl">
                {date ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedDateTasks.length + selectedDateEvents.length} atividades programadas
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[550px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : selectedDateTasks.length === 0 && selectedDateEvents.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">Nenhum compromisso</p>
                  <p className="text-sm">Tudo limpo para este dia.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Eventos / Reuniões */}
                  {selectedDateEvents.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">Compromissos</h3>
                      <div className="space-y-3">
                        {selectedDateEvents.map((event) => (
                          <div 
                            key={event.id}
                            className="group flex gap-4 p-4 rounded-xl border border-border/50 bg-background/30 hover:bg-background/50 transition-all hover:shadow-sm"
                          >
                            <div className="flex flex-col items-center justify-center min-w-[64px] border-r border-border/50 pr-4">
                              <span className="text-sm font-bold text-foreground">
                                {format(parseISO(event.start_time), "HH:mm")}
                              </span>
                              <Clock className="w-3 h-3 text-muted-foreground mt-1" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {event.title}
                              </h4>
                              {event.location && (
                                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-primary/50" />
                                  {event.location}
                                </p>
                              )}
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic border-l-2 border-primary/20 pl-3">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tarefas */}
                  {selectedDateTasks.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">Pendências para hoje</h3>
                      <div className="space-y-3">
                        {selectedDateTasks.map((task) => (
                          <div 
                            key={task.id}
                            className={cn(
                              "group relative flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-background/30 hover:bg-background/50 transition-all",
                              task.status === 'concluido' && "opacity-60"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  task.status === 'concluido' ? "bg-green-500/10" : 
                                  task.priority === 'alta' ? "bg-red-500/10" : "bg-primary/10"
                                )}>
                                  {task.status === 'concluido' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : task.priority === 'alta' ? (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <Timer className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <div>
                                  <h4 className={cn(
                                    "font-semibold text-foreground",
                                    task.status === 'concluido' && "line-through text-muted-foreground"
                                  )}>
                                    {task.title}
                                  </h4>
                                  {task.projects && (
                                    <span className="text-[10px] uppercase font-bold text-primary/70">
                                      {task.projects.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant={
                                task.priority === 'alta' ? 'destructive' : 
                                task.priority === 'media' ? 'secondary' : 'outline'
                              } className="text-[9px] uppercase tracking-tighter h-5">
                                {task.priority}
                              </Badge>
                            </div>
                            
                            {task.description && (
                              <p className="text-sm text-muted-foreground pl-11">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 pl-11 mt-1">
                              <Badge variant="outline" className="text-[9px] font-medium bg-background/50 border-border/50">
                                {task.status.replace('_', ' ')}
                              </Badge>
                              {task.responsible && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <span className="opacity-60">Resp:</span>
                                  <span className="text-foreground font-medium">{task.responsible}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
