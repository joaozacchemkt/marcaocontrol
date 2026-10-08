import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Brain,
  Calendar,
  Check,
  CheckSquare,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/lib/workspace";
import type { AssistantAction } from "./use-assistant-chat";

type Input = Record<string, unknown>;
type Field = [label: string, value: string];

const brl = (v: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
const dmy = (v: unknown) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return "";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : "");

const FREQ: Record<string, string> = {
  diario: "todo dia",
  semanal: "toda semana",
  quinzenal: "a cada 2 semanas",
  mensal: "todo mês",
  bimestral: "a cada 2 meses",
  trimestral: "a cada 3 meses",
  semestral: "a cada 6 meses",
  anual: "todo ano",
};
const PRIORITY: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

interface Meta {
  icon: LucideIcon;
  title: string;
  href?: string;
  fields: Field[];
  tone?: "income" | "expense";
}

/** Como mostrar cada tipo de ação. A fonte é o `input` validado que foi executado. */
function describe(a: AssistantAction, nameOf: (id: unknown) => string): Meta {
  const i = (a.input ?? {}) as Input;
  const keep = (f: Field[]) => f.filter(([, v]) => v);
  switch (a.tool) {
    case "registrar_lancamento": {
      const receita = i["tipo"] === "receita";
      const pago = i["pago"] === true;
      return {
        icon: receita ? ArrowUpRight : ArrowDownLeft,
        tone: receita ? "income" : "expense",
        title: str(i["descricao"]) || (receita ? "Receita" : "Despesa"),
        href: "/financeiro",
        fields: keep([
          ["Valor", brl(i["valor"])],
          ["Tipo", receita ? "Receita" : "Despesa"],
          ["Situação", pago ? (receita ? "Recebido" : "Pago") : "Pendente"],
          ["Vencimento", dmy(i["vencimento"])],
          ["Pagamento", pago ? dmy(i["data_pagamento"]) || "Hoje" : ""],
          ["Forma", str(i["forma_pagamento"])],
          ["Categoria", str(i["categoria"])],
          ["Repete", FREQ[str(i["repete"])] ?? ""],
          ["Obs.", str(i["observacoes"])],
        ]),
      };
    }
    case "marcar_lancamento_pago":
      return { icon: Check, title: a.summary, href: "/financeiro", fields: [] };
    case "criar_tarefa":
      return {
        icon: CheckSquare,
        title: str(i["titulo"]),
        href: "/tarefas",
        fields: keep([
          ["Prazo", dmy(i["prazo"])],
          ["Responsável", i["responsavel_id"] ? nameOf(i["responsavel_id"]) : ""],
          ["Prioridade", PRIORITY[str(i["prioridade"])] ?? ""],
          ["Detalhes", str(i["descricao"])],
        ]),
      };
    case "criar_tarefas": {
      const list = Array.isArray(i["tarefas"]) ? (i["tarefas"] as Input[]) : [];
      return {
        icon: CheckSquare,
        title: a.summary,
        href: "/tarefas",
        fields: list.map((t): Field => [
          PRIORITY[str(t["prioridade"])] ?? "Média",
          [str(t["titulo"]), t["responsavel_id"] ? `→ ${nameOf(t["responsavel_id"])}` : "", dmy(t["prazo"])]
            .filter(Boolean)
            .join(" · "),
        ]),
      };
    }
    case "concluir_tarefa":
      return { icon: CheckSquare, title: a.summary, href: "/tarefas", fields: [] };
    case "criar_lembrete":
      return {
        icon: Bell,
        title: str(i["titulo"]),
        href: "/lembretes",
        fields: keep([
          ["Quando", `${dmy(i["data"])} às ${str(i["hora"])}`],
          ["Repete", FREQ[str(i["repete"])] ?? ""],
          ["Prioridade", PRIORITY[str(i["prioridade"])] ?? ""],
          ["Obs.", str(i["observacoes"])],
        ]),
      };
    case "concluir_lembrete":
      return { icon: Bell, title: a.summary, href: "/lembretes", fields: [] };
    case "criar_compromisso":
      return {
        icon: Calendar,
        title: str(i["titulo"]),
        href: "/agenda",
        fields: keep([
          ["Data", dmy(i["data"])],
          ["Horário", [str(i["hora_inicio"]), str(i["hora_fim"])].filter(Boolean).join(" – ")],
          ["Local", str(i["local"])],
          ["Detalhes", str(i["descricao"])],
        ]),
      };
    case "criar_compromissos": {
      const list = Array.isArray(i["compromissos"]) ? (i["compromissos"] as Input[]) : [];
      return {
        icon: Calendar,
        title: a.summary,
        href: "/agenda",
        fields: list.map((c): Field => [
          `${dmy(c["data"]).slice(0, 5)} ${str(c["hora_inicio"])}`,
          [str(c["titulo"]), str(c["local"])].filter(Boolean).join(" · "),
        ]),
      };
    }
    case "criar_contato":
      return {
        icon: User,
        title: str(i["nome"]),
        href: "/contatos",
        fields: keep([
          ["Telefone", str(i["telefone"])],
          ["WhatsApp", str(i["whatsapp"])],
          ["E-mail", str(i["email"])],
          ["Empresa", str(i["empresa"])],
        ]),
      };
    case "editar_lancamento":
      return { icon: Pencil, title: a.summary, href: "/financeiro", fields: [] };
    case "editar_tarefa":
      return { icon: Pencil, title: a.summary, href: "/tarefas", fields: [] };
    case "editar_lembrete":
      return { icon: Pencil, title: a.summary, href: "/lembretes", fields: [] };
    case "editar_compromisso":
      return { icon: Pencil, title: a.summary, href: "/agenda", fields: [] };
    case "excluir_registro":
      return { icon: Trash2, title: a.summary, fields: [] };
    case "lembrar_fato":
    case "esquecer_fato":
      return { icon: Brain, title: a.summary, fields: [] };
    case "registrar_feedback":
      return { icon: MessageSquareWarning, title: a.summary, href: "/configuracoes", fields: [] };
    default:
      return { icon: Check, title: a.summary, fields: [] };
  }
}

const STATUS_LABEL: Record<AssistantAction["status"], string> = {
  pending: "Aguardando sua confirmação",
  executing: "Executando…",
  done: "Feito",
  cancelled: "Cancelado",
  failed: "Falhou",
  undone: "Desfeito",
};

/**
 * Cartão de uma ação do assistente. `compact` = dentro da conversa;
 * completo = no painel "O que foi feito", com os campos do registro.
 */
export function ActionPreview({
  action: a,
  compact = false,
  busy,
  onConfirm,
  onCancel,
  onUndo,
}: {
  action: AssistantAction;
  compact?: boolean;
  busy: boolean;
  onConfirm: (scope?: "one" | "following") => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  const nameOf = (id: unknown) => members.find((m) => m.id === id)?.name ?? "alguém";
  const meta = describe(a, nameOf);
  const Icon = meta.icon;
  const pending = a.status === "pending";
  const voided = a.status === "undone" || a.status === "cancelled";
  const canUndo = a.status === "done" && a.kind === "write" && a.undo != null;
  /** Conta recorrente: a pessoa escolhe o alcance no próprio cartão. */
  const askScope = Boolean((a.input as Record<string, unknown> | null)?.["__escopo"]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-sm shadow-sm",
        pending && "border-amber-500/60 bg-amber-500/5",
        voided && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            meta.tone === "income" && "bg-emerald-500/10 text-emerald-600",
            meta.tone === "expense" && "bg-destructive/10 text-destructive",
            pending && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          )}
        >
          {a.status === "executing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold leading-snug", voided && "line-through")}>
            {compact || meta.fields.length === 0 ? a.summary : meta.title}
          </p>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground",
              a.status === "done" && "text-emerald-600",
              pending && "text-amber-700 dark:text-amber-400",
            )}
          >
            {a.status === "done" && <Check className="h-3 w-3" />}
            {voided && <X className="h-3 w-3" />}
            {STATUS_LABEL[a.status]}
          </p>
        </div>
      </div>

      {!compact && meta.fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t px-3 py-2.5 text-xs">
          {meta.fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn("font-medium", voided && "line-through")}>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(pending || canUndo || (!compact && meta.href && !voided)) && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t px-2 py-1.5">
          {!compact && meta.href && !voided && !pending && (
            <Button asChild variant="ghost" size="sm" className="mr-auto h-7 gap-1 text-xs">
              <Link to={meta.href}>
                Abrir <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
          {pending && (
            <>
              <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={onCancel}>
                Cancelar
              </Button>
              {askScope ? (
                <>
                  <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => onConfirm("one")}>
                    Só nesta
                  </Button>
                  <Button size="sm" className="h-8" disabled={busy} onClick={() => onConfirm("following")}>
                    Nesta e nas próximas
                  </Button>
                </>
              ) : (
                <Button size="sm" className="h-8" disabled={busy} onClick={() => onConfirm()}>
                  Confirmar
                </Button>
              )}
            </>
          )}
          {canUndo && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" disabled={busy} onClick={onUndo}>
              <RotateCcw className="h-3 w-3" /> Desfazer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
