/**
 * Retrato da situação agora (financeiro, tarefas, agenda, lembretes).
 *
 * Uma função só, usada em dois lugares — por isso nunca divergem:
 * - na tela do assistente, como "Resumo do dia" (navegador, sem IA);
 * - no servidor, como contexto automático de cada mensagem pro modelo.
 * Datas pelo fuso de São Paulo (vale no navegador e no servidor UTC).
 */
import type { Db } from "@/lib/db";
import { addDaysStr, instantSP, splitInstantSP, todaySP } from "./time";

export interface SnapshotItem {
  label: string;
  amount?: number;
  date?: string;
  time?: string;
}
export interface Snapshot {
  today: string;
  pagarAtrasado: { count: number; total: number; items: SnapshotItem[] };
  pagarSemana: { count: number; total: number; items: SnapshotItem[] };
  receberAtrasado: { count: number; total: number };
  receberSemana: { count: number; total: number };
  tarefasAtrasadas: { count: number; minhas: number; items: SnapshotItem[] };
  tarefasHoje: { count: number; items: SnapshotItem[] };
  agendaHoje: SnapshotItem[];
  lembretesHoje: { count: number; atrasados: number; items: SnapshotItem[] };
}

const sumOf = (rows: { amount: number }[]) => Math.round(rows.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100;

export async function getSnapshot(db: Db, userId: string): Promise<Snapshot> {
  const today = todaySP();
  const in7 = addDaysStr(today, 7);
  const dayStart = instantSP(today, "00:00");
  const dayEnd = instantSP(addDaysStr(today, 1), "00:00");

  const [pend, tasks, events, reminders] = await Promise.all([
    db
      .from("financial_transactions")
      .select("description, amount, type, due_date")
      .eq("status", "pendente")
      .lte("due_date", in7)
      .order("due_date"),
    db
      .from("tasks")
      .select("title, deadline, assigned_to, status")
      .neq("status", "concluido")
      .is("parent_task_id", null)
      .not("deadline", "is", null)
      .lt("deadline", dayEnd)
      .order("deadline"),
    db.from("events").select("title, start_time").gte("start_time", dayStart).lt("start_time", dayEnd).order("start_time"),
    db
      .from("reminders")
      .select("title, remind_at")
      .eq("status", "pendente")
      .lt("remind_at", dayEnd)
      .order("remind_at"),
  ]);

  const tx = (pend.data ?? []).map((t) => ({ ...t, due: String(t.due_date ?? "").slice(0, 10) }));
  const pagarAtr = tx.filter((t) => t.type === "despesa" && t.due < today);
  const pagarSem = tx.filter((t) => t.type === "despesa" && t.due >= today);
  const recAtr = tx.filter((t) => t.type === "receita" && t.due < today);
  const recSem = tx.filter((t) => t.type === "receita" && t.due >= today);

  const taskRows = (tasks.data ?? []).map((t) => ({ ...t, day: splitInstantSP(t.deadline)?.date ?? "" }));
  const atrasadas = taskRows.filter((t) => t.day < today);
  const hoje = taskRows.filter((t) => t.day === today);

  const rem = (reminders.data ?? []).map((r) => ({ ...r, at: splitInstantSP(r.remind_at) }));

  return {
    today,
    pagarAtrasado: {
      count: pagarAtr.length,
      total: sumOf(pagarAtr),
      items: pagarAtr.slice(0, 5).map((t) => ({ label: t.description, amount: Number(t.amount), date: t.due })),
    },
    pagarSemana: {
      count: pagarSem.length,
      total: sumOf(pagarSem),
      items: pagarSem.slice(0, 5).map((t) => ({ label: t.description, amount: Number(t.amount), date: t.due })),
    },
    receberAtrasado: { count: recAtr.length, total: sumOf(recAtr) },
    receberSemana: { count: recSem.length, total: sumOf(recSem) },
    tarefasAtrasadas: {
      count: atrasadas.length,
      minhas: atrasadas.filter((t) => t.assigned_to === userId).length,
      items: atrasadas.slice(0, 5).map((t) => ({ label: t.title, date: t.day })),
    },
    tarefasHoje: { count: hoje.length, items: hoje.slice(0, 5).map((t) => ({ label: t.title })) },
    agendaHoje: (events.data ?? []).map((e) => ({ label: e.title, time: splitInstantSP(e.start_time)?.time ?? "" })),
    lembretesHoje: {
      count: rem.length,
      atrasados: rem.filter((r) => (r.at?.date ?? today) < today).length,
      items: rem.slice(0, 5).map((r) => ({ label: r.title, date: r.at?.date ?? "", time: r.at?.time ?? "" })),
    },
  };
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

/** Versão compacta em texto, pro contexto automático do modelo. */
export function snapshotText(s: Snapshot): string {
  const lines: string[] = [];
  if (s.pagarAtrasado.count)
    lines.push(
      `Contas ATRASADAS: ${s.pagarAtrasado.count} (${brl(s.pagarAtrasado.total)}) — ${s.pagarAtrasado.items.map((i) => `${i.label} ${brl(i.amount!)} venceu ${dm(i.date)}`).join("; ")}`,
    );
  if (s.pagarSemana.count)
    lines.push(
      `A pagar nos próximos 7 dias: ${s.pagarSemana.count} (${brl(s.pagarSemana.total)}) — ${s.pagarSemana.items.map((i) => `${i.label} ${brl(i.amount!)} ${dm(i.date)}`).join("; ")}`,
    );
  if (s.receberAtrasado.count) lines.push(`A receber atrasado: ${s.receberAtrasado.count} (${brl(s.receberAtrasado.total)})`);
  if (s.receberSemana.count) lines.push(`A receber em 7 dias: ${s.receberSemana.count} (${brl(s.receberSemana.total)})`);
  if (s.tarefasAtrasadas.count)
    lines.push(
      `Tarefas atrasadas: ${s.tarefasAtrasadas.count} (${s.tarefasAtrasadas.minhas} de quem está falando) — ${s.tarefasAtrasadas.items.map((i) => i.label).join("; ")}`,
    );
  if (s.tarefasHoje.count) lines.push(`Tarefas pra hoje: ${s.tarefasHoje.items.map((i) => i.label).join("; ")}`);
  if (s.agendaHoje.length) lines.push(`Agenda de hoje: ${s.agendaHoje.map((e) => `${e.time} ${e.label}`).join("; ")}`);
  if (s.lembretesHoje.count)
    lines.push(`Lembretes pendentes até hoje: ${s.lembretesHoje.items.map((i) => `${i.label} (${dm(i.date)} ${i.time})`).join("; ")}`);
  return lines.length ? lines.join("\n") : "Nada atrasado nem vencendo nos próximos dias.";
}

/** Marca o bloco de contexto gerado pelo sistema (a tela não mostra). */
export const AUTO_CONTEXT_PREFIX = "[Contexto automático]";

const PAGE_NAMES: Record<string, string> = {
  "/": "Início",
  "/tarefas": "Pendências (tarefas)",
  "/agenda": "Agenda",
  "/lembretes": "Lembretes",
  "/projetos": "Projetos",
  "/contatos": "Contatos",
  "/financeiro": "Financeiro",
  "/ideias": "Ideias",
  "/acompanhamento": "Acompanhamento",
  "/configuracoes": "Configurações",
};
export function pageName(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("/projetos/")) return "um projeto específico";
  return PAGE_NAMES[path] ?? null;
}
