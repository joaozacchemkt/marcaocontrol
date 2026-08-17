import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Plus, X } from "lucide-react";

const RELATION_TYPES = [
  { value: "relacionado", label: "Relacionado" },
  { value: "subprojeto", label: "Subprojeto" },
  { value: "estrategico", label: "Projeto estratégico" },
  { value: "operacional", label: "Projeto operacional" },
  { value: "origem", label: "Projeto origem" },
] as const;

export interface ProjectRelationsProps {
  projectId: string;
}

interface RelationRow {
  id: string;
  relation_type: string;
  related_project_id: string;
  project_id: string;
}

interface ProjectRow {
  id: string;
  name: string;
}

export function ProjectRelations({ projectId }: ProjectRelationsProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [targetId, setTargetId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("relacionado");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "minimal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });

  const { data: relations = [] } = useQuery({
    queryKey: ["project_relations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_relations" as never)
        .select("*")
        .or(`project_id.eq.${projectId},related_project_id.eq.${projectId}`);
      if (error) throw error;
      return (data ?? []) as unknown as RelationRow[];
    },
  });

  const addRelation = useMutation({
    mutationFn: async () => {
      if (!targetId) throw new Error("Selecione um projeto.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { error } = await supabase.from("project_relations" as never).insert({
        user_id: user.id,
        project_id: projectId,
        related_project_id: targetId,
        relation_type: relationType,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setAdding(false);
      setTargetId("");
      queryClient.invalidateQueries({ queryKey: ["project_relations", projectId] });
      toast.success("Projeto relacionado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRelation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_relations" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_relations", projectId] });
      toast.success("Relação removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const nameOf = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Projeto";

  const options = projects.filter((p) => p.id !== projectId);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Projetos Relacionados
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher projeto" />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="w-full"
              disabled={addRelation.isPending}
              onClick={() => addRelation.mutate()}
            >
              Relacionar
            </Button>
          </div>
        )}

        {relations.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nenhum projeto relacionado ainda.
          </p>
        )}

        {relations.map((relation) => {
          const otherId =
            relation.project_id === projectId
              ? relation.related_project_id
              : relation.project_id;
          const label =
            RELATION_TYPES.find((t) => t.value === relation.relation_type)?.label ??
            relation.relation_type;

          return (
            <div
              key={relation.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  to="/projetos/$projectId"
                  params={{ projectId: otherId }}
                  className="block truncate text-sm font-medium hover:text-primary transition-colors"
                >
                  {nameOf(otherId)}
                </Link>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {label}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Remover relação"
                onClick={() => removeRelation.mutate(relation.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
