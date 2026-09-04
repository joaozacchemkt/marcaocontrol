import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPast, isToday, addDays, differenceInDays } from "date-fns";
import { parseLocalDate } from "@/lib/dates";

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

  const { data: academicExams = [] } = useQuery({
    queryKey: ['academic-exams-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('academic_exams').select('*').neq('status', 'corrigida');
      return data || [];
    },
    refetchInterval: 1000 * 60 * 5,
  });

  const { data: academicAssignments = [] } = useQuery({
    queryKey: ['academic-assignments-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('academic_assignments').select('*').neq('status', 'corrigido');
      return data || [];
    },
    refetchInterval: 1000 * 60 * 5,
  });

  useEffect(() => {
    // Evitar notificações duplicadas na mesma sessão (simples flag)
    if ((window as any)._alertsShown) return;

    const overdueTasks = tasks.filter(t => t.deadline && isPast(parseLocalDate(t.deadline)!) && !isToday(parseLocalDate(t.deadline)!));
    const todayTasks = tasks.filter(t => t.deadline && isToday(parseLocalDate(t.deadline)!));
    const highPriorityToday = todayTasks.filter(t => t.priority === 'alta');

    const overdueTransactions = transactions.filter(t => t.due_date && isPast(parseLocalDate(t.due_date)!) && !isToday(parseLocalDate(t.due_date)!));
    const todayTransactions = transactions.filter(t => t.due_date && isToday(parseLocalDate(t.due_date)!));

    // Alertas Acadêmicos
    const examsSoon = academicExams.filter(e => {
      const date = parseLocalDate(e.date);
      if (!date) return false;
      const diff = differenceInDays(date, new Date());
      return diff >= 0 && diff <= 3;
    });

    const overdueAssignments = academicAssignments.filter(a => {
      const deadline = parseLocalDate(a.deadline);
      if (!deadline) return false;
      return isPast(deadline) && !isToday(deadline);
    });

    const todayExams = academicExams.filter(e => e.date && isToday(parseLocalDate(e.date)!));

    const alerts = [];

    // Prioridade Profissional/Geral
    if (overdueTasks.length > 0) {
      alerts.push(`Você possui ${overdueTasks.length} ${overdueTasks.length === 1 ? 'pendência atrasada' : 'pendências atrasadas'}.`);
    }

    if (highPriorityToday.length > 0) {
      alerts.push(`${highPriorityToday.length} ${highPriorityToday.length === 1 ? 'tarefa crítica vence' : 'tarefas críticas vencem'} hoje.`);
    }

    if (overdueTransactions.length > 0) {
      alerts.push(`${overdueTransactions.length} ${overdueTransactions.length === 1 ? 'pagamento está' : 'pagamentos estão'} em atraso.`);
    }

    // Alertas Acadêmicos Agrupados
    if (todayExams.length > 0) {
      alerts.push(`Há ${todayExams.length} ${todayExams.length === 1 ? 'prova marcada para' : 'provas marcadas para'} hoje!`);
    } else if (examsSoon.length > 0) {
      alerts.push(`Você possui ${examsSoon.length} ${examsSoon.length === 1 ? 'prova nos próximos 3 dias' : 'provas nos próximos 3 dias'}.`);
    }

    if (overdueAssignments.length > 0) {
      alerts.push(`${overdueAssignments.length} ${overdueAssignments.length === 1 ? 'trabalho acadêmico está atrasado' : 'trabalhos acadêmicos estão atrasados'}.`);
    }

    if (alerts.length > 0) {
      (window as any)._alertsShown = true;
      alerts.forEach((msg, index) => {
        setTimeout(() => {
          toast.info(msg, {
            duration: 6000,
          });
        }, index * 1500);
      });
    }
  }, [tasks, transactions, academicExams, academicAssignments]);
}

