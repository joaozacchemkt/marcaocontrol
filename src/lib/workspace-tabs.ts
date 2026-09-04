/**
 * Configuração de abas por workspace de projeto.
 *
 * Regra: ocultar uma aba NUNCA remove dados — apenas deixa de exibi-la.
 * A configuração fica em `projects.tab_config` (jsonb) no formato:
 *   { order: string[]; hidden: string[] }
 */

import { MODULES } from "./workspace-modules";

export type TabKey =
  | "overview"
  | "board"
  | "modules"
  | "faculdade"
  | "tasks"
  | "calendar"
  | "notes"
  | "files"
  | "team"
  | "finance"
  | "timeline"
  // Chaves de módulo individuais — não usadas mais como abas próprias (ver
  // "modules" acima, que as reúne em uma só); mantidas no tipo só para não
  // quebrar quem ainda referencia esses valores (ex.: workspace-modules.ts).
  // Módulos específicos (Fase 2) — ver src/lib/workspace-modules.ts
  | "mercado"
  | "personas"
  | "referencias"
  | "conteudo"
  | "temas"
  | "jornada"
  | "cases"
  | "obras"
  | "pipeline"
  | "orcamentos"
  | "etapas"
  | "materiais"
  | "medicoes"
  | "pagamentos"
  | "aquisicao"
  | "legalizacao"
  | "venda"
  // Fase 3 — estudos
  | "painel_oab"
  | "biblioteca"
  | "ferramentas_ia"
  | "plano_estudos"
  | "disciplinas"
  | "questoes"
  | "caderno_erros"
  | "simulados"
  | "revisoes"
  | "lei_seca"
  | "tecnicas"
  | "caligrafia"
  | "rotina"
  | "desempenho"
  // Fase 4 — consultoria, doméstico e financeiro pessoal
  | "frentes"
  | "plano_acao"
  | "reunioes"
  | "decisoes"
  | "indicadores"
  | "crm_externo"
  | "integracoes"
  | "casa_rotinas"
  | "casa_manutencao"
  | "casa_compras"
  | "orcamento_pessoal"
  | "metas_financeiras"
  | "assinaturas"
  // Fase 5 — workspaces reais
  | "posicionamento"
  | "calendario_editorial"
  | "parceiros"
  | "leads"
  | "clientes"
  | "profissionais"
  | "fornecedores"
  | "antes_depois"
  | "cronograma"
  | "compras"
  | "fotos"
  | "leilao"
  | "roi"
  | "videos"
  | "planilhas"
  | "objetivos"
  | "roadmap"
  | "backlog"
  | "requisitos"
  | "telas"
  | "apis"
  | "bugs"
  | "coach"
  | "projetos_pontual"
  | "historico_financeiro";

export interface TabDefinition {
  key: TabKey;
  label: string;
  /** Aba que não pode ser desativada (o workspace ficaria sem entrada). */
  locked?: boolean;
}

export const ALL_TABS: TabDefinition[] = [
  { key: "overview", label: "Visão Geral", locked: true },
  { key: "board", label: "Quadro" },
  { key: "modules", label: "Módulos" },
  { key: "faculdade", label: "Faculdade" },
  { key: "painel_oab", label: "Painel OAB" },
  { key: "tasks", label: "Pendências" },
  { key: "calendar", label: "Agenda" },
  { key: "notes", label: "Anotações" },
  { key: "files", label: "Arquivos" },
  { key: "team", label: "Pessoas" },
  { key: "finance", label: "Financeiro" },
  { key: "timeline", label: "Timeline" },
  ...Object.values(MODULES).map((module) => ({
    key: module.key as TabKey,
    label: module.label,
  })),
];

export interface TabConfig {
  order: TabKey[];
  hidden: TabKey[];
}

/**
 * Abas padrão por tipo de projeto. Cada tipo tinha uma aba própria por
 * módulo (até 20 no caso de "oab") — todas viraram uma única aba
 * "modules", que reúne os mesmos módulos como filtro (ver ModulesHub.tsx).
 * Nenhum módulo foi removido de MODULE_TABS_BY_TYPE: só pararam de virar
 * abas separadas.
 */
const DEFAULT_BY_TYPE: Record<string, TabKey[]> = {
  faculdade: [
    "overview", "board", "faculdade", "modules", "tasks",
    "calendar", "notes", "files", "timeline",
  ],
  oab: [
    "overview", "board", "painel_oab", "modules", "tasks", "calendar", "notes",
    "files", "timeline",
  ],
  domestico: [
    "overview", "board", "modules", "tasks", "calendar", "finance", "files",
    "team", "timeline",
  ],
  financeiro_pessoal: [
    "overview", "board", "modules", "finance", "tasks", "notes", "files", "timeline",
  ],
  perfil_imobiliario: [
    "overview", "board", "modules", "tasks", "calendar", "team", "notes",
    "files", "timeline",
  ],
  reformas: [
    "overview", "board", "modules", "tasks", "team",
    "finance", "calendar", "files", "notes", "timeline",
  ],
  obra: [
    "overview", "board", "modules", "tasks",
    "team", "finance", "calendar", "files", "timeline",
  ],
  investimento_imovel: [
    "overview", "board", "modules", "finance", "tasks", "files", "timeline",
  ],
  produto_digital: [
    "overview", "board", "modules", "tasks", "calendar",
    "notes", "files", "team", "timeline",
  ],
  consultoria: [
    "overview", "board", "modules", "tasks",
    "calendar", "team", "finance", "notes", "files", "timeline",
  ],
  novo_negocio: [
    "overview", "board", "modules", "tasks", "calendar", "team", "finance", "notes",
    "files", "timeline",
  ],
};

/** Módulos específicos habilitados por tipo de projeto. */
export const MODULE_TABS_BY_TYPE: Record<string, TabKey[]> = {
  perfil_imobiliario: [
    "posicionamento", "mercado", "personas", "referencias", "conteudo",
    "calendario_editorial", "temas", "parceiros", "jornada", "cases",
  ],
  reformas: [
    "pipeline", "obras", "leads", "clientes", "orcamentos", "profissionais",
    "fornecedores", "antes_depois",
  ],
  obra: [
    "cronograma", "etapas", "materiais", "compras", "orcamentos", "medicoes",
    "pagamentos", "profissionais", "fotos",
  ],
  investimento_imovel: [
    "aquisicao", "leilao", "legalizacao", "roi", "venda", "fotos", "videos",
    "planilhas", "cases",
  ],
  produto_digital: [
    "objetivos", "roadmap", "backlog", "requisitos", "telas", "apis", "bugs",
    "integracoes", "decisoes", "conteudo", "temas",
  ],
  consultoria: [
    "frentes", "plano_acao", "reunioes", "decisoes", "projetos_pontual",
    "indicadores", "crm_externo", "integracoes", "pipeline",
  ],
  novo_negocio: [
    "objetivos", "frentes", "plano_acao", "reunioes", "decisoes", "indicadores", "pipeline",
  ],
  domestico: ["casa_rotinas", "casa_manutencao", "casa_compras", "profissionais"],
  financeiro_pessoal: [
    "orcamento_pessoal", "metas_financeiras", "assinaturas", "historico_financeiro",
  ],
  pessoal: ["casa_rotinas", "casa_manutencao", "casa_compras"],
  generico: ["objetivos"],
  faculdade: ["biblioteca", "ferramentas_ia"],
  oab: [
    "plano_estudos", "disciplinas", "questoes", "caderno_erros", "simulados",
    "revisoes", "lei_seca", "tecnicas", "caligrafia", "rotina", "desempenho", "coach",
  ],
};

// Usado quando o tipo de projeto não tem entrada própria em DEFAULT_BY_TYPE
// (hoje: "generico", "pessoal", "imovel", "perfil_publico"). "generico" e
// "pessoal" têm módulos em MODULE_TABS_BY_TYPE — sem "modules" aqui, a aba
// fica disponível mas escondida por padrão e o usuário nunca a vê sozinho.
const GENERIC_TABS: TabKey[] = [
  "overview",
  "board",
  "modules",
  "tasks",
  "calendar",
  "notes",
  "files",
  "team",
  "finance",
  "timeline",
];

const isTabKey = (value: unknown): value is TabKey =>
  typeof value === "string" && ALL_TABS.some((tab) => tab.key === value);

/**
 * Resolve a configuração efetiva de abas de um projeto, combinando o padrão do
 * tipo com o que o usuário salvou em "Configurar Ambiente".
 */
export function resolveTabConfig(
  projectType: string | null | undefined,
  rawConfig: unknown,
): TabConfig {
  const defaults = DEFAULT_BY_TYPE[projectType ?? "generico"] ?? GENERIC_TABS;

  const config = (rawConfig ?? {}) as { order?: unknown; hidden?: unknown };
  const savedOrder = Array.isArray(config.order) ? config.order.filter(isTabKey) : [];
  const savedHidden = Array.isArray(config.hidden) ? config.hidden.filter(isTabKey) : null;

  // Abas do padrão que ainda não estão na ordem salva entram no final.
  const order: TabKey[] = [...savedOrder];
  for (const key of ALL_TABS.map((t) => t.key)) {
    if (!order.includes(key)) order.push(key);
  }

  // Sem config salva: esconde tudo que não faz parte do padrão do tipo.
  const hidden: TabKey[] =
    savedHidden ??
    ALL_TABS.map((t) => t.key).filter((key) => !defaults.includes(key));

  // "overview" nunca fica oculta.
  return { order, hidden: hidden.filter((key) => key !== "overview") };
}

/** Lista final de abas visíveis, na ordem configurada. */
export function visibleTabs(config: TabConfig, available: TabKey[]): TabDefinition[] {
  return config.order
    .filter((key) => available.includes(key) && !config.hidden.includes(key))
    .map((key) => ALL_TABS.find((tab) => tab.key === key)!)
    .filter(Boolean);
}
