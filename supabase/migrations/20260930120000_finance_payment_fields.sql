-- Financeiro: forma de pagamento + data do pagamento.
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_date date;

-- Recorrência herda a forma de pagamento nas próximas ocorrências.
ALTER TABLE public.financial_recurrences
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Lançamentos já quitados: sem registro de quando foram pagos, usa a última
-- alteração como melhor aproximação.
UPDATE public.financial_transactions
  SET paid_date = COALESCE(updated_at::date, date)
  WHERE status = 'pago' AND paid_date IS NULL;

-- Lançamentos sem vencimento passam a vencer na data em que foram lançados.
UPDATE public.financial_transactions
  SET due_date = date
  WHERE due_date IS NULL;

-- Correção pontual: valor digitado "1.200" virou 1,2 no campo antigo.
UPDATE public.financial_transactions
  SET amount = 1200
  WHERE id = 'f4729b63-9913-45e7-acc0-376b1db11917' AND amount = 1.2;

-- "Data do lançamento" saiu do formulário: `date` passa a acompanhar o
-- vencimento (é o que define em qual mês o lançamento aparece).
UPDATE public.financial_transactions
  SET date = due_date
  WHERE date IS DISTINCT FROM due_date;
