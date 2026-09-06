-- Fase F: recorrências financeiras (aluguel, salário, assinaturas, parcelas).
-- Espelho conceitual de task_recurrences, mas para financial_transactions.

CREATE TABLE public.financial_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  description text NOT NULL,
  type public.transaction_type NOT NULL,
  amount numeric NOT NULL,
  category text,
  frequency text NOT NULL DEFAULT 'mensal'
    CHECK (frequency IN ('semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  interval_count integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_run date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_recurrences_next_run ON public.financial_recurrences (next_run) WHERE active;
CREATE INDEX idx_financial_recurrences_user ON public.financial_recurrences (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_recurrences TO authenticated;
GRANT ALL ON public.financial_recurrences TO service_role;

ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_financial_recurrences" ON public.financial_recurrences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_financial_recurrences_updated_at
  BEFORE UPDATE ON public.financial_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financial_transactions
  ADD COLUMN financial_recurrence_id uuid
  REFERENCES public.financial_recurrences(id) ON DELETE SET NULL;
