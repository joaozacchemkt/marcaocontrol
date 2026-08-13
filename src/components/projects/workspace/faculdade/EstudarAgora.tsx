import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, FileText, ClipboardList, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EstudarAgoraProps {
  projectId: string;
}

export function EstudarAgora({ projectId }: EstudarAgoraProps) {
  const { data: exams = [] } = useQuery({
    queryKey: ['academic-exams', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_exams').select('*').eq('project_id', projectId);
      return data || [];
    }
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['academic-assignments', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_assignments').select('*').eq('project_id', projectId);
      return data || [];
    }
  });

  const now = new Date();
  const items = [
    ...exams.filter(e => e.status !== 'corrigida').map(e => ({
      ...e,
      type: 'Prova',
      urgency: isPast(new Date(e.date)) ? 'Atrasada' : 'Próxima',
      deadline: e.date,
      title: e.title
    })),
    ...assignments.filter(a => a.status !== 'corrigido').map(a => ({
      ...a,
      type: 'Trabalho',
      urgency: isPast(new Date(a.deadline)) ? 'Atrasado' : 'Próximo',
      deadline: a.deadline,
      title: a.title
    }))
  ].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 5);

  if (items.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Estudar Agora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={item.urgency.includes('Atrasada') ? 'destructive' : 'secondary'} className="text-[10px]">
                  {item.type}
                </Badge>
                <span className="text-sm font-bold">{item.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {item.urgency} - {format(new Date(item.deadline), "dd/MM", { locale: ptBR })}
              </p>
            </div>
            <Button size="sm" variant="ghost">Abrir</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
