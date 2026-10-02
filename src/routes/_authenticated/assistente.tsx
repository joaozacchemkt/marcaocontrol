import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Mic,
  MicOff,
  Minimize2,
  Send,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ActionPreview } from "@/components/assistant/ActionPreview";
import { BriefingCard } from "@/components/assistant/BriefingCard";
import { useVoiceInput } from "@/components/assistant/use-voice-input";
import {
  useAssistantChat,
  type AssistantAction,
  type ConversationSummary,
} from "@/components/assistant/use-assistant-chat";

export const Route = createFileRoute("/_authenticated/assistente")({
  // `de` = tela de onde a pessoa abriu o chat (vira contexto pro assistente).
  // `pergunta` = texto que já vem escrito no campo (ex.: botão da tela E-mail).
  validateSearch: (search: Record<string, unknown>): { de?: string; pergunta?: string } => ({
    ...(typeof search["de"] === "string" && search["de"].startsWith("/") ? { de: search["de"] } : {}),
    ...(typeof search["pergunta"] === "string" ? { pergunta: search["pergunta"].slice(0, 500) } : {}),
  }),
  component: AssistentePage,
});

/** O que mostrar enquanto cada ferramenta roda. */
const STEP_LABELS: Record<string, string> = {
  buscar_lancamentos: "Consultando o financeiro",
  listar_contas_fixas: "Vendo as contas fixas",
  registrar_lancamento: "Registrando o lançamento",
  marcar_lancamento_pago: "Atualizando o pagamento",
  editar_lancamento: "Preparando a alteração",
  buscar_tarefas: "Olhando as tarefas",
  criar_tarefa: "Criando a tarefa",
  criar_tarefas: "Criando as tarefas",
  concluir_tarefa: "Atualizando a tarefa",
  editar_tarefa: "Preparando a alteração",
  buscar_lembretes: "Olhando os lembretes",
  criar_lembrete: "Criando o lembrete",
  concluir_lembrete: "Atualizando o lembrete",
  editar_lembrete: "Preparando a alteração",
  buscar_agenda: "Olhando a agenda",
  criar_compromisso: "Agendando",
  editar_compromisso: "Preparando a alteração",
  buscar_contatos: "Procurando nos contatos",
  criar_contato: "Cadastrando o contato",
  buscar_emails_pendentes: "Lendo seus e-mails",
  ignorar_emails: "Marcando os e-mails",
  excluir_registro: "Preparando a exclusão",
  lembrar_fato: "Anotando pra lembrar",
  esquecer_fato: "Atualizando o que sei",
  registrar_feedback: "Registrando pro João",
};

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
  const { de, pergunta } = Route.useSearch();
  const chat = useAssistantChat(de ?? null);
  const [draft, setDraft] = useState(pergunta ?? "");
  const [mobileTab, setMobileTab] = useState<"chat" | "feito">("chat");
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceInput(setDraft);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const startNew = () => {
    setMobileTab("chat");
    chat.newConversation();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = (text = draft) => {
    if (!text.trim() || chat.sending) return;
    voice.stop();
    setDraft("");
    setMobileTab("chat");
    void chat.send(text).then((ok) => {
      if (!ok) setDraft((d) => d || text); // devolve o texto se não foi
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.items.length, chat.pendingText, chat.steps.length, mobileTab, expanded]);

  // Esc sai da tela cheia.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const done = chat.actions.filter((a) => a.status !== "cancelled");
  const pendingCount = chat.actions.filter((a) => a.status === "pending").length;
  const empty = chat.items.length === 0 && !chat.pendingText && !chat.loadingThread;
  const lastStep = chat.steps.at(-1);

  const actionProps = (a: AssistantAction) => ({
    action: a,
    busy: chat.actionBusy,
    onConfirm: () => chat.confirmAction(a.id),
    onCancel: () => chat.cancelAction(a.id),
    onUndo: () => chat.undoAction(a.id),
  });

  const chatSection = (
    <section
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-hidden border bg-card",
        expanded ? "fixed inset-0 z-50 md:inset-4 md:rounded-2xl md:shadow-2xl" : "rounded-xl",
      )}
    >
      <header className="flex items-center gap-1.5 border-b px-3 py-2.5 md:px-4">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <h1 className="mr-auto text-base font-semibold">Assistente</h1>

        {/* Conversas anteriores (quando a lista lateral não aparece) */}
        <div className={cn(!expanded && "xl:hidden")}>
          <Select
            value={chat.conversationId ?? "nova"}
            onValueChange={(v) => (v === "nova" ? startNew() : chat.selectConversation(v))}
            disabled={chat.sending}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs sm:w-[160px]">
              <SelectValue placeholder="Conversas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nova">Conversa atual</SelectItem>
              {chat.conversations.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {(c.title || "Conversa").slice(0, 40)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={chat.sending || chat.clearing}
          onClick={startNew}
          title="Começa do zero e guarda um resumo desta conversa pra eu continuar lembrando"
        >
          {chat.clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          <span className="hidden sm:inline">Nova conversa</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 md:inline-flex"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Sair da tela cheia" : "Expandir"}
          title={expanded ? "Sair da tela cheia (Esc)" : "Expandir"}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </header>

      {/* Abas no celular/tablet: conversa x o que foi feito */}
      <div className={cn("grid grid-cols-2 border-b text-sm", !expanded && "lg:hidden")}>
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
              <span className={cn("rounded-full bg-muted px-1.5 text-[10px]", pendingCount > 0 && "bg-amber-500 text-white")}>
                {pendingCount > 0 ? pendingCount : done.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-4">
        {mobileTab === "feito" && (
          <div className={cn(!expanded && "lg:hidden")}>
            <DoneList actions={done} actionProps={actionProps} />
          </div>
        )}

        <div className={cn("mx-auto max-w-3xl space-y-3", mobileTab === "feito" && (expanded ? "hidden" : "hidden lg:block"))}>
          {chat.loadingThread && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
            </p>
          )}

          {empty && <BriefingCard onAsk={submit} disabled={chat.sending} />}

          {chat.currentArchived && chat.items.length > 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              Conversa encerrada (só leitura). Mandar uma mensagem abre uma nova — eu lembro do resumo desta.
            </p>
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
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {chat.pendingText}
              </div>
            </div>
          )}
          {chat.sending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {lastStep ? `${STEP_LABELS[lastStep] ?? "Trabalhando"}…` : "Pensando…"}
            </p>
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
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={voice.listening ? "Pode falar…" : "Digite sua mensagem…"}
          rows={1}
          className={cn("max-h-40 min-h-[48px] resize-none text-base md:text-sm", voice.listening && "border-primary")}
          disabled={chat.sending}
        />
        {voice.supported && (
          <Button
            type="button"
            size="icon"
            variant={voice.listening ? "default" : "outline"}
            className={cn("h-12 w-12 shrink-0", voice.listening && "animate-pulse")}
            disabled={chat.sending}
            onClick={() => (voice.listening ? voice.stop() : voice.start(draft))}
            aria-label={voice.listening ? "Parar de ouvir" : "Falar"}
          >
            {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
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
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-57px-2rem)] gap-4 md:h-[calc(100dvh-4rem)]">
        {/* Conversas anteriores (telas largas) */}
        <aside className="hidden w-56 shrink-0 flex-col xl:flex">
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conversas</p>
          <ConversationList
            items={chat.conversations}
            currentId={chat.conversationId ?? null}
            disabled={chat.sending}
            onSelect={chat.selectConversation}
          />
        </aside>

        {chatSection}

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
          <p className={cn("truncate text-sm", c.archived_at && "text-muted-foreground")}>{c.title || "Conversa"}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(c.updated_at), "dd/MM HH:mm")}
            {c.archived_at ? " · encerrada" : ""}
          </p>
        </button>
      ))}
    </nav>
  );
}
