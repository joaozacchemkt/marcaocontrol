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

/**
 * Ao quitar um lançamento recorrente, gera o próximo (pendente) e avança a
 * régua. Idempotente: se já existe um lançamento dessa regra para a próxima
 * data, não duplica (protege contra duplo clique / re-quitar).
 */
export async function advanceFinancialRecurrence(recurrenceId: string): Promise<void> {
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

    const base = parseLocalDate(rec.next_run) ?? new Date();
    const anchorDay = (parseLocalDate(rec.start_date) ?? base).getDate();
    const next = nextFinancialOccurrence(base, rec.frequency, rec.interval_count, anchorDay);
    const nextStr = format(next, "yyyy-MM-dd");

    if (rec.end_date) {
      const end = parseLocalDate(rec.end_date);
      if (end && next > end) {
        await supabase.from("financial_recurrences").update({ active: false }).eq("id", rec.id);
        return;
      }
    }

    // Idempotência: já existe lançamento dessa regra vencendo nessa data?
    const { data: dupe } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("financial_recurrence_id", rec.id)
      .eq("due_date", nextStr)
      .maybeSingle();

    if (!dupe) {
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
        console.warn("[recorrência financeira] falha ao gerar próximo lançamento:", insErr.message);
        return;
      }
    }

    if (nextStr > rec.next_run) {
      await supabase
        .from("financial_recurrences")
        .update({ next_run: nextStr })
        .eq("id", rec.id);
    }
  } catch (e) {
    console.warn("[recorrência financeira] erro inesperado:", e);
  }
}
