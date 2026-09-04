import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurrence";

interface RecurrenceRow {
  id: string;
  title: string;
  project_id: string | null;
  frequency: Frequency;
  interval_count: number;
  next_run: string;
  end_date: string | null;
  active: boolean;
}

const EMPTY_FORM = {
  title: "",
  project_id: "none",
  frequency: "semanal" as Frequency,
  interval_count: "1",
  start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: "",
};

/**
 * Tarefas recorrentes globais (ex.: "trocar pastilha de cloro" toda semana).
 * A próxima ocorrência é gerada quando a tarefa atual é concluída.
 */
export function RecurringTasks() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-select"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      return data ?? [];
    },
  });

  const { data: recurrences = [] } = useQuery({
    queryKey: ["task_recurrences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_recurrences" as never)
        .select("*")
        .order("next_run");
      if (error) throw error;
      return (data ?? []) as unknown as RecurrenceRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Informe um título.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const projectId = form.project_id !== "none" ? form.project_id : null;
      const interval = Math.max(1, Number.parseInt(form.interval_count, 10) || 1);

      const { data: created, error } = await supabase
        .from("task_recurrences" as never)
        .insert({
          user_id: user.id,
          project_id: projectId,
          title: form.title.trim(),
          frequency: form.frequency,
          interval_count: interval,
          start_date: form.start_date,
          end_date: form.end_date || null,
          next_run: form.start_date,
        } as never)
        .select()
        .single();
      if (error) throw error;
      const recurrenceId = (created as { id: string } | null)?.id;
      if (!recurrenceId) throw new Error("Falha ao criar a recorrência.");

      // Primeira ocorrência já entra como tarefa normal do sistema global.
      // Precisa do recurrence_id: é o que faz a próxima ocorrência ser
      // gerada quando esta for concluída (ver advanceRecurrence em
      // src/lib/recurrence.ts). Sem ele, a recorrência para na primeira.
      const { error: taskError } = await supabase.from("tasks").insert({
        user_id: user.id,
        project_id: projectId,
        title: form.title.trim(),
        deadline: new Date(`${form.start_date}T12:00:00`).toISOString(),
        status: "a_fazer",
        recurrence_id: recurrenceId,
      } as never);
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["task_recurrences"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Recorrência criada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("task_recurrences" as never)
        .update({ active } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["task_recurrences"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_recurrences" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task_recurrences"] });
      toast.success("Recorrência removida");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tarefas Recorrentes</h3>
          <p className="text-sm text-muted-foreground">
            Ao concluir a tarefa, a próxima ocorrência é criada automaticamente.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Nova recorrência
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="rec-title">Título</Label>
              <Input
                id="rec-title"
                placeholder="Ex.: Trocar pastilha de cloro"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select
                value={form.project_id}
                onValueChange={(v) => setForm((p) => ({ ...p, project_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, frequency: v as Frequency }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-interval">Intervalo</Label>
              <Input
                id="rec-interval"
                type="number"
                min={1}
                value={form.interval_count}
                onChange={(e) =>
                  setForm((p) => ({ ...p, interval_count: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-start">Início</Label>
              <Input
                id="rec-start"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, start_date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-end">Término (opcional)</Label>
              <Input
                id="rec-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Button
                className="w-full"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Salvando..." : "Criar recorrência"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {recurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tarefa recorrente cadastrada.
        </p>
      ) : (
        <div className="space-y-2">
          {recurrences.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <Repeat className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rec.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {FREQUENCY_LABELS[rec.frequency] ?? rec.frequency}
                    {rec.interval_count > 1 ? ` ×${rec.interval_count}` : ""}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Próxima:{" "}
                    {format(new Date(`${rec.next_run}T12:00:00`), "dd MMM yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
              <Switch
                checked={rec.active}
                aria-label="Recorrência ativa"
                onCheckedChange={(active) =>
                  toggleActive.mutate({ id: rec.id, active })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Remover recorrência"
                onClick={() => remove.mutate(rec.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
