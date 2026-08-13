
-- Enum for Project Types
CREATE TYPE public.project_type AS ENUM ('faculdade', 'imovel', 'consultoria', 'perfil_publico', 'novo_negocio', 'pessoal', 'generico');

-- Add project_type to projects table
ALTER TABLE public.projects ADD COLUMN type public.project_type DEFAULT 'generico';

-- Tables for Academic Template (Faculdade)
CREATE TABLE public.academic_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    professor TEXT,
    period TEXT,
    schedule TEXT,
    location TEXT,
    description TEXT,
    syllabus TEXT,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida', 'trancada')),
    notes TEXT,
    absences_limit INTEGER DEFAULT 0,
    current_absences INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academic_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    observations TEXT,
    materials_links TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academic_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    weight NUMERIC DEFAULT 1,
    grade NUMERIC,
    status TEXT DEFAULT 'a_estudar' CHECK (status IN ('a_estudar', 'estudando', 'realizada', 'corrigida')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.useful_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.academic_subjects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Academic Media (Videos)
CREATE TABLE public.academic_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.academic_subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'video' CHECK (type IN ('video', 'document', 'other')),
    url TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'assistir' CHECK (status IN ('assistir', 'assistindo', 'assistido', 'revisar')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Project Contacts Relationship (Pessoas)
CREATE TABLE public.project_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    role_in_project TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_subjects TO authenticated;
GRANT ALL ON public.academic_subjects TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_classes TO authenticated;
GRANT ALL ON public.academic_classes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_exams TO authenticated;
GRANT ALL ON public.academic_exams TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.useful_links TO authenticated;
GRANT ALL ON public.useful_links TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_resources TO authenticated;
GRANT ALL ON public.academic_resources TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_contacts TO authenticated;
GRANT ALL ON public.project_contacts TO service_role;

-- RLS Policies
CREATE POLICY "Users can manage their own academic_subjects" ON public.academic_subjects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own academic_classes" ON public.academic_classes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own academic_exams" ON public.academic_exams FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own project_notes" ON public.project_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own useful_links" ON public.useful_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own academic_resources" ON public.academic_resources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own project_contacts" ON public.project_contacts FOR ALL USING (auth.uid() = user_id);
