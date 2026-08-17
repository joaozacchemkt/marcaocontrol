/**
 * Configuração de abas por workspace de projeto.
 *
 * Regra: ocultar uma aba NUNCA remove dados — apenas deixa de exibi-la.
 * A configuração fica em `projects.tab_config` (jsonb) no formato:
 *   { order: string[]; hidden: string[] }
 */

export type TabKey =
  | "overview"
  | "faculdade"
  | "tasks"
  | "calendar"
  | "notes"
  | "files"
  | "team"
  | "finance"
  | "timeline";

export interface TabDefinition {
  key: TabKey;
  label: string;
  /** Aba que não pode ser desativada (o workspace ficaria sem entrada). */
  locked?: boolean;
}

export const ALL_TABS: TabDefinition[] = [
  { key: "overview", label: "Visão Geral", locked: true },
  { key: "faculdade", label: "Faculdade" },
  { key: "tasks", label: "Pendências" },
  { key: "calendar", label: "Agenda" },
  { key: "notes", label: "Anotações" },
  { key: "files", label: "Arquivos" },
  { key: "team", label: "Pessoas" },
  { key: "finance", label: "Financeiro" },
  { key: "timeline", label: "Timeline" },
];

export interface TabConfig {
  order: TabKey[];
  hidden: TabKey[];
}

/** Abas padrão por tipo de projeto. */
const DEFAULT_BY_TYPE: Record<string, TabKey[]> = {
  faculdade: ["overview", "faculdade", "tasks", "calendar", "notes", "files", "timeline"],
  oab: ["overview", "tasks", "calendar", "notes", "files", "timeline"],
  domestico: ["overview", "tasks", "calendar", "finance", "files", "team", "timeline"],
  financeiro_pessoal: ["overview", "finance", "tasks", "notes", "files", "timeline"],
};

const GENERIC_TABS: TabKey[] = [
  "overview",
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
