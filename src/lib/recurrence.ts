import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type Frequency =
  | "diario"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "anual"
  | "personalizado";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
  personalizado: "Personalizado (em dias)",
};

/**
 * Calcula a próxima ocorrência a partir de uma data base.
 * `intervalCount` multiplica o passo (e define os dias no modo personalizado).
 */
export function nextOccurrence(
  from: Date,
  frequency: Frequency,
  intervalCount = 1,
): Date {
  const step = Math.max(1, Number.isFinite(intervalCount) ? intervalCount : 1);

  switch (frequency) {
    case "diario":
      return addDays(from, step);
    case "semanal":
      return addWeeks(from, step);
    case "quinzenal":
      return addDays(from, 14 * step);
    case "mensal":
      return addMonths(from, step);
    case "anual":
      return addYears(from, step);
    case "personalizado":
      return addDays(from, step);
    default:
      return addDays(from, step);
  }
}

interface RecurrenceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  frequency: Frequency;
  interval_count: number;
  next_run: string;
  end_date: string | null;
  active: boolean;
}

/**
 * Ao concluir uma tarefa recorrente, gera a próxima ocorrência e avança a
 * régua da recorrência. Falhas são silenciosas para não travar a conclusão.
 */
export async function advanceRecurrence(recurrenceId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("task_recurrences" as never)
      .select("*")
      .eq("id", recurrenceId)
      .maybeSingle();

    if (error || !data) return;
    const rec = data as unknown as RecurrenceRow;
    if (!rec.active) return;

    const base = new Date(`${rec.next_run}T12:00:00`);
    const next = nextOccurrence(base, rec.frequency, rec.interval_count);

    if (rec.end_date && next > new Date(`${rec.end_date}T23:59:59`)) {
      await supabase
        .from("task_recurrences" as never)
        .update({ active: false } as never)
        .eq("id", rec.id);
      return;
    }

    await supabase.from("tasks").insert({
      user_id: rec.user_id,
      project_id: rec.project_id,
      title: rec.title,
      description: rec.description,
      deadline: next.toISOString(),
      status: "a_fazer",
      recurrence_id: rec.id,
    } as never);

    await supabase
      .from("task_recurrences" as never)
      .update({ next_run: format(next, "yyyy-MM-dd") } as never)
      .eq("id", rec.id);
  } catch {
    // Recorrência é acessória: nunca deve impedir a conclusão da tarefa.
  }
}
