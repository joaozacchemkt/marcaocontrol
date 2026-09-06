import { addDays, addMonths, addWeeks, format } from "date-fns";
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
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
  bimestral: "A cada 2 meses",
  trimestral: "A cada 3 meses",
  semestral: "A cada 6 meses",
  anual: "Todo ano",
};

/** Passo do mês por frequência (0 = usa semanas/dias). */
const MONTH_STEP: Record<FinancialFrequency, number> = {
  semanal: 0,
  quinzenal: 0,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function nextFinancialOccurrence(
  from: Date,
  frequency: FinancialFrequency,
  intervalCount = 1,
): Date {
  const step = Math.max(1, Number.isFinite(intervalCount) ? intervalCount : 1);
  if (frequency === "semanal") return addWeeks(from, step);
  if (frequency === "quinzenal") return addDays(from, 14 * step);
  return addMonths(from, MONTH_STEP[frequency] * step);
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
  next_run: string;
  end_date: string | null;
  active: boolean;
}

/**
 * Ao quitar um lançamento recorrente, gera o próximo (pendente) e avança a
 * régua. Falhas são silenciosas — não devem travar o "marcar como pago".
 */
export async function advanceFinancialRecurrence(recurrenceId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("financial_recurrences")
      .select("*")
      .eq("id", recurrenceId)
      .maybeSingle();
    if (error || !data) return;

    const rec = data as unknown as RecurrenceRow;
    if (!rec.active) return;

    const base = parseLocalDate(rec.next_run) ?? new Date();
    const next = nextFinancialOccurrence(base, rec.frequency, rec.interval_count);

    if (rec.end_date) {
      const end = parseLocalDate(rec.end_date);
      if (end && next > end) {
        await supabase
          .from("financial_recurrences")
          .update({ active: false })
          .eq("id", rec.id);
        return;
      }
    }

    const nextStr = format(next, "yyyy-MM-dd");
    await supabase.from("financial_transactions").insert({
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

    await supabase
      .from("financial_recurrences")
      .update({ next_run: nextStr })
      .eq("id", rec.id);
  } catch {
    // acessório — nunca impede o fluxo principal
  }
}
