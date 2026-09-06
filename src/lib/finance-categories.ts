/**
 * Categorias financeiras curadas. Antes o campo `category` era texto livre,
 * o que deixava o financeiro impossível de resumir. Agora é uma lista fixa
 * (o Select usa isto); valores antigos que não estão aqui continuam
 * aparecendo, só não são oferecidos para novos lançamentos.
 */
export const FINANCE_CATEGORIES = [
  "Cliente / Recebível",
  "Serviços prestados",
  "Aluguel",
  "Moradia / Contas",
  "Equipe / Salários",
  "Material / Obra",
  "Fornecedores",
  "Impostos / Taxas",
  "Marketing",
  "Software / Assinaturas",
  "Transporte",
  "Estudos",
  "Investimento",
  "Outros",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
