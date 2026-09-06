-- Impede duas ocorrências da mesma recorrência financeira na mesma data de
-- vencimento (corrida entre chamadas de advanceFinancialRecurrence).
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_recurrence_due_uniq
  ON public.financial_transactions (financial_recurrence_id, due_date)
  WHERE financial_recurrence_id IS NOT NULL AND due_date IS NOT NULL;
