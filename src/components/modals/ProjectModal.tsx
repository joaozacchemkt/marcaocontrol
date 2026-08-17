import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { logActivity } from "@/lib/activity";

type ProjectCategory = Database["public"]["Enums"]["project_status"] | string;

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    name?: string;
    description?: string;
    category?: string;
    notes?: string;
    ideaId?: string;
  } | null;
}

const CATEGORIES = [
  "Imóvel", "Terreno", "Obra/Reforma", "Consultoria", 
  "Perfil Público", "Novo Negócio", "Pessoal", "Outros"
];

const STATUS_OPTIONS = [
  { value: "ideia", label: "Ideia" },
  { value: "em_analise", label: "Em análise" },
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

export function ProjectModal({ open, onOpenChange, initialData }: ProjectModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: "",
    category: "Outros",
    description: "",
    objective: "",
    status: "ideia" as Database["public"]["Enums"]["project_status"],
    start_date: "",
    deadline: "",
    budget: "",
    next_action: "",
    notes: ""
  });
  
  useEffect(() => {
    if (open && initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || "",
        description: initialData.description || "",
        category: initialData.category || "Outros",
        notes: initialData.notes || "",
        status: "em_analise"
      }));
    }
  }, [open, initialData]);

  const createProject = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: project, error } = await supabase.from('projects').insert({
        user_id: userData.user.id,
        name: data.name.trim() || "Projeto sem título",
        category: data.category || null,
        description: data.description || null,
        objective: data.objective || null,
        status: data.status || "ideia",
        next_action: data.next_action || null,
        notes: data.notes || null,
        budget: data.budget !== "" && !isNaN(parseFloat(data.budget)) ? parseFloat(data.budget) : null,
        start_date: data.start_date || null,
        deadline: data.deadline || null,
      }).select().single();
      
      if (error) throw error;
      
      if (project) {
        await logActivity({
          projectId: project.id,
          type: 'project_created',
          description: `Projeto "${project.name}" foi criado.`,
          entityType: 'project',
          entityId: project.id
        });
      }
      
      if (initialData?.ideaId) {
        await supabase
          .from('ideas')
          .update({ 
            status: 'virou_projeto' as any,
            notes: (initialData.notes || '') + '\n[Convertido em projeto]'
          })
          .eq('id', initialData.ideaId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success("Projeto criado com sucesso!");
      onOpenChange(false);
      setFormData({
        name: "",
        category: "Outros",
        description: "",
        objective: "",
        status: "ideia",
        start_date: "",
        deadline: "",
        budget: "",
        next_action: "",
        notes: ""
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar projeto: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Novo Projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nome do Projeto</Label>
              <Input 
                id="name" 
                placeholder="Ex: Reforma Apartamento Jardins" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={v => setFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: any) => setFormData(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">Objetivo</Label>
            <Input 
              id="objective" 
              placeholder="Qual o principal objetivo deste projeto?" 
              value={formData.objective}
              onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Início</Label>
              <Input 
                id="start_date" 
                type="date"
                value={formData.start_date}
                onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo</Label>
              <Input 
                id="deadline" 
                type="date"
                value={formData.deadline}
                onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Valor Envolvido (R$)</Label>
              <Input 
                id="budget" 
                type="number"
                placeholder="0,00"
                value={formData.budget}
                onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_action">Próxima Ação</Label>
            <Input 
              id="next_action" 
              placeholder="O que precisa ser feito agora?" 
              value={formData.next_action}
              onChange={e => setFormData(prev => ({ ...prev, next_action: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea 
              id="description" 
              placeholder="Detalhes gerais do projeto..." 
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createProject.isPending} className="px-8">
              {createProject.isPending ? "Criando..." : "Criar Projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
