/** Item genérico de módulo de workspace (tabela `workspace_items`). */
export interface WorkspaceItem {
  id: string;
  project_id: string;
  module: string;
  title: string;
  description: string | null;
  stage: string;
  amount: number | null;
  due_date: string | null;
  position: number;
  created_at: string;
}
