import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/workspace-modules";
import { MODULE_TABS_BY_TYPE } from "@/lib/workspace-tabs";
import { ModuleBoard } from "./ModuleBoard";

export interface ModulesHubProps {
  projectId: string;
  projectType: string;
}

/**
 * Ponto único para todos os "módulos" de um projeto (Materiais, Cronograma,
 * Pipeline, Personas...). Antes, cada módulo era uma aba própria no topo do
 * workspace — até 20 abas num projeto só. Aqui viram um filtro dentro de uma
 * única aba, reaproveitando o mesmo ModuleBoard e a mesma tabela
 * workspace_items: nenhum dado muda de lugar, só a navegação deixa de ser
 * "decorar em qual aba cada coisa mora".
 */
export function ModulesHub({ projectId, projectType }: ModulesHubProps) {
  const moduleKeys = useMemo(
    () => MODULE_TABS_BY_TYPE[projectType] ?? [],
    [projectType],
  );

  const [active, setActive] = useState<string>(moduleKeys[0] ?? "");
  const activeKey = (moduleKeys as string[]).includes(active) ? active : (moduleKeys[0] ?? "");

  // Contagem por módulo, pra ver de longe onde tem algo pendente sem abrir um por um.
  // Fica sob o mesmo prefixo ["workspace-items", projectId] que ModuleBoard usa
  // pra invalidar — assim salvar/mover/excluir um item atualiza o badge na hora,
  // sem precisar sair da aba e voltar.
  const { data: counts = {} } = useQuery({
    queryKey: ["workspace-items", projectId, "counts", moduleKeys.join(",")],
    enabled: moduleKeys.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_items")
        .select("module")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .in("module", moduleKeys);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { module: string }[]) {
        map[row.module] = (map[row.module] ?? 0) + 1;
      }
      return map;
    },
  });

  if (moduleKeys.length === 0 || !activeKey) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {moduleKeys.map((key) => {
          const module = MODULES[key];
          if (!module) return null;
          const count = counts[key] ?? 0;
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {module.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    isActive ? "bg-primary-foreground/20" : "bg-accent",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ModuleBoard projectId={projectId} moduleKey={activeKey} />
    </div>
  );
}
