import type { Database } from "@/integrations/supabase/types";

type ProjectType = Database["public"]["Enums"]["project_type"];

/**
 * Tarefas iniciais sugeridas por tipo de projeto. Ao criar o projeto, o
 * usuário pode aceitar a lista com um clique — evita a "folha em branco".
 * Cada item vira uma linha em `tasks` (status `a_fazer`).
 */
export const PROJECT_TEMPLATES: Partial<Record<ProjectType, { title: string; category?: string }[]>> = {
  consultoria: [
    { title: "Alinhar escopo e expectativa com o cliente", category: "Reunião" },
    { title: "Fechar contrato / proposta assinada", category: "Contrato" },
    { title: "Montar cronograma de entregas", category: "Documento" },
    { title: "Definir forma e datas de pagamento", category: "Financeiro" },
  ],
  obra: [
    { title: "Fechar orçamento com o empreiteiro", category: "Financeiro" },
    { title: "Definir cronograma de etapas", category: "Documento" },
    { title: "Levantar lista de material da 1ª etapa", category: "Material" },
    { title: "Combinar medições e pagamentos", category: "Financeiro" },
  ],
  reformas: [
    { title: "Fechar orçamento com o empreiteiro", category: "Financeiro" },
    { title: "Definir cronograma de etapas", category: "Documento" },
    { title: "Levantar lista de material da 1ª etapa", category: "Material" },
  ],
  imovel: [
    { title: "Reunir documentação do imóvel", category: "Documento" },
    { title: "Definir preço / faixa de negociação", category: "Financeiro" },
    { title: "Publicar anúncio nos portais", category: "Follow-up" },
    { title: "Agendar visitas", category: "Reunião" },
  ],
  investimento_imovel: [
    { title: "Levantar rentabilidade e custos do imóvel", category: "Financeiro" },
    { title: "Checar documentação e matrícula", category: "Documento" },
    { title: "Simular financiamento / fluxo de caixa", category: "Financeiro" },
  ],
  novo_negocio: [
    { title: "Descrever a ideia em uma página", category: "Documento" },
    { title: "Levantar custos de abertura", category: "Financeiro" },
    { title: "Mapear concorrentes e diferencial", category: "Documento" },
    { title: "Definir primeiro passo concreto", category: "Follow-up" },
  ],
  perfil_publico: [
    { title: "Definir tema e público", category: "Documento" },
    { title: "Planejar calendário de conteúdo", category: "Documento" },
    { title: "Preparar os 3 primeiros posts", category: "Follow-up" },
  ],
  faculdade: [
    { title: "Cadastrar as matérias do semestre", category: "Estudo" },
    { title: "Lançar as datas de provas", category: "Estudo" },
    { title: "Anotar os trabalhos e entregas", category: "Estudo" },
  ],
  oab: [
    { title: "Montar cronograma de estudo até a prova", category: "Estudo" },
    { title: "Fazer 1 simulado de diagnóstico", category: "Estudo" },
    { title: "Separar material por disciplina", category: "Estudo" },
  ],
  financeiro_pessoal: [
    { title: "Lançar receitas e despesas fixas do mês", category: "Financeiro" },
    { title: "Cadastrar as recorrências e assinaturas", category: "Financeiro" },
    { title: "Definir meta de reserva", category: "Financeiro" },
  ],
  pessoal: [
    { title: "Escrever o objetivo em uma frase", category: "Pessoal" },
    { title: "Definir o próximo passo", category: "Pessoal" },
  ],
};

export function templateFor(type: string | null | undefined) {
  return PROJECT_TEMPLATES[(type ?? "generico") as ProjectType] ?? [];
}
