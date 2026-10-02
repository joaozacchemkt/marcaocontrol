/**
 * Ferramentas do assistente — a ÚNICA porta de entrada dele no sistema.
 *
 * Regras (pra não virar fonte de bug):
 * - Nada de SQL livre: cada ação é uma função explícita, validada por Zod.
 * - Toda escrita reaproveita a regra de negócio das telas (recorrência,
 *   quitação, histórico) via helpers com `db` — chat e UI nunca divergem.
 * - Roda com o cliente do usuário logado (RLS vale igual à tela).
 * - Datas SEMPRE via `./time` (fuso de São Paulo; o servidor é UTC).
 * - kind:
 *     read    → só leitura
 *     write   → executa na hora e devolve como desfazer (`undo`)
 *     confirm → só prepara um resumo; executa quando o usuário confirmar
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { Db } from "@/lib/db";
import type { Json } from "@/integrations/supabase/types";
import { FINANCE_CATEGORIES, PAYMENT_METHODS } from "@/lib/finance-categories";
import { advanceFinancialRecurrence, type FinancialFrequency } from "@/lib/financial-recurrence";
import { setTransactionPaid } from "@/lib/finance-actions";
import { advanceRecurrence } from "@/lib/recurrence";
import { advanceReminderRecurrence } from "@/lib/reminders";
import { logActivity } from "@/lib/activity";
import { addDaysStr, instantSP, isDateStr, isTimeStr, splitInstantSP, todaySP } from "./time";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ToolCtx {
  db: Db;
  userId: string;
  conversationId: string;
}

/** Como desfazer uma ação `write`. Guardado em assistant_actions.undo. */
export type UndoSpec =
  | { op: "delete"; table: "tasks" | "reminders" | "events" | "contacts" | "assistant_memories"; id: string }
  | { op: "deleteMany"; table: "tasks"; ids: string[] }
  | { op: "deleteTransaction"; id: string; recurrenceId: string | null }
  | { op: "setPaid"; id: string; paid: boolean; paidDate: string | null; paymentMethod?: string | null }
  | { op: "restoreStatus"; table: "tasks" | "reminders"; id: string; status: string }
  | { op: "insertMemory"; fact: string };

export interface WriteOutcome {
  result: unknown;
  summary: string;
  undo: UndoSpec | null;
}

export interface ConfirmPreview {
  summary: string;
}

interface ToolBase {
  name: string;
  description: string;
  schema: z.ZodType;
}
export type ToolDef =
  | (ToolBase & { kind: "read"; run: (input: never, ctx: ToolCtx) => Promise<unknown> })
  | (ToolBase & { kind: "write"; run: (input: never, ctx: ToolCtx) => Promise<WriteOutcome> })
  | (ToolBase & {
      kind: "confirm";
      prepare: (input: never, ctx: ToolCtx) => Promise<ConfirmPreview>;
      commit: (input: never, ctx: ToolCtx) => Promise<WriteOutcome>;
    });

/** Erro "esperado" — a mensagem vai pro modelo, que corrige e tenta de novo. */
export class ToolError extends Error {}

function read<S extends z.ZodType>(t: {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolCtx) => Promise<unknown>;
}): ToolDef {
  return { kind: "read", ...t } as ToolDef;
}
function write<S extends z.ZodType>(t: {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolCtx) => Promise<WriteOutcome>;
}): ToolDef {
  return { kind: "write", ...t } as ToolDef;
}
function confirm<S extends z.ZodType>(t: {
  name: string;
  description: string;
  schema: S;
  prepare: (input: z.infer<S>, ctx: ToolCtx) => Promise<ConfirmPreview>;
  commit: (input: z.infer<S>, ctx: ToolCtx) => Promise<WriteOutcome>;
}): ToolDef {
  return { kind: "confirm", ...t } as ToolDef;
}

// ---------------------------------------------------------------------------
// Campos reutilizados
// ---------------------------------------------------------------------------

const zDate = z
  .string()
  .refine(isDateStr, "Data inválida: use AAAA-MM-DD")
  .describe("Data no formato AAAA-MM-DD");
const zTime = z.string().refine(isTimeStr, "Hora inválida: use HH:MM (24h)").describe("Hora HH:MM (24h)");
const zId = z.uuid().describe("id (uuid) retornado por uma busca ou pelo contexto");
const zMoney = z
  .number()
  .positive()
  .max(100_000_000)
  .describe("Valor em reais, número com ponto decimal (ex.: 4 ou 1500.5)");
const zText = (max: number) => z.string().trim().min(1).max(max);
const zPriority = z.enum(["baixa", "media", "alta"]);
const zOpenTaskStatus = z.enum(["nao_esquecer", "a_fazer", "em_andamento", "aguardando_terceiro"]);
const zFinancialFrequency = z.enum([
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
]) satisfies z.ZodType<FinancialFrequency>;
const zReminderFrequency = z.enum(["diario", "semanal", "quinzenal", "mensal", "anual"]);
const zLimit = z.number().int().min(1).max(100).optional().describe("Máximo de itens (padrão 30)");

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function brl(v: number | string | null | undefined): string {
  return brlFmt.format(Number(v) || 0);
}
function dmy(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Texto pra filtros ilike/or do PostgREST sem quebrar a sintaxe. */
function likeTerm(text: string): string {
  return `%${text.replace(/[%_,()\\*]/g, " ").trim()}%`;
}

function dbError(err: { message: string } | null | undefined, what: string): void {
  if (err) throw new Error(`${what}: ${err.message}`);
}

async function mustGet<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  notFound: string,
): Promise<NonNullable<T>> {
  const { data, error } = await query;
  dbError(error, "Erro ao ler do banco");
  if (!data) throw new ToolError(notFound);
  return data;
}

// ---------------------------------------------------------------------------
// FINANCEIRO
// ---------------------------------------------------------------------------

type TxRow = {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  due_date: string | null;
  status: "pendente" | "pago" | null;
  paid_date: string | null;
  payment_method: string | null;
  category: string | null;
  notes: string | null;
  project_id: string | null;
  contact_id: string | null;
  financial_recurrence_id: string | null;
  contacts?: { name: string } | null;
  projects?: { name: string } | null;
};
const TX_COLS =
  "id, type, description, amount, due_date, status, paid_date, payment_method, category, notes, project_id, contact_id, financial_recurrence_id, contacts(name), projects(name)";

function txOut(t: TxRow) {
  return {
    id: t.id,
    tipo: t.type,
    descricao: t.description,
    valor: Number(t.amount),
    vencimento: t.due_date?.slice(0, 10) ?? null,
    status: t.status,
    data_pagamento: t.paid_date,
    forma_pagamento: t.payment_method,
    categoria: t.category,
    contato: t.contacts?.name ?? null,
    projeto: t.projects?.name ?? null,
    recorrente: Boolean(t.financial_recurrence_id),
    observacoes: t.notes,
  };
}

const buscarLancamentos = read({
  name: "buscar_lancamentos",
  description:
    "Busca lançamentos financeiros (receitas e despesas) com filtros e devolve a lista + totais. Use para responder perguntas ('quanto gastei esse mês?', 'o que vence essa semana?'), para achar o id antes de editar/quitar/excluir, e para aprender padrões do histórico (ex.: como um gasto parecido foi registrado antes).",
  schema: z.object({
    texto: z.string().max(100).optional().describe("Trecho da descrição"),
    tipo: z.enum(["receita", "despesa"]).optional(),
    status: z.enum(["pendente", "pago"]).optional(),
    vencimento_de: zDate.optional(),
    vencimento_ate: zDate.optional(),
    pago_de: zDate.optional().describe("Data de pagamento a partir de (implica status pago)"),
    pago_ate: zDate.optional(),
    categoria: z.string().max(60).optional(),
    limite: zLimit,
  }),
  async run(i, { db }) {
    let q = db.from("financial_transactions").select(TX_COLS);
    if (i.texto) q = q.ilike("description", likeTerm(i.texto));
    if (i.tipo) q = q.eq("type", i.tipo);
    if (i.status) q = q.eq("status", i.status);
    if (i.vencimento_de) q = q.gte("due_date", i.vencimento_de);
    if (i.vencimento_ate) q = q.lte("due_date", i.vencimento_ate);
    if (i.pago_de) q = q.gte("paid_date", i.pago_de);
    if (i.pago_ate) q = q.lte("paid_date", i.pago_ate);
    if (i.categoria) q = q.eq("category", i.categoria);
    const { data, error } = await q.order("due_date", { ascending: false }).limit(1000);
    dbError(error, "Erro ao buscar lançamentos");
    const rows = (data ?? []) as unknown as TxRow[];
    const sum = (f: (t: TxRow) => boolean) => round2(rows.filter(f).reduce((a, t) => a + Number(t.amount), 0));
    return {
      total_encontrado: rows.length,
      totais: {
        receitas: sum((t) => t.type === "receita"),
        despesas: sum((t) => t.type === "despesa"),
        receitas_pendentes: sum((t) => t.type === "receita" && t.status !== "pago"),
        despesas_pendentes: sum((t) => t.type === "despesa" && t.status !== "pago"),
      },
      itens: rows.slice(0, i.limite ?? 30).map(txOut),
      observacao: rows.length > (i.limite ?? 30) ? "Lista cortada; os totais consideram todos." : undefined,
    };
  },
});

const listarContasFixas = read({
  name: "listar_contas_fixas",
  description: "Lista as recorrências financeiras (contas fixas e receitas que se repetem) ativas.",
  schema: z.object({}),
  async run(_i, { db }) {
    const { data, error } = await db
      .from("financial_recurrences")
      .select("id, description, type, amount, frequency, next_run, category, payment_method")
      .eq("active", true)
      .order("next_run");
    dbError(error, "Erro ao listar recorrências");
    return (data ?? []).map((r) => ({
      id: r.id,
      descricao: r.description,
      tipo: r.type,
      valor: Number(r.amount),
      frequencia: r.frequency,
      proximo_vencimento: r.next_run,
      categoria: r.category,
      forma_pagamento: r.payment_method,
    }));
  },
});

const registrarLancamento = write({
  name: "registrar_lancamento",
  description:
    "Registra uma receita ou despesa. Ex.: 'paguei 4 reais pro meu filho' → despesa de 4, pago=true, vencimento e data_pagamento = hoje. Se a pessoa disse que já pagou/recebeu, pago=true. Se é conta futura, pago=false com o vencimento.",
  schema: z.object({
    tipo: z.enum(["receita", "despesa"]),
    descricao: zText(200).describe("Descrição curta e clara, ex.: 'Mesada Pedrinho'"),
    valor: zMoney,
    vencimento: zDate.describe("Data de vencimento (se foi pago na hora, a própria data do pagamento)"),
    pago: z.boolean().describe("true se já foi pago/recebido"),
    data_pagamento: zDate.optional().describe("Quando foi pago; padrão hoje se pago=true"),
    forma_pagamento: z.enum(PAYMENT_METHODS).optional(),
    categoria: z.enum(FINANCE_CATEGORIES),
    contato_id: zId.optional(),
    projeto_id: zId.optional(),
    observacoes: z.string().max(1000).optional(),
    repete: zFinancialFrequency.optional().describe("Só se a pessoa disser que se repete (conta fixa)"),
  }),
  async run(i, { db, userId }) {
    const today = todaySP();
    const paidDate = i.pago ? (i.data_pagamento ?? today) : null;
    const base = {
      user_id: userId,
      description: i.descricao,
      amount: round2(i.valor),
      category: i.categoria,
      payment_method: i.forma_pagamento ?? null,
      project_id: i.projeto_id ?? null,
      contact_id: i.contato_id ?? null,
      type: i.tipo,
    };

    let recurrenceId: string | null = null;
    if (i.repete) {
      const { data: rec, error } = await db
        .from("financial_recurrences")
        .insert({
          ...base,
          frequency: i.repete,
          start_date: i.vencimento,
          next_run: i.vencimento,
        })
        .select("id")
        .single();
      dbError(error, "Erro ao criar a recorrência");
      recurrenceId = rec!.id;
    }

    const { data: created, error } = await db
      .from("financial_transactions")
      .insert({
        ...base,
        date: i.vencimento,
        due_date: i.vencimento,
        status: i.pago ? "pago" : "pendente",
        paid_date: paidDate,
        notes: i.observacoes || null,
        financial_recurrence_id: recurrenceId,
      })
      .select(TX_COLS)
      .single();
    if (error) {
      if (recurrenceId) await db.from("financial_recurrences").delete().eq("id", recurrenceId);
      throw new Error(`Erro ao registrar: ${error.message}`);
    }
    const tx = created as unknown as TxRow;

    if (tx.project_id) {
      await logActivity({
        db,
        userId,
        projectId: tx.project_id,
        type: "transaction_created",
        description: `Nova ${i.tipo}: "${tx.description}" (${brl(tx.amount)})`,
        entityType: "transaction",
        entityId: tx.id,
      });
    }
    // Mesma regra do formulário: recorrência que já nasce paga gera a próxima.
    if (recurrenceId && i.pago) await advanceFinancialRecurrence(recurrenceId, i.vencimento, db);

    const quando = i.pago
      ? `${i.tipo === "receita" ? "recebida" : "paga"} em ${dmy(paidDate)}`
      : `vence ${dmy(i.vencimento)}`;
    return {
      result: txOut(tx),
      summary: `${i.tipo === "receita" ? "Receita" : "Despesa"} registrada: ${tx.description} — ${brl(tx.amount)}, ${quando}${i.forma_pagamento ? `, ${i.forma_pagamento}` : ""}${i.repete ? ` (repete: ${i.repete})` : ""}`,
      undo: { op: "deleteTransaction", id: tx.id, recurrenceId },
    };
  },
});

const marcarLancamentoPago = write({
  name: "marcar_lancamento_pago",
  description:
    "Quita (pago=true) ou reabre (pago=false) um lançamento existente. Se for recorrente, a próxima ocorrência é gerada automaticamente ao quitar.",
  schema: z.object({
    id: zId,
    pago: z.boolean(),
    data_pagamento: zDate.optional().describe("Padrão: hoje"),
    forma_pagamento: z.enum(PAYMENT_METHODS).optional().describe("Como foi pago, se a pessoa disse"),
  }),
  async run(i, { db }) {
    const t = await mustGet(
      db.from("financial_transactions").select(TX_COLS).eq("id", i.id).maybeSingle(),
      "Lançamento não encontrado",
    );
    const tx = t as unknown as TxRow;
    const wasPaid = tx.status === "pago";
    if (wasPaid === i.pago && !(i.pago && i.data_pagamento && i.data_pagamento !== tx.paid_date)) {
      throw new ToolError(`O lançamento já está ${wasPaid ? "pago" : "pendente"}.`);
    }
    const paidDate = i.data_pagamento ?? todaySP();
    await setTransactionPaid(tx, i.pago, { db, paidDate });
    if (i.pago && i.forma_pagamento && i.forma_pagamento !== tx.payment_method) {
      const { error } = await db.from("financial_transactions").update({ payment_method: i.forma_pagamento }).eq("id", tx.id);
      dbError(error, "Erro ao gravar a forma de pagamento");
    }
    return {
      result: { ...txOut(tx), status: i.pago ? "pago" : "pendente", data_pagamento: i.pago ? paidDate : null },
      summary: i.pago
        ? `Quitado: ${tx.description} — ${brl(tx.amount)} em ${dmy(paidDate)}${i.forma_pagamento ? `, ${i.forma_pagamento}` : ""}`
        : `Reaberto como pendente: ${tx.description}`,
      undo: { op: "setPaid", id: tx.id, paid: wasPaid, paidDate: tx.paid_date, paymentMethod: tx.payment_method },
    };
  },
});

const editarLancamento = confirm({
  name: "editar_lancamento",
  description:
    "Altera campos de um lançamento existente (valor, descrição, vencimento, categoria etc.). Precisa de confirmação do usuário. Para quitar/reabrir use marcar_lancamento_pago.",
  schema: z.object({
    id: zId,
    descricao: zText(200).optional(),
    valor: zMoney.optional(),
    vencimento: zDate.optional(),
    data_pagamento: zDate.optional().describe("Só para lançamentos já pagos"),
    forma_pagamento: z.enum(PAYMENT_METHODS).nullable().optional(),
    categoria: z.enum(FINANCE_CATEGORIES).optional(),
    contato_id: zId.nullable().optional(),
    projeto_id: zId.nullable().optional(),
    observacoes: z.string().max(1000).nullable().optional(),
  }),
  async prepare(i, { db }) {
    const tx = (await mustGet(
      db.from("financial_transactions").select(TX_COLS).eq("id", i.id).maybeSingle(),
      "Lançamento não encontrado",
    )) as unknown as TxRow;
    const changes: string[] = [];
    if (i.descricao !== undefined && i.descricao !== tx.description) changes.push(`descrição "${tx.description}" → "${i.descricao}"`);
    if (i.valor !== undefined && round2(i.valor) !== Number(tx.amount)) changes.push(`valor ${brl(tx.amount)} → ${brl(i.valor)}`);
    if (i.vencimento !== undefined && i.vencimento !== tx.due_date?.slice(0, 10)) changes.push(`vencimento ${dmy(tx.due_date)} → ${dmy(i.vencimento)}`);
    if (i.data_pagamento !== undefined) {
      if (tx.status !== "pago") throw new ToolError("Lançamento está pendente; use marcar_lancamento_pago para quitar.");
      if (i.data_pagamento !== tx.paid_date) changes.push(`pagamento ${dmy(tx.paid_date)} → ${dmy(i.data_pagamento)}`);
    }
    if (i.forma_pagamento !== undefined && i.forma_pagamento !== tx.payment_method) changes.push(`forma ${tx.payment_method ?? "—"} → ${i.forma_pagamento ?? "—"}`);
    if (i.categoria !== undefined && i.categoria !== tx.category) changes.push(`categoria ${tx.category ?? "—"} → ${i.categoria}`);
    if (i.contato_id !== undefined && i.contato_id !== tx.contact_id) changes.push("contato alterado");
    if (i.projeto_id !== undefined && i.projeto_id !== tx.project_id) changes.push("projeto alterado");
    if (i.observacoes !== undefined && i.observacoes !== tx.notes) changes.push("observações alteradas");
    if (changes.length === 0) throw new ToolError("Nada muda em relação ao que já está salvo.");
    return { summary: `Editar "${tx.description}": ${changes.join("; ")}` };
  },
  async commit(i, { db }) {
    const tx = (await mustGet(
      db.from("financial_transactions").select(TX_COLS).eq("id", i.id).maybeSingle(),
      "Lançamento não encontrado (pode ter sido excluído)",
    )) as unknown as TxRow;
    const patch: Record<string, unknown> = {};
    if (i.descricao !== undefined) patch["description"] = i.descricao;
    if (i.valor !== undefined) patch["amount"] = round2(i.valor);
    if (i.vencimento !== undefined) {
      patch["due_date"] = i.vencimento;
      patch["date"] = i.vencimento; // `date` acompanha o vencimento
    }
    if (i.data_pagamento !== undefined && tx.status === "pago") patch["paid_date"] = i.data_pagamento;
    if (i.forma_pagamento !== undefined) patch["payment_method"] = i.forma_pagamento;
    if (i.categoria !== undefined) patch["category"] = i.categoria;
    if (i.contato_id !== undefined) patch["contact_id"] = i.contato_id;
    if (i.projeto_id !== undefined) patch["project_id"] = i.projeto_id;
    if (i.observacoes !== undefined) patch["notes"] = i.observacoes;
    const { error } = await db.from("financial_transactions").update(patch as never).eq("id", tx.id);
    dbError(error, "Erro ao salvar");
    // Mesma regra do formulário: a regra de recorrência acompanha a edição.
    if (tx.financial_recurrence_id) {
      const recPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (["description", "amount", "category", "project_id", "contact_id", "payment_method"].includes(k)) recPatch[k] = v;
      }
      if (Object.keys(recPatch).length > 0) {
        await db.from("financial_recurrences").update(recPatch as never).eq("id", tx.financial_recurrence_id);
      }
    }
    return { result: { id: tx.id, alterado: Object.keys(patch) }, summary: `Lançamento "${tx.description}" atualizado`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// TAREFAS
// ---------------------------------------------------------------------------

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  deadline: string | null;
  assigned_to: string | null;
  project_id: string | null;
  recurrence_id: string | null;
  waiting_for: string | null;
  projects?: { name: string } | null;
};
const TASK_COLS =
  "id, title, description, status, priority, deadline, assigned_to, project_id, recurrence_id, waiting_for, projects(name)";

async function memberNames(db: Db): Promise<Map<string, string>> {
  const { data } = await db.from("profiles").select("id, full_name");
  return new Map((data ?? []).map((p) => [p.id, p.full_name || "Sem nome"]));
}

function taskOut(t: TaskRow, names: Map<string, string>, today: string) {
  const prazo = splitInstantSP(t.deadline)?.date ?? null;
  return {
    id: t.id,
    titulo: t.title,
    status: t.status,
    prioridade: t.priority,
    prazo,
    atrasada: Boolean(prazo && prazo < today && t.status !== "concluido"),
    responsavel: t.assigned_to ? (names.get(t.assigned_to) ?? t.assigned_to) : null,
    projeto: t.projects?.name ?? null,
    aguardando: t.waiting_for,
    descricao: t.description,
  };
}

/** Prazo "dia sem hora": meio-dia de SP, igual ao formulário da tarefa. */
const deadlineOf = (date: string) => instantSP(date, "12:00");

const buscarTarefas = read({
  name: "buscar_tarefas",
  description:
    "Busca tarefas. Por padrão só as abertas (não concluídas). Use para responder 'o que tenho pra fazer', achar id antes de concluir/editar, ou ver o que está atrasado.",
  schema: z.object({
    texto: z.string().max(100).optional(),
    situacao: z.enum(["abertas", "concluidas", "todas"]).optional().describe("Padrão: abertas"),
    responsavel_id: zId.optional(),
    projeto_id: zId.optional(),
    prazo_ate: zDate.optional().describe("Só tarefas com prazo até esta data"),
    limite: zLimit,
  }),
  async run(i, { db }) {
    let q = db.from("tasks").select(TASK_COLS).is("parent_task_id", null);
    const situacao = i.situacao ?? "abertas";
    if (situacao === "abertas") q = q.neq("status", "concluido");
    if (situacao === "concluidas") q = q.eq("status", "concluido");
    if (i.texto) q = q.ilike("title", likeTerm(i.texto));
    if (i.responsavel_id) q = q.eq("assigned_to", i.responsavel_id);
    if (i.projeto_id) q = q.eq("project_id", i.projeto_id);
    if (i.prazo_ate) q = q.lte("deadline", instantSP(i.prazo_ate, "23:59"));
    const { data, error } = await q
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(i.limite ?? 30);
    dbError(error, "Erro ao buscar tarefas");
    const names = await memberNames(db);
    const today = todaySP();
    return ((data ?? []) as unknown as TaskRow[]).map((t) => taskOut(t, names, today));
  },
});

const criarTarefa = write({
  name: "criar_tarefa",
  description: "Cria uma tarefa. Use responsavel_id para delegar a alguém da equipe (ids no contexto).",
  schema: z.object({
    titulo: zText(200),
    descricao: z.string().max(2000).optional(),
    prazo: zDate.optional(),
    prioridade: zPriority.optional().describe("Padrão: media"),
    status: zOpenTaskStatus.optional().describe("Padrão: a_fazer"),
    responsavel_id: zId.optional(),
    projeto_id: zId.optional(),
    contato_id: zId.optional(),
  }),
  async run(i, { db, userId }) {
    const { data, error } = await db
      .from("tasks")
      .insert({
        user_id: userId,
        title: i.titulo,
        description: i.descricao || null,
        deadline: i.prazo ? deadlineOf(i.prazo) : null,
        priority: i.prioridade ?? "media",
        status: i.status ?? "a_fazer",
        assigned_to: i.responsavel_id ?? null,
        project_id: i.projeto_id ?? null,
        contact_id: i.contato_id ?? null,
      })
      .select(TASK_COLS)
      .single();
    dbError(error, "Erro ao criar tarefa");
    const t = data as unknown as TaskRow;
    const names = await memberNames(db);
    if (t.project_id) {
      await logActivity({
        db,
        userId,
        projectId: t.project_id,
        type: "task_created",
        description: `Nova tarefa: "${t.title}"`,
        entityType: "task",
        entityId: t.id,
      });
    }
    const quem = t.assigned_to ? ` para ${names.get(t.assigned_to) ?? "alguém"}` : "";
    return {
      result: taskOut(t, names, todaySP()),
      summary: `Tarefa criada${quem}: ${t.title}${i.prazo ? ` — prazo ${dmy(i.prazo)}` : ""}`,
      undo: { op: "delete", table: "tasks", id: t.id },
    };
  },
});

const criarTarefas = write({
  name: "criar_tarefas",
  description:
    "Cria VÁRIAS tarefas de uma vez (2 a 30) — use sempre que houver uma lista (ata de reunião, pendências, plano). Tudo vira um único cartão com um único Desfazer. Prioridade alta/média/baixa e responsável podem variar por item.",
  schema: z.object({
    projeto_id: zId.optional().describe("Projeto de todas as tarefas, se houver"),
    tarefas: z
      .array(
        z.object({
          titulo: zText(200),
          descricao: z.string().max(2000).optional(),
          prazo: zDate.optional(),
          prioridade: zPriority.optional(),
          responsavel_id: zId.optional(),
        }),
      )
      .min(2)
      .max(30),
  }),
  async run(i, { db, userId }) {
    const { data, error } = await db
      .from("tasks")
      .insert(
        i.tarefas.map((t) => ({
          user_id: userId,
          title: t.titulo,
          description: t.descricao || null,
          deadline: t.prazo ? deadlineOf(t.prazo) : null,
          priority: t.prioridade ?? "media",
          status: "a_fazer" as const,
          assigned_to: t.responsavel_id ?? null,
          project_id: i.projeto_id ?? null,
        })),
      )
      .select("id, title");
    dbError(error, "Erro ao criar tarefas");
    const rows = data ?? [];
    if (i.projeto_id) {
      await logActivity({
        db,
        userId,
        projectId: i.projeto_id,
        type: "task_created",
        description: `${rows.length} tarefas criadas pelo assistente`,
        entityType: "task",
        entityId: rows[0]?.id ?? i.projeto_id,
      });
    }
    return {
      result: { criadas: rows.length, ids: rows.map((r) => r.id) },
      summary: `${rows.length} tarefas criadas`,
      undo: { op: "deleteMany", table: "tasks", ids: rows.map((r) => r.id) },
    };
  },
});

const concluirTarefa = write({
  name: "concluir_tarefa",
  description: "Conclui (concluida=true) ou reabre (concluida=false) uma tarefa. Tarefa recorrente gera a próxima ao concluir.",
  schema: z.object({ id: zId, concluida: z.boolean() }),
  async run(i, { db, userId }) {
    const t = (await mustGet(
      db.from("tasks").select(TASK_COLS).eq("id", i.id).maybeSingle(),
      "Tarefa não encontrada",
    )) as unknown as TaskRow;
    const prev = t.status ?? "a_fazer";
    if ((prev === "concluido") === i.concluida) {
      throw new ToolError(`A tarefa já está ${i.concluida ? "concluída" : "aberta"}.`);
    }
    const next = i.concluida ? "concluido" : "a_fazer";
    const { error } = await db.from("tasks").update({ status: next }).eq("id", t.id);
    dbError(error, "Erro ao atualizar tarefa");
    if (t.project_id) {
      await logActivity({
        db,
        userId,
        projectId: t.project_id,
        type: i.concluida ? "task_completed" : "task_reopened",
        description: `Tarefa "${t.title}" ${i.concluida ? "concluída" : "reaberta"} pelo assistente`,
        entityType: "task",
        entityId: t.id,
      });
    }
    if (i.concluida && t.recurrence_id) await advanceRecurrence(t.recurrence_id, db);
    return {
      result: { id: t.id, status: next },
      summary: `${i.concluida ? "Concluída" : "Reaberta"}: ${t.title}`,
      undo: { op: "restoreStatus", table: "tasks", id: t.id, status: prev },
    };
  },
});

const editarTarefa = confirm({
  name: "editar_tarefa",
  description: "Altera uma tarefa (título, prazo, prioridade, status, responsável, projeto). Precisa de confirmação. Para concluir use concluir_tarefa.",
  schema: z.object({
    id: zId,
    titulo: zText(200).optional(),
    descricao: z.string().max(2000).nullable().optional(),
    prazo: zDate.nullable().optional(),
    prioridade: zPriority.optional(),
    status: zOpenTaskStatus.optional(),
    responsavel_id: zId.nullable().optional(),
    projeto_id: zId.nullable().optional(),
    aguardando: z.string().max(200).nullable().optional().describe("De quem/que a tarefa está aguardando"),
  }),
  async prepare(i, { db }) {
    const t = (await mustGet(
      db.from("tasks").select(TASK_COLS).eq("id", i.id).maybeSingle(),
      "Tarefa não encontrada",
    )) as unknown as TaskRow;
    const names = await memberNames(db);
    const c: string[] = [];
    const prazoAtual = splitInstantSP(t.deadline)?.date ?? null;
    if (i.titulo !== undefined && i.titulo !== t.title) c.push(`título → "${i.titulo}"`);
    if (i.descricao !== undefined && i.descricao !== t.description) c.push("descrição alterada");
    if (i.prazo !== undefined && i.prazo !== prazoAtual) c.push(`prazo ${dmy(prazoAtual)} → ${dmy(i.prazo)}`);
    if (i.prioridade !== undefined && i.prioridade !== t.priority) c.push(`prioridade ${t.priority} → ${i.prioridade}`);
    if (i.status !== undefined && i.status !== t.status) c.push(`status ${t.status} → ${i.status}`);
    if (i.responsavel_id !== undefined && i.responsavel_id !== t.assigned_to) {
      const de = t.assigned_to ? (names.get(t.assigned_to) ?? "?") : "ninguém";
      const para = i.responsavel_id ? (names.get(i.responsavel_id) ?? "?") : "ninguém";
      c.push(`responsável ${de} → ${para}`);
    }
    if (i.projeto_id !== undefined && i.projeto_id !== t.project_id) c.push("projeto alterado");
    if (i.aguardando !== undefined && i.aguardando !== t.waiting_for) c.push(`aguardando → ${i.aguardando ?? "—"}`);
    if (c.length === 0) throw new ToolError("Nada muda em relação ao que já está salvo.");
    return { summary: `Editar tarefa "${t.title}": ${c.join("; ")}` };
  },
  async commit(i, { db, userId }) {
    const t = (await mustGet(
      db.from("tasks").select(TASK_COLS).eq("id", i.id).maybeSingle(),
      "Tarefa não encontrada (pode ter sido excluída)",
    )) as unknown as TaskRow;
    const patch: Record<string, unknown> = {};
    if (i.titulo !== undefined) patch["title"] = i.titulo;
    if (i.descricao !== undefined) patch["description"] = i.descricao;
    if (i.prazo !== undefined) patch["deadline"] = i.prazo ? deadlineOf(i.prazo) : null;
    if (i.prioridade !== undefined) patch["priority"] = i.prioridade;
    if (i.status !== undefined) patch["status"] = i.status;
    if (i.responsavel_id !== undefined) patch["assigned_to"] = i.responsavel_id;
    if (i.projeto_id !== undefined) patch["project_id"] = i.projeto_id;
    if (i.aguardando !== undefined) patch["waiting_for"] = i.aguardando;
    const { error } = await db.from("tasks").update(patch as never).eq("id", t.id);
    dbError(error, "Erro ao salvar tarefa");
    const projectId = (i.projeto_id !== undefined ? i.projeto_id : t.project_id) ?? null;
    if (i.responsavel_id !== undefined && i.responsavel_id !== t.assigned_to && projectId) {
      const names = await memberNames(db);
      await logActivity({
        db,
        userId,
        projectId,
        type: "task_assigned",
        description: `"${i.titulo ?? t.title}" atribuída a ${i.responsavel_id ? (names.get(i.responsavel_id) ?? "alguém") : "ninguém"}`,
        entityType: "task",
        entityId: t.id,
      });
    }
    return { result: { id: t.id, alterado: Object.keys(patch) }, summary: `Tarefa "${t.title}" atualizada`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// LEMBRETES
// ---------------------------------------------------------------------------

type ReminderRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  notes: string | null;
  remind_at: string;
  channel: string;
  priority: string;
  category: string | null;
  status: string;
  recurrence_frequency: string | null;
  recurrence_interval: number;
  recurrence_end_date: string | null;
};

function reminderOut(r: ReminderRow) {
  const at = splitInstantSP(r.remind_at);
  return {
    id: r.id,
    titulo: r.title,
    data: at?.date ?? null,
    hora: at?.time ?? null,
    status: r.status === "enviado" ? "concluido" : r.status,
    prioridade: r.priority,
    categoria: r.category,
    repete: r.recurrence_frequency,
    observacoes: r.notes,
  };
}

const buscarLembretes = read({
  name: "buscar_lembretes",
  description: "Busca lembretes. Padrão: pendentes, ordenados pela data.",
  schema: z.object({
    texto: z.string().max(100).optional(),
    situacao: z.enum(["pendentes", "concluidos", "todos"]).optional(),
    ate: zDate.optional().describe("Só lembretes até esta data"),
    limite: zLimit,
  }),
  async run(i, { db }) {
    let q = db.from("reminders").select("*");
    const s = i.situacao ?? "pendentes";
    if (s === "pendentes") q = q.eq("status", "pendente");
    if (s === "concluidos") q = q.eq("status", "enviado");
    if (i.texto) q = q.ilike("title", likeTerm(i.texto));
    if (i.ate) q = q.lte("remind_at", instantSP(i.ate, "23:59"));
    const { data, error } = await q.order("remind_at").limit(i.limite ?? 30);
    dbError(error, "Erro ao buscar lembretes");
    return ((data ?? []) as ReminderRow[]).map(reminderOut);
  },
});

const criarLembrete = write({
  name: "criar_lembrete",
  description: "Cria um lembrete numa data e hora (horário de Brasília). Se a pessoa não disser a hora, use 09:00.",
  schema: z.object({
    titulo: zText(200),
    data: zDate,
    hora: zTime,
    prioridade: zPriority.optional(),
    categoria: z.string().max(60).optional(),
    observacoes: z.string().max(1000).optional(),
    repete: zReminderFrequency.optional(),
    repete_ate: zDate.optional(),
  }),
  async run(i, { db, userId }) {
    const { data, error } = await db
      .from("reminders")
      .insert({
        user_id: userId,
        title: i.titulo,
        remind_at: instantSP(i.data, i.hora),
        priority: i.prioridade ?? "media",
        category: i.categoria || null,
        notes: i.observacoes || null,
        channel: "sistema",
        status: "pendente",
        recurrence_frequency: i.repete ?? null,
        recurrence_interval: 1,
        recurrence_end_date: i.repete ? (i.repete_ate ?? null) : null,
      })
      .select("*")
      .single();
    dbError(error, "Erro ao criar lembrete");
    const r = data as ReminderRow;
    return {
      result: reminderOut(r),
      summary: `Lembrete criado: ${r.title} — ${dmy(i.data)} às ${i.hora}${i.repete ? ` (repete: ${i.repete})` : ""}`,
      undo: { op: "delete", table: "reminders", id: r.id },
    };
  },
});

const concluirLembrete = write({
  name: "concluir_lembrete",
  description: "Marca um lembrete como concluído. Se for recorrente, a próxima ocorrência é criada.",
  schema: z.object({ id: zId }),
  async run(i, { db }) {
    const r = (await mustGet(
      db.from("reminders").select("*").eq("id", i.id).maybeSingle(),
      "Lembrete não encontrado",
    )) as ReminderRow;
    if (r.status === "enviado") throw new ToolError("O lembrete já está concluído.");
    const { error } = await db.from("reminders").update({ status: "enviado" }).eq("id", r.id);
    dbError(error, "Erro ao concluir lembrete");
    if (r.recurrence_frequency) await advanceReminderRecurrence(r, db);
    return {
      result: { id: r.id, status: "concluido" },
      summary: `Lembrete concluído: ${r.title}`,
      undo: { op: "restoreStatus", table: "reminders", id: r.id, status: r.status },
    };
  },
});

const editarLembrete = confirm({
  name: "editar_lembrete",
  description: "Altera um lembrete (título, data, hora, prioridade...). Precisa de confirmação.",
  schema: z.object({
    id: zId,
    titulo: zText(200).optional(),
    data: zDate.optional(),
    hora: zTime.optional(),
    prioridade: zPriority.optional(),
    categoria: z.string().max(60).nullable().optional(),
    observacoes: z.string().max(1000).nullable().optional(),
  }),
  async prepare(i, { db }) {
    const r = (await mustGet(
      db.from("reminders").select("*").eq("id", i.id).maybeSingle(),
      "Lembrete não encontrado",
    )) as ReminderRow;
    const at = splitInstantSP(r.remind_at)!;
    const c: string[] = [];
    if (i.titulo !== undefined && i.titulo !== r.title) c.push(`título → "${i.titulo}"`);
    const newDate = i.data ?? at.date;
    const newTime = i.hora ?? at.time;
    if (newDate !== at.date || newTime !== at.time) c.push(`quando ${dmy(at.date)} ${at.time} → ${dmy(newDate)} ${newTime}`);
    if (i.prioridade !== undefined && i.prioridade !== r.priority) c.push(`prioridade → ${i.prioridade}`);
    if (i.categoria !== undefined && i.categoria !== r.category) c.push(`categoria → ${i.categoria ?? "—"}`);
    if (i.observacoes !== undefined && i.observacoes !== r.notes) c.push("observações alteradas");
    if (c.length === 0) throw new ToolError("Nada muda em relação ao que já está salvo.");
    return { summary: `Editar lembrete "${r.title}": ${c.join("; ")}` };
  },
  async commit(i, { db }) {
    const r = (await mustGet(
      db.from("reminders").select("*").eq("id", i.id).maybeSingle(),
      "Lembrete não encontrado (pode ter sido excluído)",
    )) as ReminderRow;
    const at = splitInstantSP(r.remind_at)!;
    const patch: Record<string, unknown> = {};
    if (i.titulo !== undefined) patch["title"] = i.titulo;
    if (i.data !== undefined || i.hora !== undefined) patch["remind_at"] = instantSP(i.data ?? at.date, i.hora ?? at.time);
    if (i.prioridade !== undefined) patch["priority"] = i.prioridade;
    if (i.categoria !== undefined) patch["category"] = i.categoria;
    if (i.observacoes !== undefined) patch["notes"] = i.observacoes;
    const { error } = await db.from("reminders").update(patch as never).eq("id", r.id);
    dbError(error, "Erro ao salvar lembrete");
    return { result: { id: r.id, alterado: Object.keys(patch) }, summary: `Lembrete "${r.title}" atualizado`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// AGENDA
// ---------------------------------------------------------------------------

type EventRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  description: string | null;
  status: string;
  project_id: string | null;
  contact_id: string | null;
  contacts?: { name: string } | null;
};
const EVENT_COLS = "id, title, start_time, end_time, location, description, status, project_id, contact_id, contacts(name)";

function eventOut(e: EventRow) {
  const s = splitInstantSP(e.start_time);
  const f = splitInstantSP(e.end_time);
  return {
    id: e.id,
    titulo: e.title,
    data: s?.date ?? null,
    inicio: s?.time ?? null,
    fim: f?.time ?? null,
    local: e.location,
    contato: e.contacts?.name ?? null,
    status: e.status,
    descricao: e.description,
  };
}

const buscarAgenda = read({
  name: "buscar_agenda",
  description: "Lista compromissos da agenda entre duas datas (inclusive).",
  schema: z.object({ de: zDate, ate: zDate, texto: z.string().max(100).optional() }),
  async run(i, { db }) {
    let q = db
      .from("events")
      .select(EVENT_COLS)
      .gte("start_time", instantSP(i.de, "00:00"))
      .lt("start_time", instantSP(addDaysStr(i.ate, 1), "00:00"));
    if (i.texto) q = q.ilike("title", likeTerm(i.texto));
    const { data, error } = await q.order("start_time").limit(100);
    dbError(error, "Erro ao buscar agenda");
    return ((data ?? []) as unknown as EventRow[]).map(eventOut);
  },
});

const criarCompromisso = write({
  name: "criar_compromisso",
  description: "Agenda um compromisso (reunião, consulta, visita) com data e hora de Brasília.",
  schema: z.object({
    titulo: zText(200),
    data: zDate,
    hora_inicio: zTime,
    hora_fim: zTime.optional(),
    local: z.string().max(200).optional(),
    descricao: z.string().max(2000).optional(),
    contato_id: zId.optional(),
    projeto_id: zId.optional(),
  }),
  async run(i, { db, userId }) {
    if (i.hora_fim && i.hora_fim <= i.hora_inicio) throw new ToolError("hora_fim precisa ser depois de hora_inicio.");
    const { data, error } = await db
      .from("events")
      .insert({
        user_id: userId,
        title: i.titulo,
        start_time: instantSP(i.data, i.hora_inicio),
        end_time: i.hora_fim ? instantSP(i.data, i.hora_fim) : null,
        location: i.local || null,
        description: i.descricao || null,
        contact_id: i.contato_id ?? null,
        project_id: i.projeto_id ?? null,
      })
      .select(EVENT_COLS)
      .single();
    dbError(error, "Erro ao criar compromisso");
    const e = data as unknown as EventRow;
    if (e.project_id) {
      await logActivity({
        db,
        userId,
        projectId: e.project_id,
        type: "event_created",
        description: `Novo compromisso agendado: "${e.title}"`,
        entityType: "event",
        entityId: e.id,
      });
    }
    return {
      result: eventOut(e),
      summary: `Compromisso agendado: ${e.title} — ${dmy(i.data)} às ${i.hora_inicio}${i.local ? ` (${i.local})` : ""}`,
      undo: { op: "delete", table: "events", id: e.id },
    };
  },
});

const editarCompromisso = confirm({
  name: "editar_compromisso",
  description: "Altera um compromisso (remarcar data/hora, título, local). Precisa de confirmação.",
  schema: z.object({
    id: zId,
    titulo: zText(200).optional(),
    data: zDate.optional(),
    hora_inicio: zTime.optional(),
    hora_fim: zTime.nullable().optional(),
    local: z.string().max(200).nullable().optional(),
    descricao: z.string().max(2000).nullable().optional(),
  }),
  async prepare(i, { db }) {
    const e = (await mustGet(
      db.from("events").select(EVENT_COLS).eq("id", i.id).maybeSingle(),
      "Compromisso não encontrado",
    )) as unknown as EventRow;
    const s = splitInstantSP(e.start_time)!;
    const c: string[] = [];
    if (i.titulo !== undefined && i.titulo !== e.title) c.push(`título → "${i.titulo}"`);
    const nd = i.data ?? s.date;
    const nt = i.hora_inicio ?? s.time;
    if (nd !== s.date || nt !== s.time) c.push(`${dmy(s.date)} ${s.time} → ${dmy(nd)} ${nt}`);
    if (i.hora_fim !== undefined) c.push(`término → ${i.hora_fim ?? "sem horário"}`);
    if (i.local !== undefined && i.local !== e.location) c.push(`local → ${i.local ?? "—"}`);
    if (i.descricao !== undefined && i.descricao !== e.description) c.push("descrição alterada");
    if (c.length === 0) throw new ToolError("Nada muda em relação ao que já está salvo.");
    return { summary: `Editar compromisso "${e.title}": ${c.join("; ")}` };
  },
  async commit(i, { db }) {
    const e = (await mustGet(
      db.from("events").select(EVENT_COLS).eq("id", i.id).maybeSingle(),
      "Compromisso não encontrado (pode ter sido excluído)",
    )) as unknown as EventRow;
    const s = splitInstantSP(e.start_time)!;
    const f = splitInstantSP(e.end_time);
    const nd = i.data ?? s.date;
    const patch: Record<string, unknown> = {};
    if (i.titulo !== undefined) patch["title"] = i.titulo;
    if (i.data !== undefined || i.hora_inicio !== undefined) patch["start_time"] = instantSP(nd, i.hora_inicio ?? s.time);
    if (i.hora_fim !== undefined) patch["end_time"] = i.hora_fim ? instantSP(nd, i.hora_fim) : null;
    else if (i.data !== undefined && f) patch["end_time"] = instantSP(nd, f.time); // mantém a duração no novo dia
    if (i.local !== undefined) patch["location"] = i.local;
    if (i.descricao !== undefined) patch["description"] = i.descricao;
    const { error } = await db.from("events").update(patch as never).eq("id", e.id);
    dbError(error, "Erro ao salvar compromisso");
    return { result: { id: e.id, alterado: Object.keys(patch) }, summary: `Compromisso "${e.title}" atualizado`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// CONTATOS
// ---------------------------------------------------------------------------

const buscarContatos = read({
  name: "buscar_contatos",
  description: "Procura contatos por nome, empresa ou categoria. Use para achar o contato_id antes de vincular.",
  schema: z.object({ texto: zText(100), limite: zLimit }),
  async run(i, { db }) {
    const term = likeTerm(i.texto);
    const { data, error } = await db
      .from("contacts")
      .select("id, name, company, role, phone, whatsapp, email, category, notes")
      .or(`name.ilike.${term},company.ilike.${term},category.ilike.${term}`)
      .order("name")
      .limit(i.limite ?? 20);
    dbError(error, "Erro ao buscar contatos");
    return (data ?? []).map((c) => ({
      id: c.id,
      nome: c.name,
      empresa: c.company,
      cargo: c.role,
      telefone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      categoria: c.category,
      observacoes: c.notes,
    }));
  },
});

const criarContato = write({
  name: "criar_contato",
  description: "Cadastra um contato. Antes, confira com buscar_contatos se ele já não existe.",
  schema: z.object({
    nome: zText(200),
    telefone: z.string().max(40).optional(),
    whatsapp: z.string().max(40).optional(),
    email: z.email().optional(),
    empresa: z.string().max(200).optional(),
    cargo: z.string().max(100).optional(),
    categoria: z.string().max(60).optional(),
    observacoes: z.string().max(2000).optional(),
  }),
  async run(i, { db, userId }) {
    const { data, error } = await db
      .from("contacts")
      .insert({
        user_id: userId,
        name: i.nome,
        phone: i.telefone || null,
        whatsapp: i.whatsapp || null,
        email: i.email || null,
        company: i.empresa || null,
        role: i.cargo || null,
        category: i.categoria || null,
        notes: i.observacoes || null,
      })
      .select("id, name")
      .single();
    dbError(error, "Erro ao criar contato");
    return {
      result: { id: data!.id, nome: data!.name },
      summary: `Contato cadastrado: ${data!.name}`,
      undo: { op: "delete", table: "contacts", id: data!.id },
    };
  },
});

// ---------------------------------------------------------------------------
// EXCLUSÃO (sempre com confirmação — convenção do app)
// ---------------------------------------------------------------------------

const DELETE_TARGETS = {
  lancamento: { table: "financial_transactions", label: "description", noun: "lançamento" },
  tarefa: { table: "tasks", label: "title", noun: "tarefa" },
  lembrete: { table: "reminders", label: "title", noun: "lembrete" },
  compromisso: { table: "events", label: "title", noun: "compromisso" },
  contato: { table: "contacts", label: "name", noun: "contato" },
} as const;

async function deleteTargetLabel(db: Db, tipo: keyof typeof DELETE_TARGETS, id: string): Promise<string> {
  const t = DELETE_TARGETS[tipo];
  const row = await mustGet(
    db.from(t.table).select(`id, ${t.label}`).eq("id", id).maybeSingle() as unknown as PromiseLike<{
      data: Record<string, string> | null;
      error: { message: string } | null;
    }>,
    `${t.noun} não encontrado`,
  );
  return row[t.label] ?? id;
}

const excluirRegistro = confirm({
  name: "excluir_registro",
  description: "Exclui um lançamento, tarefa, lembrete, compromisso ou contato. Sempre pede confirmação ao usuário.",
  schema: z.object({ tipo: z.enum(["lancamento", "tarefa", "lembrete", "compromisso", "contato"]), id: zId }),
  async prepare(i, { db }) {
    const label = await deleteTargetLabel(db, i.tipo, i.id);
    let extra = "";
    if (i.tipo === "lancamento") {
      const { data } = await db.from("financial_transactions").select("amount, due_date").eq("id", i.id).maybeSingle();
      if (data) extra = ` (${brl(data.amount)}, vence ${dmy(data.due_date)})`;
    }
    return { summary: `Excluir ${DELETE_TARGETS[i.tipo].noun} "${label}"${extra}. Não dá para desfazer.` };
  },
  async commit(i, { db }) {
    const label = await deleteTargetLabel(db, i.tipo, i.id);
    const { error } = await db.from(DELETE_TARGETS[i.tipo].table).delete().eq("id", i.id);
    dbError(error, "Erro ao excluir");
    return { result: { excluido: true }, summary: `Excluído: ${label}`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// MEMÓRIA E FEEDBACK
// ---------------------------------------------------------------------------

const lembrarFato = write({
  name: "lembrar_fato",
  description:
    "Guarda um fato duradouro útil para as próximas conversas (quem é quem, preferências, padrões: 'Pedrinho é o filho mais novo do Marcus', 'mesada do Pedrinho é paga em Pix'). Não use para dados que já têm lugar no sistema (contas, tarefas).",
  schema: z.object({ fato: zText(300) }),
  async run(i, { db, userId }) {
    const { data, error } = await db
      .from("assistant_memories")
      .insert({ user_id: userId, fact: i.fato })
      .select("id")
      .single();
    dbError(error, "Erro ao guardar");
    return {
      result: { id: data!.id },
      summary: `Anotado para as próximas vezes: ${i.fato}`,
      undo: { op: "delete", table: "assistant_memories", id: data!.id },
    };
  },
});

const esquecerFato = write({
  name: "esquecer_fato",
  description: "Apaga um fato guardado (ids aparecem no contexto, em 'Fatos aprendidos'). Use quando o fato estiver errado ou desatualizado.",
  schema: z.object({ id: zId }),
  async run(i, { db }) {
    const m = (await mustGet(
      db.from("assistant_memories").select("id, fact").eq("id", i.id).maybeSingle(),
      "Fato não encontrado",
    )) as { id: string; fact: string };
    const { error } = await db.from("assistant_memories").delete().eq("id", i.id);
    dbError(error, "Erro ao apagar");
    return { result: { ok: true }, summary: `Esquecido: ${m.fact}`, undo: { op: "insertMemory", fact: m.fact } };
  },
});

const registrarFeedback = write({
  name: "registrar_feedback",
  description:
    "Registra um problema (bug), sugestão ou elogio sobre o app para o João analisar. Use quando a pessoa reclamar que algo não funciona, pedir uma melhoria ou quando você mesmo encontrar um erro do sistema.",
  schema: z.object({
    tipo: z.enum(["bug", "sugestao", "elogio", "outro"]),
    descricao: zText(2000).describe("O que aconteceu/o que a pessoa quer, com detalhes para reproduzir"),
    tela: z.string().max(100).optional().describe("Tela/módulo envolvido"),
  }),
  async run(i, { db, userId }) {
    const { error } = await db
      .from("app_feedback")
      .insert({ user_id: userId, kind: i.tipo, description: i.descricao, screen: i.tela ?? null });
    dbError(error, "Erro ao registrar");
    const nome = { bug: "Problema", sugestao: "Sugestão", elogio: "Elogio", outro: "Recado" }[i.tipo];
    return { result: { ok: true }, summary: `${nome} registrado para o João: ${i.descricao.slice(0, 120)}`, undo: null };
  },
});

// ---------------------------------------------------------------------------
// Registro + execução
// ---------------------------------------------------------------------------

export const TOOLS: readonly ToolDef[] = [
  buscarLancamentos,
  listarContasFixas,
  registrarLancamento,
  marcarLancamentoPago,
  editarLancamento,
  buscarTarefas,
  criarTarefa,
  criarTarefas,
  concluirTarefa,
  editarTarefa,
  buscarLembretes,
  criarLembrete,
  concluirLembrete,
  editarLembrete,
  buscarAgenda,
  criarCompromisso,
  editarCompromisso,
  buscarContatos,
  criarContato,
  excluirRegistro,
  lembrarFato,
  esquecerFato,
  registrarFeedback,
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
export function getTool(name: string): ToolDef | undefined {
  return BY_NAME.get(name);
}

/** JSON Schema de cada ferramenta, no formato da API (ordem fixa = cache estável). */
export function toolSchemas(): Anthropic.Beta.BetaTool[] {
  return TOOLS.map((t) => {
    const { $schema: _ignored, type: _type, ...schema } = z.toJSONSchema(t.schema, { io: "input" }) as Record<
      string,
      unknown
    >;
    return { name: t.name, description: t.description, input_schema: { type: "object" as const, ...schema } };
  });
}

/** Valida a entrada da ferramenta; erro vira mensagem legível pro modelo. */
export function parseToolInput(tool: ToolDef, input: unknown): { ok: true; data: never } | { ok: false; error: string } {
  const r = tool.schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data as never };
  return {
    ok: false,
    error: `Entrada inválida: ${r.error.issues.map((x) => `${x.path.join(".") || "(raiz)"}: ${x.message}`).join("; ")}`,
  };
}

/** Desfaz uma ação `write` (determinístico — sem passar pelo modelo). */
export async function runUndo(spec: UndoSpec, { db, userId }: ToolCtx): Promise<void> {
  switch (spec.op) {
    case "delete": {
      const { error } = await db.from(spec.table).delete().eq("id", spec.id);
      dbError(error, "Erro ao desfazer");
      return;
    }
    case "deleteMany": {
      const { error } = await db.from(spec.table).delete().in("id", spec.ids);
      dbError(error, "Erro ao desfazer");
      return;
    }
    case "deleteTransaction": {
      if (spec.recurrenceId) {
        // A série inteira nasceu nesta ação (inclusive ocorrências já geradas).
        const { error } = await db.from("financial_transactions").delete().eq("financial_recurrence_id", spec.recurrenceId);
        dbError(error, "Erro ao desfazer");
        const { error: e2 } = await db.from("financial_recurrences").delete().eq("id", spec.recurrenceId);
        dbError(e2, "Erro ao desfazer");
      }
      const { error } = await db.from("financial_transactions").delete().eq("id", spec.id);
      dbError(error, "Erro ao desfazer");
      return;
    }
    case "setPaid": {
      const t = await mustGet(
        db.from("financial_transactions").select("id, due_date, financial_recurrence_id").eq("id", spec.id).maybeSingle(),
        "Lançamento não existe mais",
      );
      await setTransactionPaid(t, spec.paid, spec.paidDate ? { db, paidDate: spec.paidDate } : { db });
      if (spec.paymentMethod !== undefined) {
        await db.from("financial_transactions").update({ payment_method: spec.paymentMethod }).eq("id", spec.id);
      }
      return;
    }
    case "restoreStatus": {
      const { error } = await db
        .from(spec.table)
        .update({ status: spec.status } as never)
        .eq("id", spec.id);
      dbError(error, "Erro ao desfazer");
      return;
    }
    case "insertMemory": {
      const { error } = await db.from("assistant_memories").insert({ user_id: userId, fact: spec.fact });
      dbError(error, "Erro ao desfazer");
      return;
    }
  }
}

export type { Json };
