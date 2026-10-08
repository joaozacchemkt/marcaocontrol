import { supabase } from "@/integrations/supabase/client";
import type { Db } from "@/lib/db";
import { todayLocalStr } from "@/lib/dates";
import { advanceFinancialRecurrence } from "@/lib/financial-recurrence";

interface PayableTransaction {
  id: string;
  due_date: string | null;
  financial_recurrence_id: string | null;
}

/**
 * Quita ou reabre um lançamento — regra única usada pela tela do Financeiro
 * e pelo assistente.
 * - Quitar: grava `paid_date` e gera a próxima ocorrência se for recorrente.
 * - Reabrir: limpa `paid_date` e desfaz a ocorrência futura que a quitação
 *   havia gerado, pra não ficar um lançamento fantasma "a pagar/receber".
 */
export async function setTransactionPaid(
  t: PayableTransaction,
  paid: boolean,
  opts: { db?: Db; paidDate?: string } = {},
): Promise<void> {
  const db = opts.db ?? supabase;
  const { error } = await db
    .from("financial_transactions")
    .update({
      status: paid ? "pago" : "pendente",
      paid_date: paid ? opts.paidDate || todayLocalStr() : null,
    })
    .eq("id", t.id);
  if (error) throw error;

  const dueStr = t.due_date ? String(t.due_date).slice(0, 10) : undefined;
  if (paid && t.financial_recurrence_id) {
    await advanceFinancialRecurrence(t.financial_recurrence_id, dueStr, db);
  }
  if (!paid && t.financial_recurrence_id && dueStr) {
    const { data: successors } = await db
      .from("financial_transactions")
      .select("id, due_date")
      .eq("financial_recurrence_id", t.financial_recurrence_id)
      .eq("status", "pendente")
      .gt("due_date", dueStr)
      .order("due_date", { ascending: true });
    const ids = (successors ?? []).map((s) => s.id);
    if (ids.length > 0) {
      await db.from("financial_transactions").delete().in("id", ids);
    }
    await db
      .from("financial_recurrences")
      .update({ next_run: dueStr })
      .eq("id", t.financial_recurrence_id);
  }
}

/** Campos que pertencem à série (a regra de recorrência), não a um mês só. */
export const SERIES_FIELDS = ["description", "amount", "category", "project_id", "contact_id", "payment_method"] as const;
export type SeriesPatch = Partial<Record<(typeof SERIES_FIELDS)[number], unknown>>;

/** O que mudou nos campos da série entre o lançamento salvo e o novo. */
export function seriesChanges(before: Record<string, unknown>, after: Record<string, unknown>): SeriesPatch {
  const patch: SeriesPatch = {};
  for (const f of SERIES_FIELDS) {
    if (f in after && (after[f] ?? null) !== (before[f] ?? null)) {
      patch[f] = after[f];
    }
  }
  return patch;
}

/**
 * "Nesta e nas próximas": leva a alteração pra regra (meses que ainda vão
 * ser gerados) e pros lançamentos PENDENTES da série que vencem depois deste.
 * Meses anteriores e já pagos ficam intocados (histórico).
 */
export async function applyToFollowing(
  recurrenceId: string,
  fromDueDate: string,
  patch: SeriesPatch,
  opts: { db?: Db; excludeId?: string } = {},
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = opts.db ?? supabase;
  const { error: recErr } = await db.from("financial_recurrences").update(patch as never).eq("id", recurrenceId);
  if (recErr) throw recErr;
  let q = db
    .from("financial_transactions")
    .update(patch as never)
    .eq("financial_recurrence_id", recurrenceId)
    .eq("status", "pendente")
    .gt("due_date", fromDueDate.slice(0, 10));
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  const { error } = await q;
  if (error) throw error;
}
