import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dates";
import { Target, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface EstudarAgoraProps {
  projectId?: string;
}

export function EstudarAgora({ projectId }: EstudarAgoraProps) {
  const { data: exams = [] } = useQuery({
    queryKey: ['academic-exams-now', projectId],
    queryFn: async () => {
      let query = supabase.from('academic_exams').select('*, academic_subjects(name, project_id)');
      if (projectId) {
        // Se temos um projeto específico, filtramos por ele
        // Mas como academic_exams não tem project_id direto (tem via subject), filtramos no JS se necessário
        // ou usamos .eq('academic_subjects.project_id', projectId) se o supabase suportar esse join filter
      }
      const { data } = await query;
      
      let filtered = (data as any[] || []);
      if (projectId) {
        filtered = filtered.filter(e => e.academic_subjects?.project_id === projectId);
      }
      return filtered;
    }
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['academic-assignments-now', projectId],
    queryFn: async () => {
      let query = supabase.from('academic_assignments').select('*, academic_subjects(name, project_id)');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data } = await query;
      return (data as any[] || []);
    }
  });

  const sortedItems = [
    ...exams.filter(e => e.status !== 'corrigida').map(e => {
      const date = parseLocalDate(e.date)!;
      const isOverdue = isPast(date) && !isToday(date);
      const diff = differenceInDays(date, new Date());
      const isSoon = !isOverdue && diff <= 3;
      
      return {
        id: e.id,
        title: e.title,
        subject: e.academic_subjects?.name || 'Geral',
        projectId: e.academic_subjects?.project_id ?? projectId ?? null,
        type: 'Prova',
        deadline: e.date,
        urgency: isOverdue ? 'Atrasada' : (isSoon ? 'Urgente' : 'Próxima'),
        reason: isOverdue ? 'Prazo vencido' : (diff === 0 ? 'HOJE' : `Em ${diff} dias`),
        priority: isOverdue ? 1 : (isSoon ? 2 : 3)
      };
    }),
    ...assignments.filter(a => a.status !== 'corrigido').map(a => {
      if (!a.deadline) return null;
      const date = parseLocalDate(a.deadline)!;
      const isOverdue = isPast(date) && !isToday(date);
      const diff = differenceInDays(date, new Date());
      const isSoon = !isOverdue && diff <= 3;

      return {
        id: a.id,
        title: a.title,
        subject: a.academic_subjects?.name || 'Geral',
        projectId: a.project_id ?? a.academic_subjects?.project_id ?? projectId ?? null,
        type: 'Trabalho',
        deadline: a.deadline,
        urgency: isOverdue ? 'Atrasado' : (isSoon ? 'Urgente' : 'Próximo'),
        reason: isOverdue ? 'Prazo vencido' : (diff === 0 ? 'HOJE' : `Entrega em ${diff} dias`),
        priority: isOverdue ? 1 : (isSoon ? 2 : 4)
      };
    })
  ].filter(Boolean) as any[];

  const prioritized = sortedItems
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return parseLocalDate(a.deadline)!.getTime() - parseLocalDate(b.deadline)!.getTime();
    })
    .slice(0, 5);

  if (prioritized.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Estudar Agora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prioritized.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-all group">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={item.priority === 1 ? "destructive" : (item.priority === 2 ? "default" : "secondary")} className="text-[9px] uppercase h-4">
                  {item.type}
                </Badge>
                <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{item.title}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                <span>{item.subject}</span>
                <span>•</span>
                <span className={item.priority === 1 ? "text-destructive" : "text-primary"}>{item.reason}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <div className="text-right mr-3 hidden md:block">
                  <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Prazo</p>
                  <p className="text-xs font-bold">{format(parseLocalDate(item.deadline)!, "dd/MM")}</p>
               </div>
               {item.projectId ? (
                 <Button asChild size="sm" variant="outline" className="h-8 text-xs px-3">
                   <Link to="/projetos/$projectId" params={{ projectId: item.projectId }}>Abrir</Link>
                 </Button>
               ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

