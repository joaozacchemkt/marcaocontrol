import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Timer, MapPin, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function CalendarAgenda() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/30 p-4 rounded-2xl border border-border/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Maximize2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Ajuste de Visualização</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Ampliar ou reduzir elementos da agenda</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-64">
          <span className="text-[10px] font-black text-muted-foreground uppercase">{Math.round(zoomLevel * 100)}%</span>
          <Slider 
            value={[zoomLevel]} 
            min={0.8} 
            max={1.4} 
            step={0.05} 
            onValueChange={([val]) => setZoomLevel(val)}
            className="flex-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden transition-all duration-300">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Navegação
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
                booked: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full relative font-bold text-primary"
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Pendências</span>
              </div>
              <span className="text-sm font-bold">{tasks?.length || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Eventos</span>
              </div>
              <span className="text-sm font-bold">{events?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm flex flex-col min-h-[600px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6 bg-muted/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] uppercase tracking-tighter bg-primary/5 border-primary/20 text-primary">
                  {date ? format(date, "MMMM yyyy", { locale: ptBR }) : ""}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight">
                {date ? format(date, "EEEE, dd", { locale: ptBR }) : "Selecione um dia"}
              </CardTitle>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-primary/20 leading-none">
                {selectedDateTasks.length + selectedDateEvents.length}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Atividades</p>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[550px]">
              <div className="p-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-60 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando...</p>
                  </div>
                ) : selectedDateTasks.length === 0 && selectedDateEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                      <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground/80">Agenda Livre</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px] mx-auto mt-2">
                      Não há compromissos ou prazos registrados para este dia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* Compromissos */}
                    {selectedDateEvents.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="h-px flex-1 bg-border/50" />
                          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] px-4 py-1 rounded-full border border-primary/20 bg-primary/5">Compromissos</h3>
                          <div className="h-px flex-1 bg-border/50" />
                        </div>
                        <div className="space-y-4">
                          {selectedDateEvents.map((event) => (
                            <div 
                              key={event.id}
                              className="group grid grid-cols-[80px_1fr] gap-6 p-5 rounded-2xl border border-border/50 bg-background/40 hover:bg-background/80 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                              <div className="flex flex-col items-center justify-center border-r border-border/50 pr-6">
                                <span className="text-lg font-black text-foreground group-hover:text-primary transition-colors">
                                  {format(parseISO(event.start_time), "HH:mm")}
                                </span>
                                <Clock className="w-3 h-3 text-muted-foreground mt-1 opacity-50" />
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                                  {event.title}
                                </h4>
                                {(event.location || event.description) && (
                                  <div className="space-y-2 mt-2">
                                    {event.location && (
                                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-primary/60" />
                                        {event.location}
                                      </p>
                                    )}
                                    {event.description && (
                                      <p className="text-sm text-muted-foreground/80 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                                        {event.description}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pendências */}
                    {selectedDateTasks.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="h-px flex-1 bg-border/50" />
                          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] px-4 py-1 rounded-full border border-primary/20 bg-primary/5">Prazos de Entrega</h3>
                          <div className="h-px flex-1 bg-border/50" />
                        </div>
                        <div className="space-y-4">
                          {selectedDateTasks.map((task) => (
                            <div 
                              key={task.id}
                              className={cn(
                                "group relative flex flex-col gap-4 p-5 rounded-2xl border border-border/50 bg-background/40 hover:bg-background/80 transition-all duration-300 hover:shadow-xl",
                                task.status === 'concluido' && "opacity-50 grayscale-[0.5]"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110",
                                    task.status === 'concluido' ? "bg-green-500/10" : 
                                    task.priority === 'alta' ? "bg-red-500/10" : "bg-primary/10"
                                  )}>
                                    {task.status === 'concluido' ? (
                                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    ) : task.priority === 'alta' ? (
                                      <AlertCircle className="w-6 h-6 text-red-500" />
                                    ) : (
                                      <Timer className="w-6 h-6 text-primary" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className={cn(
                                      "text-lg font-bold text-foreground leading-tight",
                                      task.status === 'concluido' && "line-through text-muted-foreground"
                                    )}>
                                      {task.title}
                                    </h4>
                                    {task.projects && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-2 py-0">
                                          {task.projects.name}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge variant={
                                    task.priority === 'alta' ? 'destructive' : 
                                    task.priority === 'media' ? 'secondary' : 'outline'
                                  } className="text-[9px] font-black uppercase tracking-widest px-2 shadow-sm">
                                    {task.priority}
                                  </Badge>
                                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                    {task.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                              
                              {task.description && (
                                <div className="pl-16">
                                  <p className="text-sm text-muted-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/30">
                                    {task.description}
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center justify-between pl-16 pt-2 border-t border-border/30">
                                {task.responsible ? (
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-muted-foreground font-medium uppercase tracking-tighter opacity-60">Responsável:</span>
                                    <span className="text-foreground font-black group-hover:text-primary transition-colors">{task.responsible}</span>
                                  </div>
                                ) : <div />}
                                
                                {task.waiting_for && (
                                  <Badge variant="outline" className="text-[9px] bg-amber-500/5 text-amber-600 border-amber-500/20 font-bold italic">
                                    Aguardando: {task.waiting_for}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          
          <div className="p-4 bg-muted/20 border-t border-border/50 text-center">
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Marcão Control v2.1 • Inteligência em Gestão</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
