
-- Enum para Status de Provas
DO $$ BEGIN
    CREATE TYPE public.exam_status AS ENUM ('a_estudar', 'estudando', 'realizada', 'corrigida');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Atualizar academic_exams
ALTER TABLE public.academic_exams DROP COLUMN IF EXISTS status;
ALTER TABLE public.academic_exams ADD COLUMN status exam_status DEFAULT 'a_estudar';
ALTER TABLE public.academic_exams ADD COLUMN exam_time TIME;

-- Tabela de Resumos
CREATE TABLE IF NOT EXISTS public.academic_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_summaries TO authenticated;
GRANT ALL ON public.academic_summaries TO service_role;
ALTER TABLE public.academic_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own summaries" ON public.academic_summaries FOR ALL USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Trabalhos Acadêmicos
CREATE TABLE IF NOT EXISTS public.academic_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ,
    weight NUMERIC(4,2),
    status TEXT NOT NULL CHECK (status IN ('nao_iniciado', 'em_andamento', 'pronto', 'entregue', 'corrigido')) DEFAULT 'nao_iniciado',
    grade NUMERIC(4,2),
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_assignments TO authenticated;
GRANT ALL ON public.academic_assignments TO service_role;
ALTER TABLE public.academic_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own assignments" ON public.academic_assignments FOR ALL USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_academic_summaries_subject ON public.academic_summaries(subject_id);
CREATE INDEX IF NOT EXISTS idx_academic_summaries_project ON public.academic_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_academic_assignments_deadline ON public.academic_assignments(deadline);
CREATE INDEX IF NOT EXISTS idx_academic_assignments_subject ON public.academic_assignments(subject_id);

-- Adicionar descrição e detalhes formatados para timeline se não existir
ALTER TABLE public.activity_history ADD COLUMN IF NOT EXISTS description TEXT;
