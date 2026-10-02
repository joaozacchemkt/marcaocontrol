import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import {
  AlertCircle,
  CheckSquare,
  EyeOff,
  Flag,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Sparkles,
  SquareArrowOutUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createTaskFromEmail, getOutlookInbox, setEmailIgnored } from "@/lib/outlook.functions";
import type { InboxItem } from "@/lib/outlook/graph";

export const Route = createFileRoute("/_authenticated/email")({
  component: EmailPage,
});

type View = "prioritarios" | "todos" | "ignorados";

function when(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `ontem ${format(d, "HH:mm")}`;
  return format(d, "dd/MM");
}

/** Mais importante primeiro: sinalizado, alta importância, não lido; depois o mais recente. */
function score(m: InboxItem): number {
  return (m.sinalizado ? 4 : 0) + (m.importante ? 2 : 0) + (m.lido ? 0 : 1);
}

function EmailPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  const [view, setView] = useState<View>("prioritarios");
  const [taskFor, setTaskFor] = useState<InboxItem | null>(null);

  const inbox = useQuery({
    queryKey: ["outlook-inbox", days],
    queryFn: () => getOutlookInbox({ data: { days } }),
    staleTime: 2 * 60_000,
    retry: false,
  });

  // E-mails já tratados (viraram tarefa ou foram ignorados).
  const seen = useQuery({
    queryKey: ["outlook-seen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outlook_seen_messages").select("message_id, decision");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.message_id, r.decision]));
    },
  });

  const ignore = useMutation({
    mutationFn: (v: { emailId: string; ignored: boolean }) => setEmailIgnored({ data: v }),
    onSuccess: (_r, v) => {
      void queryClient.invalidateQueries({ queryKey: ["outlook-seen"] });
      toast.success(v.ignored ? "E-mail escondido da lista." : "E-mail de volta na lista.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = inbox.data?.items ?? [];
  const seenMap = seen.data ?? new Map<string, string>();
  const list = useMemo(() => {
    const filtered = items.filter((m) => {
      const decision = seenMap.get(m.id);
      if (view === "ignorados") return decision === "ignorado";
      if (decision === "ignorado") return false;
      return view === "todos" || m.prioritario || m.sinalizado || m.importante;
    });
    return view === "prioritarios"
      ? [...filtered].sort((a, b) => score(b) - score(a) || b.recebido_em.localeCompare(a.recebido_em))
      : filtered;
  }, [items, seenMap, view]);

  const notConnected = inbox.data && !inbox.data.connected;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Mail className="h-7 w-7 text-primary" /> E-mail
            </h1>
            <p className="mt-1 text-muted-foreground">
              Sua caixa do Outlook, com o que importa primeiro. Só leitura — nada é alterado no Outlook.
            </p>
          </div>
          {!notConnected && (
            <Button asChild>
              <Link to="/assistente" search={{ de: "/email", pergunta: "Tem algo pendente no meu e-mail?" }}>
                <Sparkles className="mr-2 h-4 w-4" /> Analisar com o assistente
              </Link>
            </Button>
          )}
        </div>

        {notConnected ? (
          <Card className="space-y-3 p-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Seu Outlook ainda não está conectado.</p>
            <Button asChild>
              <Link to="/configuracoes">Conectar em Configurações</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["prioritarios", "Prioritários"],
                  ["todos", "Todos"],
                  ["ignorados", "Escondidos"],
                ] as [View, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    view === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Últimos 3 dias</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="14">Últimos 14 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Atualizar"
                  disabled={inbox.isFetching}
                  onClick={() => void inbox.refetch()}
                >
                  <RefreshCw className={cn("h-4 w-4", inbox.isFetching && "animate-spin")} />
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              {inbox.isLoading ? (
                <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lendo sua caixa de entrada…
                </p>
              ) : inbox.data?.error ? (
                <p className="flex items-center justify-center gap-2 p-10 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {inbox.data.error}
                </p>
              ) : list.length === 0 ? (
                <p className="p-10 text-center text-sm italic text-muted-foreground">
                  {view === "ignorados" ? "Nenhum e-mail escondido." : "Nada por aqui nesse período."}
                </p>
              ) : (
                <ul className="divide-y">
                  {list.map((m) => {
                    const decision = seenMap.get(m.id);
                    return (
                      <li key={m.id} className={cn("flex gap-3 p-4", m.lido && "bg-muted/20")}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!m.lido && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Não lido" />}
                            <p className={cn("truncate text-sm", !m.lido && "font-semibold")}>{m.de_nome}</p>
                            {m.sinalizado && <Flag className="h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500" />}
                            {m.importante && (
                              <span className="shrink-0 rounded bg-destructive/10 px-1.5 text-[10px] font-bold text-destructive">
                                IMPORTANTE
                              </span>
                            )}
                            {decision === "tarefa" && (
                              <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                VIROU TAREFA
                              </span>
                            )}
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{when(m.recebido_em)}</span>
                          </div>
                          <p className={cn("mt-0.5 truncate text-sm", !m.lido && "font-medium")}>{m.assunto}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.previa}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {decision !== "tarefa" && view !== "ignorados" && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setTaskFor(m)}>
                                <CheckSquare className="h-3.5 w-3.5" /> Virar tarefa
                              </Button>
                            )}
                            {view === "ignorados" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                disabled={ignore.isPending}
                                onClick={() => ignore.mutate({ emailId: m.id, ignored: false })}
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Mostrar de novo
                              </Button>
                            ) : (
                              decision !== "tarefa" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 text-xs text-muted-foreground"
                                  disabled={ignore.isPending}
                                  onClick={() => ignore.mutate({ emailId: m.id, ignored: true })}
                                >
                                  <EyeOff className="h-3.5 w-3.5" /> Esconder
                                </Button>
                              )
                            )}
                            <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground">
                              <a href={m.link} target="_blank" rel="noreferrer">
                                <SquareArrowOutUpRight className="h-3.5 w-3.5" /> Abrir no Outlook
                              </a>
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      <TaskFromEmailDialog
        email={taskFor}
        onClose={() => setTaskFor(null)}
        onCreated={() => {
          setTaskFor(null);
          void queryClient.invalidateQueries({ queryKey: ["outlook-seen"] });
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }}
      />
    </AppLayout>
  );
}

function TaskFromEmailDialog({
  email,
  onClose,
  onCreated,
}: {
  email: InboxItem | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [lastId, setLastId] = useState<string | null>(null);
  if (email && email.id !== lastId) {
    setLastId(email.id);
    setTitulo(`Responder: ${email.assunto}`.slice(0, 200));
    setPrazo("");
    setPrioridade(email.importante || email.sinalizado ? "alta" : "media");
  }

  const create = useMutation({
    mutationFn: () =>
      createTaskFromEmail({
        data: {
          emailId: email!.id,
          emailLink: email!.link,
          titulo: titulo.trim(),
          prioridade,
          ...(prazo ? { prazo } : {}),
        },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(r.message);
        onCreated();
      } else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={email !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Virar tarefa</DialogTitle>
        </DialogHeader>
        {email && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (titulo.trim() && !create.isPending) create.mutate();
            }}
          >
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              De <strong>{email.de_nome}</strong>: {email.assunto}
            </p>
            <div className="space-y-2">
              <Label htmlFor="t-titulo">Tarefa</Label>
              <Input id="t-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-prazo">Prazo</Label>
                <Input id="t-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">O link do e-mail vai junto na descrição da tarefa.</p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!titulo.trim() || create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar tarefa
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
