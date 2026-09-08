import type { QueryClient } from "@tanstack/react-query";

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
  ["reminders-all"], // página /lembretes
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
