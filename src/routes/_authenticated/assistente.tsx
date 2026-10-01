import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ListChecks, Loader2, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ActionPreview } from "@/components/assistant/ActionPreview";
import {
  useAssistantChat,
  type AssistantAction,
  type ConversationSummary,
} from "@/components/assistant/use-assistant-chat";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: AssistentePage,
});

const SUGGESTIONS = [
  "Paguei R$ 50 de mercado no Pix",
  "O que vence essa semana?",
  "Me lembra amanhã às 9h de ligar pro contador",
  "Quanto gastei este mês?",
  "Quais tarefas estão atrasadas?",
];

/** **negrito** simples; o resto em texto puro (nunca HTML vindo do modelo). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function AssistentePage() {
  const chat = useAssistantChat();
  const [draft, setDraft] = useState("");
  const [mobileTab, setMobileTab] = useState<"chat" | "feito">("chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  const submit = (text = draft) => {
    if (!text.trim() || chat.sending) return;
    setDraft("");
    setMobileTab("chat");
    void chat.send(text).then((ok) => {
      if (!ok) setDraft((d) => d || text); // devolve o texto se não foi
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.items.length, chat.pendingText, mobileTab]);

  const done = chat.actions.filter((a) => a.status !== "cancelled");
  const pendingCount = chat.actions.filter((a) => a.status === "pending").length;
  const empty = chat.items.length === 0 && !chat.pendingText && !chat.loadingThread;

  const actionProps = (a: AssistantAction) => ({
    action: a,
    busy: chat.actionBusy,
    onConfirm: () => chat.confirmAction(a.id),
    onCancel: () => chat.cancelAction(a.id),
    onUndo: () => chat.undoAction(a.id),
  });

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-57px-2rem)] gap-4 md:h-[calc(100dvh-4rem)]">
        {/* Conversas anteriores (telas largas) */}
        <aside className="hidden w-56 shrink-0 flex-col xl:flex">
          <Button
            variant="outline"
            className="mb-3 justify-start gap-2"
            disabled={chat.sending}
            onClick={() => chat.selectConversation(null)}
          >
            <MessageSquarePlus className="h-4 w-4" /> Nova conversa
          </Button>
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversas
          </p>
          <ConversationList
            items={chat.conversations}
            currentId={chat.conversationId ?? null}
            disabled={chat.sending}
            onSelect={chat.selectConversation}
          />
        </aside>

        {/* Conversa */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <h1 className="mr-auto text-base font-semibold">Assistente</h1>

            {/* Conversas anteriores (telas menores) */}
            <div className="xl:hidden">
              <Select
                value={chat.conversationId ?? "nova"}
                onValueChange={(v) => chat.selectConversation(v === "nova" ? null : v)}
                disabled={chat.sending}
              >
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Conversas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova">+ Nova conversa</SelectItem>
                  {chat.conversations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {(c.title || "Conversa").slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>

          {/* Abas no celular/tablet: conversa x o que foi feito */}
          <div className="grid grid-cols-2 border-b text-sm lg:hidden">
            {(["chat", "feito"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 font-medium text-muted-foreground",
                  mobileTab === tab && "border-b-2 border-primary text-foreground",
                )}
              >
                {tab === "chat" ? "Conversa" : "O que foi feito"}
                {tab === "feito" && done.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full bg-muted px-1.5 text-[10px]",
                      pendingCount > 0 && "bg-amber-500 text-white",
                    )}
                  >
                    {pendingCount > 0 ? pendingCount : done.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {mobileTab === "feito" ? (
              <div className="lg:hidden">
                <DoneList actions={done} actionProps={actionProps} />
              </div>
            ) : null}

            <div className={cn("space-y-3", mobileTab === "feito" && "hidden lg:block")}>
              {chat.loadingThread && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
                </p>
              )}

              {empty && (
                <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Fale do jeito que falaria com uma pessoa. Eu registro, consulto, lembro e aviso o que precisa de
                    atenção. Tudo que eu fizer aparece em "O que foi feito", com botão pra desfazer.
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

              {chat.items.map((it) =>
                it.kind === "message" ? (
                  <div key={it.id} className={cn("flex", it.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                        it.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <RichText text={it.text} />
                    </div>
                  </div>
                ) : (
                  <div key={it.id} className="max-w-[85%]">
                    <ActionPreview compact {...actionProps(it.action)} />
                  </div>
                ),
              )}

              {chat.pendingText && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                      {chat.pendingText}
                    </div>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                  </p>
                </>
              )}
              <div ref={bottomRef} />
            </div>
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
              className="max-h-40 min-h-[48px] resize-none text-base md:text-sm"
              disabled={chat.sending}
            />
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 shrink-0"
              disabled={chat.sending || !draft.trim()}
              aria-label="Enviar"
            >
              {chat.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </section>

        {/* O que foi feito (telas largas) */}
        <aside className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:flex">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">O que foi feito</h2>
            {pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingCount} pra confirmar
              </span>
            )}
          </header>
          <div className="flex-1 overflow-y-auto p-3">
            <DoneList actions={done} actionProps={actionProps} />
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function DoneList({
  actions,
  actionProps,
}: {
  actions: AssistantAction[];
  actionProps: (a: AssistantAction) => React.ComponentProps<typeof ActionPreview>;
}) {
  if (actions.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm italic text-muted-foreground">
        Nada feito nesta conversa ainda. Cada registro que eu criar, quitar ou alterar aparece aqui.
      </p>
    );
  }
  // Pendentes de confirmação primeiro; depois do mais recente pro mais antigo.
  const sorted = [...actions].sort((a, b) =>
    a.status === "pending" && b.status !== "pending"
      ? -1
      : b.status === "pending" && a.status !== "pending"
        ? 1
        : b.created_at.localeCompare(a.created_at),
  );
  return (
    <div className="space-y-2.5">
      {sorted.map((a) => (
        <div key={a.id}>
          <p className="mb-1 px-1 text-[10px] text-muted-foreground">{format(new Date(a.created_at), "dd/MM HH:mm")}</p>
          <ActionPreview {...actionProps(a)} />
        </div>
      ))}
    </div>
  );
}

function ConversationList({
  items,
  currentId,
  disabled,
  onSelect,
}: {
  items: ConversationSummary[];
  currentId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return <p className="px-1 text-xs italic text-muted-foreground">Nenhuma ainda.</p>;
  return (
    <nav className="-mx-1 flex-1 space-y-0.5 overflow-y-auto">
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-accent disabled:opacity-60",
            c.id === currentId && "bg-accent",
          )}
        >
          <p className="truncate text-sm">{c.title || "Conversa"}</p>
          <p className="text-[10px] text-muted-foreground">{format(new Date(c.updated_at), "dd/MM HH:mm")}</p>
        </button>
      ))}
    </nav>
  );
}
