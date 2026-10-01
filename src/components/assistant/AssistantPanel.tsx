import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquarePlus, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  resolveAssistantAction,
  sendAssistantMessage,
  undoAssistantAction,
} from "@/lib/assistant.functions";

type Block = { type: string; text?: string };
type MessageRow = { id: string; role: "user" | "assistant"; content: Block[]; created_at: string };
type ActionRow = {
  id: string;
  kind: "write" | "confirm";
  status: "pending" | "executing" | "done" | "cancelled" | "failed" | "undone";
  summary: string;
  undo: unknown;
  created_at: string;
};
type Item =
  | { kind: "message"; at: string; row: MessageRow; text: string }
  | { kind: "action"; at: string; row: ActionRow };

const SUGGESTIONS = [
  "Paguei R$ 50 de mercado no Pix",
  "O que vence essa semana?",
  "Me lembra amanhã às 9h de ligar pro contador",
  "Quanto gastei este mês?",
];

function textOf(content: Block[]): string {
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** **negrito** simples; o resto em texto puro (sem HTML vindo do modelo). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function AssistantPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ao abrir pela 1ª vez, retoma a conversa mais recente.
  useEffect(() => {
    if (!open || conversationId !== undefined) return;
    void supabase
      .from("assistant_conversations")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setConversationId(data?.[0]?.id ?? null));
  }, [open, conversationId]);

  const convKey = ["assistant-conversation", conversationId] as const;
  const { data: items = [] } = useQuery({
    queryKey: convKey,
    enabled: open && Boolean(conversationId),
    queryFn: async (): Promise<Item[]> => {
      const [msgs, acts] = await Promise.all([
        supabase
          .from("assistant_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId!)
          .eq("hidden", false)
          .order("created_at")
          .limit(300),
        supabase
          .from("assistant_actions")
          .select("id, kind, status, summary, undo, created_at")
          .eq("conversation_id", conversationId!)
          .neq("status", "failed")
          .order("created_at"),
      ]);
      if (msgs.error) throw msgs.error;
      if (acts.error) throw acts.error;
      const out: Item[] = [];
      for (const row of (msgs.data ?? []) as unknown as MessageRow[]) {
        const text = textOf(row.content);
        if (text) out.push({ kind: "message", at: row.created_at, row, text });
      }
      for (const row of (acts.data ?? []) as unknown as ActionRow[]) out.push({ kind: "action", at: row.created_at, row });
      return out.sort((a, b) => a.at.localeCompare(b.at));
    },
  });

  /** Depois de qualquer ação, as telas do app mostram o dado novo. */
  const refreshAll = (id: string | null) => {
    void queryClient.invalidateQueries({ queryKey: ["assistant-conversation", id] });
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "assistant-conversation" });
  };

  const send = useMutation({
    mutationFn: (text: string) => sendAssistantMessage({ data: { conversationId: conversationId ?? null, text } }),
    onMutate: (text) => {
      setPendingText(text);
      setDraft("");
    },
    onSuccess: (res) => {
      if (res.conversationId) setConversationId(res.conversationId);
      refreshAll(res.conversationId);
      if (!res.ok && res.error && !res.conversationId) toast.error(res.error);
    },
    onError: (e: Error, text) => {
      setDraft(text);
      toast.error(e.message || "Não consegui enviar. Tente de novo.");
    },
    onSettled: () => setPendingText(null),
  });

  const resolve = useMutation({
    mutationFn: (v: { actionId: string; decision: "confirm" | "cancel" }) => resolveAssistantAction({ data: v }),
    onSuccess: (res) => {
      (res.ok ? toast.success : toast.error)(res.message);
      refreshAll(conversationId ?? null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (actionId: string) => undoAssistantAction({ data: { actionId } }),
    onSuccess: (res) => {
      (res.ok ? toast.success : toast.error)(res.message);
      refreshAll(conversationId ?? null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = send.isPending;
  const submit = (text = draft) => {
    const t = text.trim();
    if (!t || busy) return;
    send.mutate(t);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, pendingText, open]);

  const empty = useMemo(() => items.length === 0 && !pendingText, [items.length, pendingText]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
          <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Assistente
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="mr-8 h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() => setConversationId(null)}
            >
              <MessageSquarePlus className="h-4 w-4" /> Nova conversa
            </Button>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {empty && (
              <div className="space-y-3 pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Fale do jeito que falaria com uma pessoa. Eu registro, consulto e aviso o que precisa de atenção.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.map((it) =>
              it.kind === "message" ? (
                <div key={it.row.id} className={cn("flex", it.row.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                      it.row.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <RichText text={it.text} />
                  </div>
                </div>
              ) : (
                <ActionCard
                  key={it.row.id}
                  a={it.row}
                  busy={resolve.isPending || undo.isPending}
                  onConfirm={() => resolve.mutate({ actionId: it.row.id, decision: "confirm" })}
                  onCancel={() => resolve.mutate({ actionId: it.row.id, decision: "cancel" })}
                  onUndo={() => undo.mutate(it.row.id)}
                />
              ),
            )}

            {pendingText && (
              <>
                <div className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {pendingText}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                </div>
              </>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ex.: paguei 4 reais pro meu filho"
              rows={1}
              className="max-h-32 min-h-[44px] resize-none"
              disabled={busy}
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !draft.trim()} aria-label="Enviar">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ActionCard({
  a,
  busy,
  onConfirm,
  onCancel,
  onUndo,
}: {
  a: ActionRow;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const pending = a.status === "pending";
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm",
        pending && "border-amber-500/50 bg-amber-500/5",
        a.status === "done" && "border-emerald-500/40 bg-emerald-500/5",
        (a.status === "undone" || a.status === "cancelled") && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        {a.status === "executing" ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : a.status === "done" ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : pending ? (
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <p className={cn("flex-1", (a.status === "undone" || a.status === "cancelled") && "line-through")}>{a.summary}</p>
      </div>
      {pending && (
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" className="h-8" disabled={busy} onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      )}
      {a.status === "done" && a.kind === "write" && a.undo != null && (
        <div className="mt-1 flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" disabled={busy} onClick={onUndo}>
            <RotateCcw className="h-3 w-3" /> Desfazer
          </Button>
        </div>
      )}
      {a.status === "undone" && <p className="mt-1 text-right text-xs text-muted-foreground">Desfeito</p>}
      {a.status === "cancelled" && <p className="mt-1 text-right text-xs text-muted-foreground">Cancelado</p>}
    </div>
  );
}
