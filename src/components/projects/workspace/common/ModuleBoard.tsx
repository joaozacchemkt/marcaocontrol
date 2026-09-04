import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { MODULES, type ModuleDefinition } from "@/lib/workspace-modules";
import { parseLocalDate } from "@/lib/dates";
import { ModuleItemDialog } from "./ModuleItemDialog";
import type { WorkspaceItem } from "./workspace-item";

export interface ModuleBoardProps {
  projectId: string;
  moduleKey: string;
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ModuleBoard({ projectId, moduleKey }: ModuleBoardProps) {
  const queryClient = useQueryClient();
  const module = MODULES[moduleKey] as ModuleDefinition | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceItem | null>(null);

  const queryKey = ["workspace-items", projectId, moduleKey];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    enabled: Boolean(module),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("module", moduleKey)
        .is("deleted_at", null)
        .order("position")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkspaceItem[];
    },
  });

  // Invalida pelo prefixo ["workspace-items", projectId], não pela chave
  // exata: isso também pega a query de contagem por módulo do ModulesHub
  // (["workspace-items", projectId, "counts", ...]), senão o badge de
  // contagem fica desatualizado até a aba ser desmontada/remontada.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace-items", projectId] });

  const save = useMutation({
    mutationFn: async (values: Partial<WorkspaceItem>) => {
      if (editing) {
        const { error } = await supabase
          .from("workspace_items")
          .update(values as never)
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("workspace_items").insert({
        ...values,
        user_id: user.id,
        project_id: projectId,
        module: moduleKey,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditing(null);
      invalidate();
      toast.success("Item salvo");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("workspace_items")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Item removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceItem[]>();
    for (const s of module?.stages ?? []) map.set(s.value, []);
    for (const item of items) {
      const bucket = map.get(item.stage) ?? map.get(module?.stages[0]?.value ?? "") ?? [];
      bucket.push(item);
      if (!map.has(item.stage)) map.set(item.stage, bucket);
    }
    return map;
  }, [items, module]);

  if (!module) return null;

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{module.label}</h3>
          <p className="text-sm text-muted-foreground">{module.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {module.amount && total > 0 && (
            <span className="text-sm font-medium text-muted-foreground">
              Total: {currency(total)}
            </span>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo(a) {module.itemLabel}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {module.stages.map((stage) => {
            const bucket = grouped.get(stage.value) ?? [];
            return (
              <div key={stage.value} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {bucket.length}
                  </Badge>
                </div>

                {bucket.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
                    Nada aqui ainda.
                  </p>
                )}

                {bucket.map((item) => (
                  <Card key={item.id} className="shadow-sm transition-fluid hover:shadow-md">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                        <div className="flex shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Editar item"
                            onClick={() => {
                              setEditing(item);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Remover item"
                            onClick={() => remove.mutate(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="line-clamp-3 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {parseLocalDate(item.due_date)!.toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {item.amount != null && (
                          <span className="font-medium">{currency(Number(item.amount))}</span>
                        )}
                      </div>

                      <Select
                        value={item.stage}
                        onValueChange={(value) =>
                          changeStage.mutate({ id: item.id, stage: value })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {module.stages.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <ModuleItemDialog
        module={module}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        item={editing}
        defaultStage={module.stages[0]?.value ?? "novo"}
        saving={save.isPending}
        onSubmit={(values) => save.mutate(values as Partial<WorkspaceItem>)}
      />
    </div>
  );
}
