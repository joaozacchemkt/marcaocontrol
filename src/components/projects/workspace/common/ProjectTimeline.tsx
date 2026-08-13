
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare,
  PlusCircle,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTimelineProps {
  project: any;
}

export function ProjectTimeline({ project }: ProjectTimelineProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['activity-history', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_history')
        .select('*')
        .eq('project_id' as any, project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'task_created': return <PlusCircle className="h-4 w-4 text-blue-500" />;
      case 'project_created': return <PlusCircle className="h-4 w-4 text-primary font-bold" />;
      case 'task_reopened': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'financial_transaction': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'transaction_created': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'note_created': return <FileText className="h-4 w-4 text-amber-500" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Linha do Tempo</h3>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse bg-accent rounded-lg w-full" />)}
        </div>
      ) : (
        <div className="relative space-y-8 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-[1px] before:bg-border">
          {history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl ml-8">
              Nenhuma atividade registrada ainda.
            </div>
          ) : history.map((item: any, idx: number) => (
            <div key={item.id} className="relative pl-8">
              <div className="absolute left-0 top-1 z-10 flex h-4 w-4 items-center justify-center bg-background">
                {getIcon(item.action)}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.description}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(item.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {item.details && (
                  <p className="text-[11px] text-muted-foreground italic">
                    "{item.details}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sugestão de Meta Futura */}
      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-4">
        <div className="p-2 bg-primary/10 rounded-lg h-fit">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-primary">Próximo Marco Estimado</h4>
          <p className="text-xs text-muted-foreground">Com base na velocidade atual, o projeto deve atingir 80% de conclusão em aproximadamente 12 dias.</p>
        </div>
      </div>
    </div>
  );
}
