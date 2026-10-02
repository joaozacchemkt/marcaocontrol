import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, Calendar, CheckSquare, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId, useWorkspaceMembers } from "@/lib/workspace";
import { getSnapshot, type Snapshot } from "@/lib/assistant/snapshot";
import { nowLabelSP } from "@/lib/assistant/time";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function greeting(): string {
  const hour = Number(nowLabelSP().slice(-5, -3));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** Atalhos que viram mensagem pro assistente, conforme a situação. */
function suggestions(s: Snapshot): string[] {
  const out: string[] = [];
  if (s.pagarAtrasado.count) out.push("Me mostra as contas atrasadas pra eu dizer quais já paguei");
  if (s.pagarSemana.count) out.push("O que vence essa semana?");
  if (s.tarefasAtrasadas.count) out.push("Quais tarefas estão atrasadas?");
  if (s.agendaHoje.length) out.push("Como está minha agenda hoje?");
  if (s.lembretesHoje.count) out.push("Quais lembretes tenho pra hoje?");
  out.push("Paguei R$ 50 de mercado no Pix", "Quanto gastei este mês?");
  return out.slice(0, 5);
}

/**
 * "Resumo do dia" que abre a conversa — calculado direto do banco (sem IA):
 * instantâneo, sem custo e sem risco de inventar número.
 */
export function BriefingCard({ onAsk, disabled }: { onAsk: (text: string) => void; disabled: boolean }) {
  const { data: userId } = useCurrentUserId();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: s, isLoading } = useQuery({
    queryKey: ["assistant-briefing", userId],
    enabled: Boolean(userId),
    queryFn: () => getSnapshot(supabase, userId!),
    staleTime: 60_000,
  });
  const firstName = (members.find((m) => m.id === userId)?.name ?? "").split(" ")[0];

  const rows: { icon: React.ReactNode; text: string; tone?: "bad" | "warn" | undefined }[] = [];
  if (s) {
    if (s.pagarAtrasado.count)
      rows.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        tone: "bad",
        text: `${s.pagarAtrasado.count} conta(s) atrasada(s): ${brl(s.pagarAtrasado.total)}`,
      });
    if (s.pagarSemana.count)
      rows.push({
        icon: <Wallet className="h-4 w-4" />,
        tone: "warn",
        text: `${s.pagarSemana.count} conta(s) vencendo em 7 dias: ${brl(s.pagarSemana.total)}`,
      });
    if (s.receberAtrasado.count + s.receberSemana.count)
      rows.push({
        icon: <Wallet className="h-4 w-4" />,
        text: `A receber em breve: ${brl(s.receberAtrasado.total + s.receberSemana.total)}${s.receberAtrasado.count ? ` (${brl(s.receberAtrasado.total)} atrasado)` : ""}`,
      });
    if (s.tarefasAtrasadas.count || s.tarefasHoje.count)
      rows.push({
        icon: <CheckSquare className="h-4 w-4" />,
        tone: s.tarefasAtrasadas.count ? "warn" : undefined,
        text: [
          s.tarefasHoje.count ? `${s.tarefasHoje.count} tarefa(s) pra hoje` : "",
          s.tarefasAtrasadas.count ? `${s.tarefasAtrasadas.count} atrasada(s)` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    if (s.agendaHoje.length)
      rows.push({
        icon: <Calendar className="h-4 w-4" />,
        text: `Hoje: ${s.agendaHoje.map((e) => `${e.time} ${e.label}`).join(" · ")}`,
      });
    if (s.lembretesHoje.count)
      rows.push({ icon: <Bell className="h-4 w-4" />, text: `${s.lembretesHoje.count} lembrete(s) pendente(s) até hoje` });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pt-4">
      <div className="rounded-2xl border bg-muted/40 p-4">
        <p className="text-base font-semibold">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}! 👋
        </p>
        {isLoading || !s ? (
          <p className="mt-2 text-sm text-muted-foreground">Olhando como está o dia…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nada atrasado nem vencendo nos próximos dias. Tudo em dia! ✅</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <li
                key={i}
                className={
                  r.tone === "bad" ? "flex gap-2 text-sm text-destructive" : r.tone === "warn" ? "flex gap-2 text-sm text-amber-700 dark:text-amber-400" : "flex gap-2 text-sm"
                }
              >
                <span className="mt-0.5 shrink-0">{r.icon}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Fale do jeito que falaria com uma pessoa — digitando ou pelo microfone. Tudo que eu fizer aparece em "O que
          foi feito", com botão pra desfazer.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {(s ? suggestions(s) : ["O que vence essa semana?", "Quanto gastei este mês?"]).map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(t)}
            className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
