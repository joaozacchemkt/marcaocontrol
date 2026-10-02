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
  "Alimentação / Mercado",
  "Transporte",
  "Estudos",
  "Investimento",
  "Outros",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/** Formas de pagamento oferecidas no lançamento (texto livre no banco). */
export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Transferência (TED/DOC)",
  "Débito automático",
  "Cheque",
  "Outro",
] as const;

/**
 * Valor em reais com máscara de centavos: cada dígito digitado entra pela
 * direita ("150050" → "1.500,50"). Evita a ambiguidade de vírgula/ponto do
 * `type="number"`, que transformava "1.200" em 1,2.
 */
export function maskBRL(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const int = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${int},${cents.slice(-2)}`;
}

/** Número vindo do banco → texto mascarado ("1500.5" → "1.500,50"). */
export function amountToBRL(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "";
  return maskBRL(Number(amount).toFixed(2));
}

/** Texto mascarado → número ("1.500,50" → 1500.5). */
export function parseBRL(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}
