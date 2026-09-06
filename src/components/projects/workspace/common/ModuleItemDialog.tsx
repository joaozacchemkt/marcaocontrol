import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleDefinition } from "@/lib/workspace-modules";
import type { WorkspaceItem } from "./workspace-item";

export interface ModuleItemDialogProps {
  module: ModuleDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WorkspaceItem | null;
  defaultStage: string;
  saving: boolean;
  onSubmit: (values: {
    title: string;
    description: string | null;
    stage: string;
    amount: number | null;
    due_date: string | null;
  }) => void;
}

/**
 * Registrar algo num módulo é: escrever o quê e apertar salvar. Situação,
 * data e valor ficam recolhidos em "Mais detalhes" — a situação já entra
 * na primeira do fluxo (a de "novo"), que é o que se quer em 9 de cada 10
 * casos. Ao editar, os detalhes já abrem, pra ver o que está preenchido.
 */
export function ModuleItemDialog({
  module,
  open,
  onOpenChange,
  item,
  defaultStage,
  saving,
  onSubmit,
}: ModuleItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState(defaultStage);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setStage(item?.stage ?? defaultStage);
    setAmount(item?.amount != null ? String(item.amount) : "");
    setDueDate(item?.due_date ?? "");
    // Ao editar já mostra os detalhes; ao criar, começa recolhido.
    setDetailsOpen(Boolean(item));
  }, [open, item, defaultStage]);

  const submit = () => {
    // O <form> permite enviar com Enter — sem esta guarda, dois Enter
    // rápidos (ou rede lenta) criariam dois workspace_items iguais, já que
    // o disabled do botão só entra no próximo render.
    if (saving) return;
    const parsed = amount.trim() === "" ? null : Number(amount);
    onSubmit({
      title: title.trim() || `${module.itemLabel} sem título`,
      description: description.trim() || null,
      stage,
      amount: parsed != null && Number.isFinite(parsed) ? parsed : null,
      due_date: dueDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? `Editar ${module.itemLabel}` : `Novo(a) ${module.itemLabel}`}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="module-title">O quê</Label>
            <Input
              id="module-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`${module.itemLabel}...`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Observação</Label>
            <Textarea
              id="module-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    detailsOpen && "rotate-180",
                  )}
                />
                Mais detalhes
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger>
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
                </div>

                {module.date && (
                  <div className="space-y-2">
                    <Label htmlFor="module-date">Data prevista</Label>
                    <Input
                      id="module-date"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </div>
                )}

                {module.amount && (
                  <div className="space-y-2">
                    <Label htmlFor="module-amount">Valor (R$)</Label>
                    <Input
                      id="module-amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
