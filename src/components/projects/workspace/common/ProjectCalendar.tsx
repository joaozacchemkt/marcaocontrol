
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";

interface ProjectCalendarProps {
  project: any;
}

export function ProjectCalendar({ project }: ProjectCalendarProps) {
  // Nota: CalendarAgenda global já tem filtragem, mas idealmente passaríamos o projectId 
  // para o componente de calendário filtrar especificamente as tarefas/eventos deste projeto.
  // Por ora, mantemos o visual consistente.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Agenda do Projeto</h3>
      </div>
      <div className="bg-card border rounded-xl overflow-hidden h-[700px]">
        <CalendarAgenda />
      </div>
    </div>
  );
}
