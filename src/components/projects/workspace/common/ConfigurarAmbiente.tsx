import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Settings2, ArrowUp, ArrowDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ALL_TABS, type TabConfig, type TabKey } from "@/lib/workspace-tabs";
import { cn } from "@/lib/utils";

export interface ConfigurarAmbienteProps {
  projectId: string;
  config: TabConfig;
  /** Abas disponíveis para este tipo de projeto (ex.: "faculdade" só em Faculdade). */
  available: TabKey[];
}

export function ConfigurarAmbiente({
  projectId,
  config,
  available,
}: ConfigurarAmbienteProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TabConfig>(config);

  const save = useMutation({
    mutationFn: async (next: TabConfig) => {
      const { error } = await supabase
        .from("projects")
        .update({ tab_config: next as never })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Ambiente atualizado");
    },
    onError: (error: Error) => toast.error("Erro ao salvar: " + error.message),
  });

  const apply = (next: TabConfig) => {
    setDraft(next);
    save.mutate(next);
  };

  const toggle = (key: TabKey, enabled: boolean) => {
    const hidden = enabled
      ? draft.hidden.filter((k) => k !== key)
      : [...draft.hidden, key];
    apply({ ...draft, hidden });
  };

  const move = (key: TabKey, direction: -1 | 1) => {
    const order = draft.order.filter((k) => available.includes(k));
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    // Mantém as abas indisponíveis no fim, preservando a ordem original.
    const rest = draft.order.filter((k) => !available.includes(k));
    apply({ ...draft, order: [...order, ...rest] });
  };

  const orderedAvailable = draft.order.filter((k) => available.includes(k));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" /> Configurar Ambiente
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurar Ambiente</SheetTitle>
          <SheetDescription>
            Ative, oculte e reorganize as abas deste projeto. Ocultar uma aba não
            apaga nenhum dado.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {orderedAvailable.map((key, index) => {
            const tab = ALL_TABS.find((t) => t.key === key);
            if (!tab) return null;
            const enabled = !draft.hidden.includes(key);

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  !enabled && "opacity-60",
                )}
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    aria-label={`Mover ${tab.label} para cima`}
                    disabled={index === 0}
                    onClick={() => move(key, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    aria-label={`Mover ${tab.label} para baixo`}
                    disabled={index === orderedAvailable.length - 1}
                    onClick={() => move(key, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <span className="flex-1 text-sm font-medium">{tab.label}</span>

                <Switch
                  checked={enabled}
                  disabled={tab.locked}
                  aria-label={`Ativar aba ${tab.label}`}
                  onCheckedChange={(value) => toggle(key, value)}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
