import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nextOccurrence, type Frequency } from "@/lib/recurrence";

/**
 * Toda query que lê `reminders`. Uma única fonte de verdade para invalidar
 * depois de criar / concluir / editar / excluir um lembrete — assim nenhuma
 * tela fica com dado velho.
 *
 * As chaves são prefixos: `["board-reminders"]` casa com
 * `["board-reminders", projectId]`, `["task-reminder"]` com
 * `["task-reminder", taskId]`, etc. (match parcial padrão do TanStack Query).
 */
export const REMINDER_QUERY_KEYS: readonly (readonly string[])[] = [
  ["today-reminders"], // dashboard
  ["reminders-alerts"], // hook use-alerts
  ["board-reminders"], // sino nos cards do quadro
  ["task-reminder"], // painel de detalhe da tarefa
  ["reminders-all"], // página /lembretes — pendentes
  ["reminders-resolved"], // página /lembretes — resolvidos recentes
];

export function invalidateReminders(queryClient: QueryClient): void {
  for (const key of REMINDER_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: key as string[] });
  }
}

/** Junta data (yyyy-MM-dd) + hora (HH:mm) em um Date no fuso local. */
export function combineDateTime(date: string, time: string): Date {
  const t = /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  return new Date(`${date}T${t}:00`);
}

/** Frequências oferecidas para lembretes recorrentes (sem "personalizado" — não faz sentido aqui). */
export type ReminderFrequency = "diario" | "semanal" | "quinzenal" | "mensal" | "anual";

export const REMINDER_FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
};

interface RecurringReminderSource {
  id: string;
  user_id: string;
  project_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  notes: string | null;
  remind_at: string;
  channel: string;
  priority: string;
  category: string | null;
  recurrence_frequency: string | null;
  recurrence_interval: number;
  recurrence_end_date: string | null;
}

/**
 * Ao concluir um lembrete recorrente, gera a próxima ocorrência (mesma
 * lógica de src/lib/recurrence.ts, mas sem tabela separada: cada lembrete já
 * carrega os próprios dados de recorrência, então a ocorrência seguinte é só
 * uma cópia com `remind_at` avançado). Falha silenciosa — recorrência é
 * acessória e nunca deve travar a conclusão do lembrete.
 */
export async function advanceReminderRecurrence(reminder: RecurringReminderSource): Promise<void> {
  if (!reminder.recurrence_frequency) return;
  try {
    const from = new Date(reminder.remind_at);
    if (Number.isNaN(from.getTime())) return;

    const next = nextOccurrence(
      from,
      reminder.recurrence_frequency as Frequency,
      reminder.recurrence_interval,
    );

    if (reminder.recurrence_end_date && next > new Date(`${reminder.recurrence_end_date}T23:59:59`)) {
      return;
    }

    // Idempotência: se a próxima ocorrência já existe (duplo clique), não duplica.
    const { data: dupe } = await supabase
      .from("reminders")
      .select("id")
      .eq("title", reminder.title)
      .eq("remind_at", next.toISOString())
      .limit(1);
    if ((dupe?.length ?? 0) > 0) return;

    await supabase.from("reminders").insert({
      user_id: reminder.user_id,
      project_id: reminder.project_id,
      entity_type: reminder.entity_type,
      entity_id: reminder.entity_id,
      title: reminder.title,
      notes: reminder.notes,
      remind_at: next.toISOString(),
      channel: reminder.channel,
      priority: reminder.priority as "baixa" | "media" | "alta",
      category: reminder.category,
      status: "pendente",
      recurrence_frequency: reminder.recurrence_frequency,
      recurrence_interval: reminder.recurrence_interval,
      recurrence_end_date: reminder.recurrence_end_date,
    });
  } catch {
    // silencioso — ver comentário acima
  }
}
