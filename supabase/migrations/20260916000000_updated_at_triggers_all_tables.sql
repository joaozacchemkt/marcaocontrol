-- Auditoria (2026-09-16): tasks foi a única tabela onde a ausência desse
-- gatilho já causava bug visível (Concluídos hoje). As 10 abaixo têm a
-- mesma lacuna mas nenhuma tela hoje depende do updated_at delas — ainda
-- assim, padroniza agora pra não repetir essa investigação quando alguém
-- construir uma feature tipo "editado hoje" em cima de qualquer uma.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects', 'events', 'financial_transactions', 'contacts', 'ideas',
    'project_notes', 'academic_exams', 'academic_assignments',
    'academic_subjects', 'profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$s '
      'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t
    );
  END LOOP;
END $$;
