import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Formulário único de criação/edição — nenhum campo é obrigatório. */
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

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setStage(item?.stage ?? defaultStage);
    setAmount(item?.amount != null ? String(item.amount) : "");
    setDueDate(item?.due_date ?? "");
  }, [open, item, defaultStage]);

  const submit = () => {
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-title">Título</Label>
            <Input
              id="module-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`${module.itemLabel}...`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Descrição</Label>
            <Textarea
              id="module-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Estágio</Label>
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
