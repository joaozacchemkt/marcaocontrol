import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";

export const IDEA_STATUS_OPTIONS = [
  { value: "ideia", label: "Ideia" },
  { value: "estudar", label: "Estudar" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "virou_projeto", label: "Virou projeto" },
  { value: "arquivada", label: "Arquivada" },
] as const;

const CATEGORIES = [
  "Negócio",
  "Imóvel",
  "Produto",
  "Conteúdo",
  "Investimento",
  "Pessoal",
  "Outros",
];

interface IdeaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o modal opera em modo de edição. */
  idea?: any | null;
}

export function IdeaModal({ open, onOpenChange, idea }: IdeaModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(idea?.id);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Outros",
    status: "ideia",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      title: idea?.title ?? "",
      description: idea?.description ?? "",
      category: idea?.category ?? "Outros",
      status: idea?.status ?? "ideia",
      notes: idea?.notes ?? "",
    });
  }, [open, idea]);

  const saveIdea = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const payload = {
        title: data.title.trim() || "Insight sem título",
        description: data.description || null,
        category: data.category || null,
        status: data.status as any,
        notes: data.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("ideas").update(payload).eq("id", idea.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("ideas")
        .insert({ ...payload, user_id: userData.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success(isEditing ? "Insight atualizado!" : "Insight registrado!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar insight: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveIdea.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? "Editar Insight" : "Novo Insight"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="idea-title">Título</Label>
            <Input
              id="idea-title"
              placeholder="Ex: Plataforma de locação por temporada"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-description">Descrição</Label>
            <Textarea
              id="idea-description"
              className="h-24"
              placeholder="O que é a ideia e por que vale a pena?"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="idea-category">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger id="idea-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger id="idea-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDEA_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-notes">Observações</Label>
            <Textarea
              id="idea-notes"
              className="h-20"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveIdea.isPending}>
              {saveIdea.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
