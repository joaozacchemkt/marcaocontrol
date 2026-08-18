ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'nao_esquecer' BEFORE 'a_fazer';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category text;