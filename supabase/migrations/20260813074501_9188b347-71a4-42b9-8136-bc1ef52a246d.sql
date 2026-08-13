
-- Add project_id to activity_history to allow filtering activity by project
ALTER TABLE public.activity_history ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_activity_history_project_id ON public.activity_history(project_id);
