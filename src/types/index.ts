import { LucideIcon } from "lucide-react";

export type TaskStatus = 'a_fazer' | 'em_andamento' | 'aguardando_terceiro' | 'concluido';
export type TaskPriority = 'baixa' | 'media' | 'alta';
export type ProjectStatus = 'ideia' | 'em_analise' | 'planejamento' | 'em_andamento' | 'pausado' | 'concluido';
export type TransactionType = 'receita' | 'despesa';
export type TransactionStatus = 'pendente' | 'pago';
export type IdeaStatus = 'ideia' | 'estudar' | 'oportunidade' | 'virou_projeto' | 'arquivada';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company: string | null;
  role: string | null;
}

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}
