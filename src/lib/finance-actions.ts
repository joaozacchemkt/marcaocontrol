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
