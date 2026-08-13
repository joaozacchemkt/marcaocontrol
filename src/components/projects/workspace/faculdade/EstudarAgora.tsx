import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday, addDays, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, FileText, ClipboardList, Target, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EstudarAgoraProps {
  projectId: string;
}

export function EstudarAgora({ projectId }: EstudarAgoraProps) {
  const { data: subjects = [] } = useQuery({
    queryKey: ['academic-subjects', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_subjects').select('id, name').eq('project_id', projectId);
      return data || [];
    }
  });

  const { data: exams = [] } = useQuery({
    queryKey: ['academic-exams-now', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_exams').select('*, academic_subjects(name, project_id)');
      // Filter manually by subject's project_id if project_id is not directly on exam
      return (data as any[] || []).filter(e => e.academic_subjects?.project_id === projectId || e.project_id === projectId);
    },
    enabled: subjects.length > 0
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['academic-assignments-now', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_assignments').select('*, academic_subjects(name)');
      return (data as any[] || []).filter(a => a.project_id === projectId);
    }
  });

  const sortedItems = [
    ...exams.filter(e => e.status !== 'corrigida').map(e => {
      const date = new Date(e.date);
      const isOverdue = isPast(date) && !isToday(date);
      const isSoon = !isOverdue && differenceInDays(date, new Date()) <= 3;
      
      return {
        id: e.id,
        title: e.title,
        subject: e.academic_subjects?.name || 'Geral',
        type: 'Prova',
        deadline: e.date,
        urgency: isOverdue ? 'Atrasada' : (isSoon ? 'Urgente' : 'Próxima'),
        reason: isOverdue ? 'Prazo vencido' : `Em ${differenceInDays(date, new Date())} dias`,
        priority: isOverdue ? 1 : (isSoon ? 2 : 3)
      };
    }),
    ...assignments.filter(a => a.status !== 'corrigido').map(a => {
      if (!a.deadline) return null;
      const date = new Date(a.deadline);
      const isOverdue = isPast(date) && !isToday(date);
      const isSoon = !isOverdue && differenceInDays(date, new Date()) <= 3;

      return {
        id: a.id,
        title: a.title,
        subject: a.academic_subjects?.name || 'Geral',
        type: 'Trabalho',
        deadline: a.deadline,
        urgency: isOverdue ? 'Atrasado' : (isSoon ? 'Urgente' : 'Próximo'),
        reason: isOverdue ? 'Prazo vencido' : `Entrega em ${differenceInDays(date, new Date())} dias`,
        priority: isOverdue ? 1 : (isSoon ? 2 : 4)
      };
    })
  ].filter(Boolean) as any[];

  const prioritized = sortedItems
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
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
                <span className={cn(item.priority === 1 ? "text-destructive" : "text-primary")}>{item.reason}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <div className="text-right mr-3 hidden md:block">
                  <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Prazo</p>
                  <p className="text-xs font-bold">{format(new Date(item.deadline), "dd/MM")}</p>
               </div>
               <Button size="sm" variant="outline" className="h-8 text-xs px-3">Abrir</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function differenceInDays(date1: Date, date2: Date) {
  const diffTime = date1.getTime() - date2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
