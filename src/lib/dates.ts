/**
 * Utilitário central para "datas de calendário" — prazos, vencimentos,
 * datas de prova — campos que representam um dia, não um instante.
 *
 * O Supabase devolve esses campos de duas formas: "YYYY-MM-DD" (colunas
 * `date`, ex.: financial_transactions.due_date) ou
 * "YYYY-MM-DDT00:00:00+00:00" (colunas `timestamptz` usadas só para guardar
 * um dia, sem hora real, ex.: tasks.deadline). Em qualquer um dos dois
 * formatos, `new Date(valor)` nativo do JS lê o horário como meia-noite em
 * UTC. Em fusos negativos (Brasília, UTC-3) isso cai no dia anterior às 21h —
 * a data "anda" um dia para trás em toda tela que formata ou compara esse
 * valor, e uma tarefa que vence hoje pode aparecer como atrasada desde a
 * noite anterior.
 *
 * `parseLocalDate` pega só o prefixo "YYYY-MM-DD" (de qualquer um dos dois
 * formatos) e reconstrói a data à meia-noite no fuso local.
 *
 * Use para: tasks.deadline, projects.deadline / start_date,
 * financial_transactions.date / due_date, academic_exams.date,
 * academic_assignments.deadline, workspace_items.due_date.
 *
 * NÃO use para instantes reais que carregam hora (events.start_time /
 * end_time, created_at, updated_at) — esses continuam com `new Date()`.
 */
export function parseLocalDate(value: string): Date;
export function parseLocalDate(value: string | null | undefined): Date | null;
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const ymd = value.slice(0, 10);
  const date = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
