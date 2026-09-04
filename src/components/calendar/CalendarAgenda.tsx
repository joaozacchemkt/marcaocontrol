import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MonthGrid, type DayCounts } from "@/components/calendar/MonthGrid";
import { DayDetailsPanel } from "@/components/calendar/DayDetailsPanel";
import { EventModal } from "@/components/modals/EventModal";
import { TaskModal } from "@/components/modals/TaskModal";
import { isSameDay, parseISO, startOfMonth } from "date-fns";
import { Loader2, Settings2, PanelRightOpen } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";

const LAYOUT_KEY = "agenda:panel-layout";
const DENSITY_KEY = "agenda:density";
const COLLAPSED_KEY = "agenda:panel-collapsed";

type Density = "compact" | "comfortable" | "spacious";

export function CalendarAgenda() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [density, setDensity] = useState<Density>("comfortable");
  const [collapsed, setCollapsed] = useState(false);
  const [layout, setLayout] = useState<Record<string, number> | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  // Preferências locais (persistência via localStorage)
  useEffect(() => {
    try {
      const rawLayout = window.localStorage.getItem(LAYOUT_KEY);
      if (rawLayout) {
        const parsed = JSON.parse(rawLayout);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setLayout(parsed as Record<string, number>);
        }
      }
      const savedDensity = window.localStorage.getItem(DENSITY_KEY) as Density | null;
      if (savedDensity === "compact" || savedDensity === "comfortable" || savedDensity === "spacious") {
        setDensity(savedDensity);
      }
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {
      /* preferências indisponíveis: mantém padrões */
    }
    setHydrated(true);
  }, []);

  const persistLayout = (sizes: Record<string, number>) => {
    setLayout(sizes);
    try {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(sizes));
    } catch {
      /* ignora falha de storage */
    }
  };

  const updateDensity = (value: Density) => {
    setDensity(value);
    try {
      window.localStorage.setItem(DENSITY_KEY, value);
    } catch {
      /* ignora falha de storage */
    }
  };

  const updateCollapsed = (value: boolean) => {
    setCollapsed(value);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(value));
    } catch {
      /* ignora falha de storage */
    }
  };

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name)")
        .not("deadline", "is", null)
        .order("deadline", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: academicExams } = useQuery({
    queryKey: ["academic-exams-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_exams")
        .select("*, academic_subjects(name)")
        .order("date", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: academicAssignments } = useQuery({
    queryKey: ["academic-assignments-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_assignments")
        .select("*, academic_subjects(name)")
        .not("deadline", "is", null)
        .order("deadline", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["events-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: finances } = useQuery({
    queryKey: ["finances-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .not("due_date", "is", null);

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isLoading = tasksLoading || eventsLoading;

  const selectedDateTasks =
    tasks?.filter((task) => task.deadline && isSameDay(parseLocalDate(task.deadline)!, date || new Date())) || [];

  const selectedDateExams =
    academicExams?.filter((exam) => exam.date && isSameDay(parseLocalDate(exam.date)!, date || new Date())) || [];

  const selectedDateAssignments =
    academicAssignments?.filter((a) => a.deadline && isSameDay(parseLocalDate(a.deadline)!, date || new Date())) || [];

  const selectedDateEvents =
    events?.filter((event) => isSameDay(parseISO(event.start_time), date || new Date())) || [];
  const selectedDateFinances =
    finances?.filter((t) => t.due_date && isSameDay(parseLocalDate(t.due_date)!, date || new Date())) || [];

  const getCounts = (day: Date): DayCounts => ({
    events: events?.filter((e) => isSameDay(parseISO(e.start_time), day)).length || 0,
    tasks: (tasks?.filter((t) => t.deadline && isSameDay(parseLocalDate(t.deadline)!, day)).length || 0) +
           (academicExams?.filter((e) => e.date && isSameDay(parseLocalDate(e.date)!, day)).length || 0) +
           (academicAssignments?.filter((a) => a.deadline && isSameDay(parseLocalDate(a.deadline)!, day)).length || 0),
    finances: finances?.filter((t) => t.due_date && isSameDay(parseLocalDate(t.due_date)!, day)).length || 0,
  });

  const settings = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ajustes de visualização">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Densidade da grade
        </Label>
        <div className="grid grid-cols-3 gap-1">
          {(["compact", "comfortable", "spacious"] as Density[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={density === option ? "default" : "outline"}
              className="h-7 text-[10px] font-bold"
              onClick={() => updateDensity(option)}
            >
              {option === "compact" ? "Compacto" : option === "comfortable" ? "Médio" : "Amplo"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full text-[10px] font-bold"
          onClick={() => updateCollapsed(!collapsed)}
        >
          {collapsed ? "Mostrar painel do dia" : "Recolher painel do dia"}
        </Button>
      </PopoverContent>
    </Popover>
  );

  const calendarCard = (
    <Card className={cn("h-full min-w-0 border-border/50 bg-card/50 p-4 backdrop-blur-sm", isMobile && "p-3")}>
      {isLoading ? (
        <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary opacity-40" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Sincronizando...
          </p>
        </div>
      ) : (
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setMonth(startOfMonth(d));
          }}
          getCounts={getCounts}
          density={isMobile ? "compact" : density}
        />
      )}
    </Card>
  );

  const detailsCard = (
    <Card className="h-full min-w-0 overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <DayDetailsPanel
        date={date}
        events={selectedDateEvents}
        tasks={[
          ...selectedDateTasks,
          ...selectedDateExams.map(e => ({ ...e, title: `PROVA: ${e.title}`, deadline: e.date, priority: 'alta', projects: { name: (e as any).academic_subjects?.name } })),
          ...selectedDateAssignments.map(a => ({ ...a, title: `TRABALHO: ${a.title}`, projects: { name: (a as any).academic_subjects?.name } }))
        ]}
        finances={selectedDateFinances}
        onAddEvent={() => setEventModal(true)}
        onAddTask={() => setTaskModal(true)}
        onEditEvent={(event) => setEditingEvent(event)}
        onDeleteEvent={async (event) => {
          const { error } = await supabase.from("events").delete().eq("id", event.id);
          if (error) {
            toast.error("Erro ao excluir compromisso: " + error.message);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["events-calendar"] });
          toast.success("Compromisso excluído.");
        }}
        onToggleTask={async (task) => {
          const nextStatus = task.status === "concluido" ? "a_fazer" : "concluido";
          const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
          if (error) {
            toast.error("Erro ao atualizar pendência: " + error.message);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["tasks-calendar"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast.success(nextStatus === "concluido" ? "Pendência concluída." : "Pendência reaberta.");
        }}
        onCollapse={isMobile ? undefined : () => updateCollapsed(true)}
      />
    </Card>
  );

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-end gap-1">
        {collapsed && !isMobile && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] font-bold uppercase"
            onClick={() => updateCollapsed(false)}
          >
            <PanelRightOpen className="mr-1 h-3.5 w-3.5" /> Painel do dia
          </Button>
        )}
        {settings}
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {calendarCard}
          <div className="min-h-[320px]">{detailsCard}</div>
        </div>
      ) : collapsed ? (
        <div className="h-[calc(100vh-14rem)] min-h-[560px]">{calendarCard}</div>
      ) : hydrated ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-[calc(100vh-14rem)] min-h-[560px]"
          {...(layout ? { defaultLayout: layout } : {})}
          onLayoutChanged={persistLayout}
        >
          <ResizablePanel id="agenda-calendar" defaultSize="70" minSize="55" maxSize="85" className="pr-2">
            {calendarCard}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="mx-1 w-1.5 rounded-full bg-border/60 transition-colors hover:bg-primary/50"
          />
          <ResizablePanel id="agenda-details" defaultSize="30" minSize="15" maxSize="45" className="pl-2">
            {detailsCard}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="h-[calc(100vh-14rem)] min-h-[560px]">{calendarCard}</div>
      )}

      <EventModal open={eventModal} onOpenChange={setEventModal} />
      <EventModal
        open={editingEvent !== null}
        onOpenChange={(open) => !open && setEditingEvent(null)}
        event={editingEvent}
      />
      <TaskModal open={taskModal} onOpenChange={setTaskModal} />
    </div>
  );
}
