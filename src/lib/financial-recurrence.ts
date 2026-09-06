import { addDays, addMonths, addWeeks, format, getDaysInMonth, setDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/dates";

export type FinancialFrequency =
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export const FINANCIAL_FREQUENCY_LABELS: Record<FinancialFrequency, string> = {
  semanal: "Toda semana",
  quinzenal: "A cada 2 semanas",
  mensal: "Todo mês",
  bimestral: "A cada 2 meses",
  trimestral: "A cada 3 meses",
  semestral: "A cada 6 meses",
  anual: "Todo ano",
};

/** Passo em meses por frequência (0 = usa semanas/dias). */
const MONTH_STEP: Record<FinancialFrequency, number> = {
  semanal: 0,
  quinzenal: 0,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Peso mensal aproximado de 1 ocorrência (para somar o "compromisso fixo"). */
export const MONTHLY_FACTOR: Record<FinancialFrequency, number> = {
  semanal: 4.345,
  quinzenal: 2.17,
  mensal: 1,
  bimestral: 0.5,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

/**
 * Próxima ocorrência a partir de `from`. `anchorDay` (dia do mês na
 * `start_date` da regra) evita o drift: sem ele, um boleto dia 31 vira 28
 * em fevereiro e nunca mais volta pro fim do mês.
 */
export function nextFinancialOccurrence(
  from: Date,
  frequency: FinancialFrequency,
  intervalCount = 1,
  anchorDay?: number,
): Date {
  const step = Math.max(1, Number.isFinite(intervalCount) ? intervalCount : 1);
  if (frequency === "semanal") return addWeeks(from, step);
  if (frequency === "quinzenal") return addDays(from, 14 * step);

  let next = addMonths(from, MONTH_STEP[frequency] * step);
  if (anchorDay) {
    next = setDate(next, Math.min(anchorDay, getDaysInMonth(next)));
  }
  return next;
}

interface RecurrenceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  contact_id: string | null;
  description: string;
  type: "receita" | "despesa";
  amount: number;
  category: string | null;
  frequency: FinancialFrequency;
  interval_count: number;
  start_date: string;
  next_run: string;
  end_date: string | null;
  active: boolean;
}

/** Já existe um lançamento dessa regra vencendo nessa data? (dedupe robusto) */
async function occurrenceExists(recurrenceId: string, dueDate: string): Promise<boolean> {
  const { data } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("financial_recurrence_id", recurrenceId)
    .eq("due_date", dueDate)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Ao quitar um lançamento recorrente, gera a(s) próxima(s) ocorrência(s)
 * pendente(s) e avança a régua (`next_run`).
 *
 * - Idempotente: nunca duplica um lançamento já existente para a mesma data
 *   (protege contra duplo clique).
 * - Re-quitar um lançamento antigo (reabrir → marcar pago de novo) não gera
 *   nada: se `paidOccurrenceDate` é anterior ao `next_run`, a régua já passou
 *   por ele.
 * - Catch-up: se a regra ficou para trás (usuário sumiu 3 meses), avança em
 *   laço até alcançar hoje, com teto de 24 ciclos.
 */
export async function advanceFinancialRecurrence(
  recurrenceId: string,
  paidOccurrenceDate?: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("financial_recurrences")
      .select("*")
      .eq("id", recurrenceId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[recorrência financeira] falha ao ler regra:", error.message);
      return;
    }

    const rec = data as unknown as RecurrenceRow;
    if (!rec.active) return;

    // Re-quitação de uma ocorrência que a régua já ultrapassou: não faz nada.
    if (paidOccurrenceDate && paidOccurrenceDate < rec.next_run) return;

    const end = rec.end_date ? parseLocalDate(rec.end_date) : null;
    const today = format(new Date(), "yyyy-MM-dd");

    let cursor = parseLocalDate(rec.next_run) ?? new Date();
    let cursorStr = format(cursor, "yyyy-MM-dd");
    let lastGenerated = "";

    for (let i = 0; i < 24; i++) {
      const anchorDay = cursor.getDate();
      const next = nextFinancialOccurrence(cursor, rec.frequency, rec.interval_count, anchorDay);
      const nextStr = format(next, "yyyy-MM-dd");

      if (end && next > end) {
        await supabase.from("financial_recurrences").update({ active: false }).eq("id", rec.id);
        break;
      }

      if (!(await occurrenceExists(rec.id, nextStr))) {
        const { error: insErr } = await supabase.from("financial_transactions").insert({
          user_id: rec.user_id,
          project_id: rec.project_id,
          contact_id: rec.contact_id,
          description: rec.description,
          type: rec.type,
          amount: rec.amount,
          category: rec.category,
          date: nextStr,
          due_date: nextStr,
          status: "pendente",
          financial_recurrence_id: rec.id,
        } as never);
        if (insErr) {
          console.warn("[recorrência financeira] falha ao gerar lançamento:", insErr.message);
          break;
        }
      }

      lastGenerated = nextStr;
      cursor = next;
      cursorStr = nextStr;
      // Parou de estar atrasado — a próxima ocorrência já é futura.
      if (cursorStr > today) break;
    }

    if (lastGenerated && lastGenerated > rec.next_run) {
      await supabase
        .from("financial_recurrences")
        .update({ next_run: lastGenerated })
        .eq("id", rec.id);
    }
  } catch (e) {
    console.warn("[recorrência financeira] erro inesperado:", e);
  }
}
