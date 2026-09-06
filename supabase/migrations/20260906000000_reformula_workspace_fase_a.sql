-- Fase A da reformulação do workspace de projeto.
-- Remove o conceito de "módulos" (workspace_items) e tabelas acadêmicas
-- quase não usadas. Todas confirmadas vazias (0 linhas) antes do drop.

DROP TABLE IF EXISTS public.workspace_items CASCADE;
DROP TABLE IF EXISTS public.academic_classes CASCADE;
DROP TABLE IF EXISTS public.academic_resources CASCADE;
DROP TABLE IF EXISTS public.academic_summaries CASCADE;

-- Config de abas por projeto: estrutura agora é padrão, não há o que configurar.
ALTER TABLE public.projects DROP COLUMN IF EXISTS tab_config;
