import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Diário — Marcão Control" },
      { name: "description", content: "O que foi feito, dia a dia — pra acompanhar de fora." },
      { property: "og:title", content: "Diário — Marcão Control" },
      { property: "og:description", content: "O que foi feito, dia a dia — pra acompanhar de fora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiarioPage,
});

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, NotebookPen, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";

const dayKey = (value: string) => format(new Date(value), "yyyy-MM-dd");

const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
};

function DiarioPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["daily-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates" as never)
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        note: string;
        created_at: string;
        projects: { name: string } | null;
      }>;
    },
  });

  const { data: doneTasks = [] } = useQuery({
    queryKey: ["diario-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, updated_at, projects(name)")
        .eq("status", "concluido")
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: doneEvents = [] } = useQuery({
    queryKey: ["diario-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_time, projects(name)")
        .eq("status", "concluido")
        .order("start_time", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("daily_updates" as never).insert({
        user_id: user.id,
        note: text,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["daily-updates"] });
      toast.success("Anotado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_updates" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-updates"] });
      toast.success("Anotação removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useGuardedSubmit(() => {
    const text = note.trim();
    if (!text) return;
    addNote.mutate(text);
  }, addNote.isPending);

  // Agrupa notas + tarefas/compromissos concluídos por dia (fuso local).
  const days = useMemo(() => {
    const map = new Map<
      string,
      {
        notes: typeof notes;
        tasks: typeof doneTasks;
        events: typeof doneEvents;
      }
    >();
    const bucket = (key: string) => {
      let b = map.get(key);
      if (!b) {
        b = { notes: [], tasks: [], events: [] };
        map.set(key, b);
      }
      return b;
    };
    for (const n of notes) bucket(dayKey(n.created_at)).notes.push(n);
    for (const t of doneTasks) if (t.updated_at) bucket(dayKey(t.updated_at)).tasks.push(t);
    for (const e of doneEvents) bucket(dayKey(e.start_time)).events.push(e);

    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [notes, doneTasks, doneEvents]);

  const isLoading = loadingNotes;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Diário</h2>
          <p className="text-muted-foreground">
            O que foi feito, dia a dia. Tarefas e compromissos concluídos entram sozinhos — complemente com uma
            anotação quando quiser.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Textarea
              placeholder="O que você fez ou está fazendo agora?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={submit}>
                <Send className="mr-2 h-3.5 w-3.5" />
                {addNote.isPending ? "Publicando..." : "Publicar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : days.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <NotebookPen className="mx-auto mb-2 h-5 w-5 opacity-60" />
            Nada por aqui ainda. Escreva a primeira anotação ou conclua uma tarefa.
          </div>
        ) : (
          <div className="space-y-6">
            {days.map(([key, day]) => (
              <section key={key} className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                  {dayLabel(key)}
                </h3>
                <div className="space-y-2 rounded-xl border bg-card p-4">
                  {day.notes.length === 0 && day.tasks.length === 0 && day.events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nada registrado.</p>
                  ) : (
                    <>
                      {day.notes.map((n) => (
                        <div key={n.id} className="group flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                          <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm">{n.note}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {format(new Date(n.created_at), "HH:mm")}
                              {n.projects?.name && <> · {n.projects.name}</>}
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                                aria-label="Excluir anotação"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
                                <AlertDialogDescription>Some do diário. Não dá pra desfazer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeNote.mutate(n.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                      {day.tasks.map((t) => (
                        <div key={`task-${t.id}`} className="flex items-center gap-2 px-1 py-1 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          {(t as any).projects?.name && (
                            <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                              {(t as any).projects.name}
                            </span>
                          )}
                        </div>
                      ))}
                      {day.events.map((ev) => (
                        <div key={`event-${ev.id}`} className="flex items-center gap-2 px-1 py-1 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="min-w-0 flex-1 truncate">{ev.title}</span>
                          {(ev as any).projects?.name && (
                            <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                              {(ev as any).projects.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
