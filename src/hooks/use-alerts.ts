import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPast, isToday } from "date-fns";

export function useAlerts() {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').neq('status', 'concluido');
      return data || [];
    },
    refetchInterval: 1000 * 60 * 5, // 5 min
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['financial-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions').select('*').eq('status', 'pendente');
      return data || [];
    },
    refetchInterval: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (tasks.length === 0 && transactions.length === 0) return;

    const overdueTasks = tasks.filter(t => t.deadline && isPast(new Date(t.deadline)) && !isToday(new Date(t.deadline)));
    const todayTasks = tasks.filter(t => t.deadline && isToday(new Date(t.deadline)));
    const highPriorityToday = todayTasks.filter(t => t.priority === 'alta');
    
    const overdueTransactions = transactions.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const todayTransactions = transactions.filter(t => t.due_date && isToday(new Date(t.due_date)));
    const todayPayments = todayTransactions.filter(t => t.type === 'despesa');
    const todayRevenues = todayTransactions.filter(t => t.type === 'receita');

    const alerts = [];

    if (overdueTasks.length > 0) {
      alerts.push(`Você possui ${overdueTasks.length} ${overdueTasks.length === 1 ? 'pendência atrasada' : 'pendências atrasadas'}.`);
    }

    if (highPriorityToday.length > 0) {
      alerts.push(`${highPriorityToday.length} ${highPriorityToday.length === 1 ? 'tarefa de alta prioridade vence' : 'tarefas de alta prioridade vencem'} hoje.`);
    }

    if (todayPayments.length > 0) {
      alerts.push(`Há ${todayPayments.length} ${todayPayments.length === 1 ? 'pagamento previsto' : 'pagamentos previstos'} para hoje.`);
    }

    if (alerts.length > 0) {
      // Agrupar em uma única notificação ou mostrar em sequência curta
      alerts.forEach((msg, index) => {
        setTimeout(() => {
          toast.info(msg, {
            duration: 5000,
          });
        }, index * 1000);
      });
    }
  }, [tasks, transactions]);
}
