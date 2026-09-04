/** Tipos e helpers do Quadro (Kanban) de projeto. */

import { parseLocalDate } from "@/lib/dates";

export type BoardStatus =
  | "nao_esquecer"
  | "a_fazer"
  | "em_andamento"
  | "aguardando_terceiro"
  | "concluido";

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: BoardStatus;
  priority: "baixa" | "media" | "alta" | null;
  deadline: string | null;
  responsible: string | null;
  category: string | null;
  waiting_for: string | null;
  contact_id: string | null;
  parent_task_id: string | null;
  project_id: string | null;
  /** Usado para saber o que foi concluído hoje. */
  updated_at?: string | null;
}

export const BOARD_COLUMNS: { id: BoardStatus; label: string }[] = [
  { id: "nao_esquecer", label: "Não esquecer" },
  { id: "a_fazer", label: "A fazer" },
  { id: "em_andamento", label: "Em progresso" },
  { id: "aguardando_terceiro", label: "Aguardando" },
  { id: "concluido", label: "Concluído" },
];

export const STATUS_LABELS: Record<BoardStatus, string> = {
  nao_esquecer: "Não esquecer",
  a_fazer: "A fazer",
  em_andamento: "Em progresso",
  aguardando_terceiro: "Aguardando",
  concluido: "Concluído",
};

/** Atraso é sempre derivado: prazo passado + tarefa não concluída. */
export function isOverdue(task: Pick<BoardTask, "deadline" | "status">): boolean {
  if (!task.deadline || task.status === "concluido") return false;
  const deadline = parseLocalDate(task.deadline);
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today;
}

export type BoardFilter =
  | "todas"
  | "hoje"
  | "atrasadas"
  | "semana"
  | "alta"
  | "nao_esquecer"
  | "aguardando"
  | "concluidas";

export const BOARD_FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "hoje", label: "Hoje" },
  { value: "atrasadas", label: "🔴 Atrasadas" },
  { value: "semana", label: "Esta semana" },
  { value: "alta", label: "Alta prioridade" },
  { value: "nao_esquecer", label: "Não esquecer" },
  { value: "aguardando", label: "Aguardando terceiros" },
  { value: "concluidas", label: "Concluídas" },
];
