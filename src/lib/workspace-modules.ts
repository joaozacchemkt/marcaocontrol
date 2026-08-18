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

/* --------------------------------------------------------------------------
 * Fase 3 — Estudos (Faculdade de Direito + Preparação OAB)
 * ------------------------------------------------------------------------ */

const ESTUDOS_MODULES: Record<string, ModuleDefinition> = {
  // --- Faculdade de Direito ---
  biblioteca: {
    key: "biblioteca",
    label: "Biblioteca Jurídica",
    description: "Doutrina, códigos, jurisprudência e materiais de referência.",
    itemLabel: "Material",
    stages: [
      stage("a_ler", "A ler"),
      stage("lendo", "Lendo"),
      stage("lido", "Lido"),
      stage("referencia", "Referência"),
    ],
  },
  ferramentas_ia: {
    key: "ferramentas_ia",
    label: "IA & Ferramentas",
    description: "Ferramentas, prompts e fluxos que aceleram o estudo.",
    itemLabel: "Ferramenta",
    stages: [
      stage("testar", "Testar"),
      stage("em_uso", "Em uso"),
      stage("descartada", "Descartada"),
    ],
  },

  // --- Preparação OAB ---
  plano_estudos: {
    key: "plano_estudos",
    label: "Plano de Estudos",
    description: "Blocos de estudo planejados até a prova.",
    itemLabel: "Bloco",
    stages: [
      stage("planejado", "Planejado"),
      stage("andamento", "Em andamento"),
      stage("concluido", "Concluído"),
    ],
    date: true,
  },
  disciplinas: {
    key: "disciplinas",
    label: "Disciplinas",
    description: "Disciplinas com peso na prova e domínio atual.",
    itemLabel: "Disciplina",
    stages: [
      stage("nao_iniciada", "Não iniciada"),
      stage("estudando", "Estudando"),
      stage("revisao", "Revisão"),
      stage("dominada", "Dominada"),
    ],
  },
  questoes: {
    key: "questoes",
    label: "Banco de Questões",
    description: "Blocos de questões resolvidas e pendentes.",
    itemLabel: "Bloco",
    stages: [
      stage("pendente", "Pendente"),
      stage("resolvido", "Resolvido"),
      stage("revisado", "Revisado"),
    ],
    date: true,
  },
  caderno_erros: {
    key: "caderno_erros",
    label: "Caderno de Erros",
    description: "Erros registrados para revisão dirigida.",
    itemLabel: "Erro",
    stages: [
      stage("aberto", "Aberto"),
      stage("revisado", "Revisado"),
      stage("superado", "Superado"),
    ],
  },
  simulados: {
    key: "simulados",
    label: "Simulados",
    description: "Simulados aplicados e resultados.",
    itemLabel: "Simulado",
    stages: [
      stage("agendado", "Agendado"),
      stage("realizado", "Realizado"),
      stage("corrigido", "Corrigido"),
    ],
    date: true,
  },
  revisoes: {
    key: "revisoes",
    label: "Revisões",
    description: "Ciclos de revisão espaçada.",
    itemLabel: "Revisão",
    stages: [
      stage("prevista", "Prevista"),
      stage("feita", "Feita"),
    ],
    date: true,
  },
  lei_seca: {
    key: "lei_seca",
    label: "Lei Seca",
    description: "Leitura dirigida de dispositivos legais.",
    itemLabel: "Leitura",
    stages: [
      stage("pendente", "Pendente"),
      stage("lida", "Lida"),
      stage("revisada", "Revisada"),
    ],
    date: true,
  },
  tecnicas: {
    key: "tecnicas",
    label: "Técnicas",
    description: "Técnicas de prova, redação e resolução.",
    itemLabel: "Técnica",
    stages: [
      stage("estudar", "Estudar"),
      stage("praticando", "Praticando"),
      stage("dominada", "Dominada"),
    ],
  },
  caligrafia: {
    key: "caligrafia",
    label: "Caligrafia",
    description: "Treinos de escrita para a 2ª fase.",
    itemLabel: "Treino",
    stages: [stage("previsto", "Previsto"), stage("feito", "Feito")],
    date: true,
  },
  rotina: {
    key: "rotina",
    label: "Rotina",
    description: "Rotina semanal de estudo e hábitos.",
    itemLabel: "Item",
    stages: [stage("ativo", "Ativo"), stage("pausado", "Pausado")],
  },
  desempenho: {
    key: "desempenho",
    label: "Desempenho",
    description: "Registros de acertos e evolução por período.",
    itemLabel: "Registro",
    stages: [stage("registrado", "Registrado")],
    date: true,
  },
};

Object.assign(MODULES, ESTUDOS_MODULES);

/* --------------------------------------------------------------------------
 * Fase 4 — Consultoria, negócios diversos, doméstico e financeiro pessoal
 * ------------------------------------------------------------------------ */

const FASE4_MODULES: Record<string, ModuleDefinition> = {
  // --- Consultoria Pontual (e demais consultorias) ---
  frentes: {
    key: "frentes",
    label: "Frentes",
    description: "Frentes de trabalho ativas da consultoria.",
    itemLabel: "Frente",
    stages: [
      stage("mapeada", "Mapeada"),
      stage("andamento", "Em andamento"),
      stage("pausada", "Pausada"),
      stage("concluida", "Concluída"),
    ],
    date: true,
  },
  plano_acao: {
    key: "plano_acao",
    label: "Plano de Ação",
    description: "Problema → ação → responsável → prazo → status.",
    itemLabel: "Ação",
    stages: [
      stage("pendente", "Pendente"),
      stage("andamento", "Em andamento"),
      stage("aguardando", "Aguardando terceiro"),
      stage("concluida", "Concluída"),
    ],
    date: true,
  },
  reunioes: {
    key: "reunioes",
    label: "Reuniões",
    description: "Pautas, participantes e encaminhamentos.",
    itemLabel: "Reunião",
    stages: [
      stage("agendada", "Agendada"),
      stage("realizada", "Realizada"),
      stage("com_ata", "Com ata"),
    ],
    date: true,
  },
  decisoes: {
    key: "decisoes",
    label: "Decisões",
    description: "Decisões tomadas e pendentes de definição.",
    itemLabel: "Decisão",
    stages: [
      stage("pendente", "Pendente"),
      stage("decidida", "Decidida"),
      stage("revisar", "Revisar"),
    ],
    date: true,
  },
  indicadores: {
    key: "indicadores",
    label: "Indicadores Executivos",
    description: "Indicadores acompanhados periodicamente.",
    itemLabel: "Indicador",
    stages: [
      stage("acompanhando", "Acompanhando"),
      stage("atencao", "Atenção"),
      stage("ok", "Dentro da meta"),
    ],
    amount: true,
    date: true,
  },
  crm_externo: {
    key: "crm_externo",
    label: "CRM Externo",
    description: "Painel de acompanhamento de bases externas (não é CRM).",
    itemLabel: "Acompanhamento",
    stages: [
      stage("monitorando", "Monitorando"),
      stage("acao", "Requer ação"),
      stage("resolvido", "Resolvido"),
    ],
    date: true,
  },
  integracoes: {
    key: "integracoes",
    label: "Integrações",
    description: "Sistemas e integrações em avaliação ou uso.",
    itemLabel: "Integração",
    stages: [
      stage("mapeada", "Mapeada"),
      stage("em_implantacao", "Em implantação"),
      stage("ativa", "Ativa"),
      stage("descartada", "Descartada"),
    ],
    date: true,
  },

  // --- Assuntos domésticos ---
  casa_rotinas: {
    key: "casa_rotinas",
    label: "Rotinas da Casa",
    description: "Rotinas domésticas recorrentes e responsáveis.",
    itemLabel: "Rotina",
    stages: [stage("ativa", "Ativa"), stage("pausada", "Pausada")],
    date: true,
  },
  casa_manutencao: {
    key: "casa_manutencao",
    label: "Manutenção",
    description: "Reparos, revisões e serviços da casa.",
    itemLabel: "Manutenção",
    stages: [
      stage("pendente", "Pendente"),
      stage("agendada", "Agendada"),
      stage("concluida", "Concluída"),
    ],
    amount: true,
    date: true,
  },
  casa_compras: {
    key: "casa_compras",
    label: "Compras",
    description: "Itens a comprar para a casa.",
    itemLabel: "Item",
    stages: [
      stage("listado", "Listado"),
      stage("cotado", "Cotado"),
      stage("comprado", "Comprado"),
    ],
    amount: true,
    date: true,
  },

  // --- Financeiro pessoal ---
  orcamento_pessoal: {
    key: "orcamento_pessoal",
    label: "Orçamento",
    description: "Categorias de orçamento e limites do mês.",
    itemLabel: "Categoria",
    stages: [
      stage("planejado", "Planejado"),
      stage("dentro", "Dentro do limite"),
      stage("estourado", "Estourado"),
    ],
    amount: true,
    date: true,
  },
  metas_financeiras: {
    key: "metas_financeiras",
    label: "Metas Financeiras",
    description: "Objetivos financeiros e progresso.",
    itemLabel: "Meta",
    stages: [
      stage("definida", "Definida"),
      stage("andamento", "Em andamento"),
      stage("atingida", "Atingida"),
    ],
    amount: true,
    date: true,
  },
  assinaturas: {
    key: "assinaturas",
    label: "Assinaturas",
    description: "Assinaturas e cobranças recorrentes.",
    itemLabel: "Assinatura",
    stages: [
      stage("ativa", "Ativa"),
      stage("revisar", "Revisar"),
      stage("cancelada", "Cancelada"),
    ],
    amount: true,
    date: true,
  },
};

Object.assign(MODULES, FASE4_MODULES);

/* --------------------------------------------------------------------------
 * Fase 5 — Workspaces reais do Marcus (módulos complementares)
 * ------------------------------------------------------------------------ */

const simples = (
  key: string,
  label: string,
  description: string,
  itemLabel: string,
  stages: ModuleStage[],
  extra: { amount?: boolean; date?: boolean } = {},
): ModuleDefinition => ({ key, label, description, itemLabel, stages, ...extra });

const FASE5_MODULES: Record<string, ModuleDefinition> = {
  // --- Perfil imobiliário ---
  posicionamento: simples(
    "posicionamento",
    "Posicionamento",
    "Pilares de marca, mensagens e diferenciais (legalização e leilões).",
    "Pilar",
    [stage("rascunho", "Rascunho"), stage("validado", "Validado")],
  ),
  calendario_editorial: simples(
    "calendario_editorial",
    "Calendário Editorial",
    "Programação de publicações por data.",
    "Publicação",
    [
      stage("planejado", "Planejado"),
      stage("produzindo", "Produzindo"),
      stage("agendado", "Agendado"),
      stage("publicado", "Publicado"),
    ],
    { date: true },
  ),
  parceiros: simples(
    "parceiros",
    "Parceiros",
    "Parcerias estratégicas e status de cada relação.",
    "Parceiro",
    [stage("prospect", "Prospect"), stage("ativo", "Ativo"), stage("pausado", "Pausado")],
  ),

  // --- JPA Reformas ---
  leads: simples(
    "leads",
    "Leads",
    "Interessados que ainda não viraram cliente.",
    "Lead",
    [stage("novo", "Novo"), stage("contato", "Em contato"), stage("qualificado", "Qualificado"), stage("descartado", "Descartado")],
    { date: true },
  ),
  clientes: simples(
    "clientes",
    "Clientes",
    "Clientes ativos e histórico de relacionamento.",
    "Cliente",
    [stage("ativo", "Ativo"), stage("concluido", "Concluído"), stage("inativo", "Inativo")],
    { amount: true },
  ),
  profissionais: simples(
    "profissionais",
    "Profissionais",
    "Equipe, empreiteiros e prestadores.",
    "Profissional",
    [stage("disponivel", "Disponível"), stage("alocado", "Alocado"), stage("inativo", "Inativo")],
    { amount: true },
  ),
  fornecedores: simples(
    "fornecedores",
    "Fornecedores",
    "Fornecedores de material e serviços.",
    "Fornecedor",
    [stage("cotando", "Cotando"), stage("homologado", "Homologado"), stage("descartado", "Descartado")],
  ),
  antes_depois: simples(
    "antes_depois",
    "Antes e Depois",
    "Registros comparativos para portfólio.",
    "Registro",
    [stage("pendente", "Pendente"), stage("registrado", "Registrado"), stage("publicado", "Publicado")],
    { date: true },
  ),

  // --- Obra ---
  cronograma: simples(
    "cronograma",
    "Cronograma",
    "Linha do tempo macro da obra.",
    "Marco",
    [stage("previsto", "Previsto"), stage("andamento", "Em andamento"), stage("concluido", "Concluído"), stage("atrasado", "Atrasado")],
    { date: true },
  ),
  compras: simples(
    "compras",
    "Compras",
    "Pedidos de compra e entregas.",
    "Compra",
    [stage("solicitada", "Solicitada"), stage("cotada", "Cotada"), stage("comprada", "Comprada"), stage("entregue", "Entregue")],
    { amount: true, date: true },
  ),
  fotos: simples(
    "fotos",
    "Fotos",
    "Registros fotográficos por etapa (links e anexos).",
    "Registro",
    [stage("pendente", "Pendente"), stage("registrado", "Registrado")],
    { date: true },
  ),

  // --- Investimento imobiliário ---
  leilao: simples(
    "leilao",
    "Leilão",
    "Lotes, praças, lances e prazos do leilão.",
    "Item",
    [stage("prospect", "Prospecção"), stage("analise", "Análise"), stage("arrematado", "Arrematado"), stage("descartado", "Descartado")],
    { amount: true, date: true },
  ),
  roi: simples(
    "roi",
    "ROI",
    "Premissas de retorno do investimento (sem duplicar custos da obra).",
    "Cenário",
    [stage("estimado", "Estimado"), stage("realizado", "Realizado")],
    { amount: true },
  ),
  videos: simples(
    "videos",
    "Vídeos",
    "Vídeos do processo e material final.",
    "Vídeo",
    [stage("ideia", "Ideia"), stage("gravado", "Gravado"), stage("editado", "Editado"), stage("publicado", "Publicado")],
    { date: true },
  ),
  planilhas: simples(
    "planilhas",
    "Planilhas",
    "Planilhas de apoio e links.",
    "Planilha",
    [stage("ativa", "Ativa"), stage("arquivada", "Arquivada")],
  ),

  // --- Produto digital ---
  objetivos: simples(
    "objetivos",
    "Objetivos",
    "Objetivos do produto e resultados esperados.",
    "Objetivo",
    [stage("proposto", "Proposto"), stage("ativo", "Ativo"), stage("atingido", "Atingido")],
    { date: true },
  ),
  roadmap: simples(
    "roadmap",
    "Roadmap",
    "Entregas planejadas por horizonte.",
    "Entrega",
    [stage("agora", "Agora"), stage("proximo", "Próximo"), stage("depois", "Depois"), stage("entregue", "Entregue")],
    { date: true },
  ),
  backlog: simples(
    "backlog",
    "Backlog",
    "Itens candidatos ainda não priorizados.",
    "Item",
    [stage("novo", "Novo"), stage("priorizado", "Priorizado"), stage("descartado", "Descartado")],
  ),
  requisitos: simples(
    "requisitos",
    "Requisitos",
    "Regras e requisitos funcionais.",
    "Requisito",
    [stage("rascunho", "Rascunho"), stage("validado", "Validado"), stage("implementado", "Implementado")],
  ),
  telas: simples(
    "telas",
    "Telas",
    "Telas e fluxos do produto.",
    "Tela",
    [stage("prevista", "Prevista"), stage("desenho", "Em desenho"), stage("pronta", "Pronta")],
  ),
  apis: simples(
    "apis",
    "APIs",
    "Endpoints e contratos de integração.",
    "API",
    [stage("mapeada", "Mapeada"), stage("desenvolvimento", "Em desenvolvimento"), stage("ativa", "Ativa")],
  ),
  bugs: simples(
    "bugs",
    "Bugs",
    "Defeitos reportados e correções.",
    "Bug",
    [stage("aberto", "Aberto"), stage("investigando", "Investigando"), stage("corrigido", "Corrigido")],
    { date: true },
  ),

  // --- OAB / consultoria ---
  coach: simples(
    "coach",
    "Coach",
    "Acompanhamento de rotina, motivação e ajustes de plano.",
    "Registro",
    [stage("pendente", "Pendente"), stage("feito", "Feito")],
    { date: true },
  ),
  projetos_pontual: simples(
    "projetos_pontual",
    "Projetos Pontual",
    "Projetos acompanhados dentro da consultoria.",
    "Projeto",
    [stage("previsto", "Previsto"), stage("andamento", "Em andamento"), stage("concluido", "Concluído")],
    { date: true },
  ),

  // --- Financeiro pessoal / doméstico ---
  historico_financeiro: simples(
    "historico_financeiro",
    "Histórico",
    "Registros e marcos financeiros relevantes.",
    "Registro",
    [stage("registrado", "Registrado")],
    { amount: true, date: true },
  ),
};

Object.assign(MODULES, FASE5_MODULES);
