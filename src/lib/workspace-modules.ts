/**
 * Módulos específicos dos workspaces (Fase 2 — ecossistema imobiliário).
 *
 * Todos os módulos usam a mesma tabela `workspace_items`, diferenciada pela
 * coluna `module`. Isso evita dezenas de tabelas quase idênticas e mantém a
 * regra do projeto: dado global + relacionamento com projeto (`project_id`).
 */

export interface ModuleStage {
  value: string;
  label: string;
}

export interface ModuleDefinition {
  /** Chave usada em `workspace_items.module` e como key da aba. */
  key: string;
  label: string;
  /** Texto curto exibido no topo do módulo. */
  description: string;
  /** Rótulo no singular usado nos botões ("Nova Obra", "Novo Item"). */
  itemLabel: string;
  stages: ModuleStage[];
  /** Exibe campo de valor (R$). */
  amount?: boolean;
  /** Exibe campo de data prevista. */
  date?: boolean;
}

const stage = (value: string, label: string): ModuleStage => ({ value, label });

export const MODULES: Record<string, ModuleDefinition> = {
  // --- Perfil imobiliário (Marcus) ---
  mercado: {
    key: "mercado",
    label: "Pesquisa de Mercado",
    description: "Levantamentos, dados e observações sobre o mercado.",
    itemLabel: "Pesquisa",
    stages: [stage("aberto", "Em análise"), stage("concluido", "Concluído")],
    date: true,
  },
  personas: {
    key: "personas",
    label: "Público-Alvo",
    description: "Personas e perfis de cliente que orientam o conteúdo.",
    itemLabel: "Persona",
    stages: [stage("rascunho", "Rascunho"), stage("validada", "Validada")],
  },
  referencias: {
    key: "referencias",
    label: "Referências",
    description: "Perfis, campanhas e materiais usados como referência.",
    itemLabel: "Referência",
    stages: [stage("salva", "Salva"), stage("aplicada", "Aplicada")],
  },
  conteudo: {
    key: "conteudo",
    label: "Conteúdo",
    description: "Pipeline editorial da ideia até a publicação.",
    itemLabel: "Conteúdo",
    stages: [
      stage("ideia", "Ideia"),
      stage("roteiro", "Roteiro"),
      stage("producao", "Produção"),
      stage("agendado", "Agendado"),
      stage("publicado", "Publicado"),
    ],
    date: true,
  },
  temas: {
    key: "temas",
    label: "Banco de Temas",
    description: "Reserva de assuntos para alimentar o pipeline de conteúdo.",
    itemLabel: "Tema",
    stages: [stage("disponivel", "Disponível"), stage("usado", "Usado")],
  },
  jornada: {
    key: "jornada",
    label: "Jornada do Cliente",
    description: "Etapas do contato inicial até o fechamento.",
    itemLabel: "Etapa",
    stages: [
      stage("descoberta", "Descoberta"),
      stage("consideracao", "Consideração"),
      stage("decisao", "Decisão"),
      stage("pos_venda", "Pós-venda"),
    ],
  },
  cases: {
    key: "cases",
    label: "Cases",
    description: "Resultados e histórias prontas para divulgação.",
    itemLabel: "Case",
    stages: [
      stage("rascunho", "Rascunho"),
      stage("pronto", "Pronto"),
      stage("publicado", "Publicado"),
    ],
  },

  // --- JPA Reformas ---
  obras: {
    key: "obras",
    label: "Obras",
    description: "Obras e reformas em andamento.",
    itemLabel: "Obra",
    stages: [
      stage("planejamento", "Planejamento"),
      stage("execucao", "Execução"),
      stage("acabamento", "Acabamento"),
      stage("finalizada", "Finalizada"),
    ],
    amount: true,
    date: true,
  },
  pipeline: {
    key: "pipeline",
    label: "Pipeline Comercial",
    description: "Do lead ao contrato fechado.",
    itemLabel: "Negócio",
    stages: [
      stage("lead", "Lead"),
      stage("visita", "Visita"),
      stage("orcamento", "Orçamento"),
      stage("negociacao", "Negociação"),
      stage("fechado", "Fechado"),
      stage("perdido", "Perdido"),
    ],
    amount: true,
    date: true,
  },
  orcamentos: {
    key: "orcamentos",
    label: "Orçamentos",
    description: "Propostas enviadas e seus status.",
    itemLabel: "Orçamento",
    stages: [
      stage("rascunho", "Rascunho"),
      stage("enviado", "Enviado"),
      stage("aprovado", "Aprovado"),
      stage("recusado", "Recusado"),
    ],
    amount: true,
    date: true,
  },

  // --- Papucaia obra ---
  etapas: {
    key: "etapas",
    label: "Etapas",
    description: "Cronograma de execução por etapa.",
    itemLabel: "Etapa",
    stages: [
      stage("prevista", "Prevista"),
      stage("andamento", "Em andamento"),
      stage("concluida", "Concluída"),
    ],
    amount: true,
    date: true,
  },
  materiais: {
    key: "materiais",
    label: "Materiais",
    description: "Compras e insumos da obra.",
    itemLabel: "Material",
    stages: [
      stage("listado", "Listado"),
      stage("cotado", "Cotado"),
      stage("comprado", "Comprado"),
      stage("entregue", "Entregue"),
    ],
    amount: true,
    date: true,
  },
  medicoes: {
    key: "medicoes",
    label: "Medições",
    description: "Medições de serviços executados.",
    itemLabel: "Medição",
    stages: [stage("aberta", "Aberta"), stage("aprovada", "Aprovada")],
    amount: true,
    date: true,
  },
  pagamentos: {
    key: "pagamentos",
    label: "Pagamentos",
    description: "Pagamentos a profissionais e fornecedores da obra.",
    itemLabel: "Pagamento",
    stages: [
      stage("previsto", "Previsto"),
      stage("aprovado", "Aprovado"),
      stage("pago", "Pago"),
    ],
    amount: true,
    date: true,
  },

  // --- Papucaia casa / leilão (investimento) ---
  aquisicao: {
    key: "aquisicao",
    label: "Aquisição",
    description: "Etapas da compra do imóvel.",
    itemLabel: "Item",
    stages: [
      stage("pendente", "Pendente"),
      stage("andamento", "Em andamento"),
      stage("concluido", "Concluído"),
    ],
    amount: true,
    date: true,
  },
  legalizacao: {
    key: "legalizacao",
    label: "Legalização",
    description: "Checklist documental e regularização.",
    itemLabel: "Documento",
    stages: [
      stage("pendente", "Pendente"),
      stage("protocolado", "Protocolado"),
      stage("concluido", "Concluído"),
    ],
    amount: true,
    date: true,
  },
  venda: {
    key: "venda",
    label: "Venda",
    description: "Preparação, divulgação e fechamento da venda.",
    itemLabel: "Item",
    stages: [
      stage("preparacao", "Preparação"),
      stage("divulgacao", "Divulgação"),
      stage("proposta", "Proposta"),
      stage("vendido", "Vendido"),
    ],
    amount: true,
    date: true,
  },
};

export type ModuleKey = keyof typeof MODULES;

export const isModuleKey = (key: string): boolean =>
  Object.prototype.hasOwnProperty.call(MODULES, key);
