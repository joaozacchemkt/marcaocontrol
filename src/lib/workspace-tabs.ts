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
  | "faculdade"
  | "tasks"
  | "calendar"
  | "notes"
  | "files"
  | "team"
  | "finance"
  | "timeline"
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
  | "assinaturas";

export interface TabDefinition {
  key: TabKey;
  label: string;
  /** Aba que não pode ser desativada (o workspace ficaria sem entrada). */
  locked?: boolean;
}

export const ALL_TABS: TabDefinition[] = [
  { key: "overview", label: "Visão Geral", locked: true },
  { key: "board", label: "Quadro" },
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

/** Abas padrão por tipo de projeto. */
const DEFAULT_BY_TYPE: Record<string, TabKey[]> = {
  faculdade: [
    "overview", "board", "faculdade", "biblioteca", "ferramentas_ia", "tasks",
    "calendar", "notes", "files", "timeline",
  ],
  oab: [
    "overview", "board", "painel_oab", "plano_estudos", "disciplinas", "questoes",
    "caderno_erros", "simulados", "revisoes", "lei_seca", "tecnicas",
    "caligrafia", "rotina", "desempenho", "tasks", "calendar", "notes",
    "files", "timeline",
  ],
  domestico: [
    "overview", "board", "casa_rotinas", "casa_manutencao", "casa_compras", "tasks",
    "calendar", "finance", "files", "team", "timeline",
  ],
  financeiro_pessoal: [
    "overview", "board", "orcamento_pessoal", "metas_financeiras", "assinaturas",
    "finance", "tasks", "notes", "files", "timeline",
  ],
  perfil_imobiliario: [
    "overview", "board", "conteudo", "temas", "personas", "referencias", "mercado",
    "jornada", "cases", "tasks", "calendar", "team", "notes", "files", "timeline",
  ],
  reformas: [
    "overview", "board", "pipeline", "obras", "orcamentos", "tasks", "team",
    "finance", "calendar", "files", "notes", "timeline",
  ],
  obra: [
    "overview", "board", "etapas", "materiais", "medicoes", "pagamentos", "tasks",
    "team", "finance", "calendar", "files", "timeline",
  ],
  investimento_imovel: [
    "overview", "board", "aquisicao", "legalizacao", "venda", "cases", "finance",
    "tasks", "files", "timeline",
  ],
  produto_digital: [
    "overview", "board", "conteudo", "temas", "tasks", "calendar", "finance",
    "notes", "files", "team", "timeline",
  ],
  consultoria: [
    "overview", "board", "frentes", "plano_acao", "reunioes", "decisoes",
    "indicadores", "crm_externo", "integracoes", "pipeline", "tasks",
    "calendar", "team", "finance", "notes", "files", "timeline",
  ],
  novo_negocio: [
    "overview", "board", "frentes", "plano_acao", "reunioes", "decisoes", "indicadores",
    "pipeline", "tasks", "calendar", "team", "finance", "notes", "files", "timeline",
  ],
};

/** Módulos específicos habilitados por tipo de projeto. */
export const MODULE_TABS_BY_TYPE: Record<string, TabKey[]> = {
  perfil_imobiliario: ["mercado", "personas", "referencias", "conteudo", "temas", "jornada", "cases"],
  reformas: ["pipeline", "obras", "orcamentos"],
  obra: ["etapas", "materiais", "medicoes", "pagamentos"],
  investimento_imovel: ["aquisicao", "legalizacao", "venda", "cases"],
  produto_digital: ["conteudo", "temas"],
  consultoria: [
    "frentes", "plano_acao", "reunioes", "decisoes", "indicadores",
    "crm_externo", "integracoes", "pipeline",
  ],
  novo_negocio: [
    "frentes", "plano_acao", "reunioes", "decisoes", "indicadores", "pipeline",
  ],
  domestico: ["casa_rotinas", "casa_manutencao", "casa_compras"],
  financeiro_pessoal: ["orcamento_pessoal", "metas_financeiras", "assinaturas"],
  pessoal: ["casa_rotinas", "casa_manutencao", "casa_compras"],
  faculdade: ["biblioteca", "ferramentas_ia"],
  oab: [
    "plano_estudos", "disciplinas", "questoes", "caderno_erros", "simulados",
    "revisoes", "lei_seca", "tecnicas", "caligrafia", "rotina", "desempenho",
  ],
};

const GENERIC_TABS: TabKey[] = [
  "overview",
  "board",
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
