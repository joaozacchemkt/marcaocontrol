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
 * academic_assignments.deadline.
 *
 * NÃO use para instantes reais que carregam hora (events.start_time /
 * end_time, created_at, updated_at) — esses continuam com `new Date()`.
 *
 * Só devolve `null` para entrada vazia/nula. Uma string não vazia mas mal
 * formada (dado corrompido — não deveria acontecer, já que todo campo aqui
 * vem de um `<input type="date">` ou de uma coluna DATE/TIMESTAMPTZ do
 * Postgres, nunca de texto livre) vira um `Date` inválido, não `null`. É
 * proposital: a maioria dos call sites confia na sobrecarga `(value:
 * string) => Date` sem checar nulo, e o date-fns trata `null` como a
 * "época" (1970) — ou seja, sempre no passado — o que faria um dado ruim
 * aparecer como "sempre atrasado" silenciosamente. Um Date inválido, em
 * vez disso, faz isPast/isToday devolverem `false` (nem passado, nem
 * hoje) — o mesmo comportamento seguro que `new Date(string-ruim)` já
 * tinha antes deste util existir.
 */
export function parseLocalDate(value: string): Date;
export function parseLocalDate(value: string | null | undefined): Date | null;
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const ymd = value.slice(0, 10);
  return new Date(`${ymd}T00:00:00`);
}

/**
 * Mesma leitura de `parseLocalDate`, mas devolve o timestamp direto para
 * comparadores de `.sort()`. Um valor vazio ou inválido vira `NaN` — igual
 * ao que `new Date(string-inválida).getTime()` sempre devolveu — em vez de
 * lançar exceção, então um dado ruim só bagunça a ordenação, nunca derruba
 * a tela.
 */
export function localDateTime(value: string | null | undefined): number {
  return parseLocalDate(value)?.getTime() ?? NaN;
}
