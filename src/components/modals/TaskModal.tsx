import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { logActivity } from "@/lib/activity";

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string;
  initialContactId?: string;
  task?: any | null;
}

export function TaskModal({ open, onOpenChange, initialProjectId, initialContactId, task }: TaskModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(task?.id);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    project_id: initialProjectId || "",
    contact_id: initialContactId || "",
    responsible: "",
    deadline: "",
    priority: "media" as "baixa" | "media" | "alta",
    status: "a_fazer" as any,
    waiting_for: "",
    notes: "",
    estimated_minutes: "",
    actual_minutes: ""
  });

  useEffect(() => {
    if (!open) return;
    if (task?.id) {
      setFormData({
        title: task.title ?? "",
        description: task.description ?? "",
        project_id: task.project_id ?? "",
        contact_id: task.contact_id ?? "",
        responsible: task.responsible ?? "",
        deadline: task.deadline ? String(task.deadline).slice(0, 10) : "",
        priority: (task.priority ?? "media") as "baixa" | "media" | "alta",
        status: task.status ?? "a_fazer",
        waiting_for: task.waiting_for ?? "",
        notes: task.notes ?? "",
        estimated_minutes: task.estimated_minutes != null ? String(task.estimated_minutes) : "",
        actual_minutes: task.actual_minutes != null ? String(task.actual_minutes) : "",
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      project_id: initialProjectId || prev.project_id,
      contact_id: initialContactId || prev.contact_id,
    }));
  }, [open, initialProjectId, initialContactId, task]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-select'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return data || [];
    }
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-select'],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, name');
      return data || [];
    }
  });

  const createTask = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const toMinutes = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };

      const payload = {
        ...data,
        deadline: data.deadline || null,
        project_id: data.project_id && data.project_id !== 'none' ? data.project_id : null,
        contact_id: data.contact_id && data.contact_id !== 'none' ? data.contact_id : null,
        estimated_minutes: toMinutes(data.estimated_minutes),
        actual_minutes: toMinutes(data.actual_minutes),
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', task.id);
        if (updateError) throw updateError;
        return;
      }

      const { data: created, error } = await supabase.from('tasks').insert({
        ...payload,
        user_id: userData.user.id,
      }).select().single();

      if (error) throw error;

      if (created && created.project_id) {
        await logActivity({
          projectId: created.project_id,
          type: 'task_created',
          description: `Nova pendência criada: "${created.title}"`,
          entityType: 'task',
          entityId: created.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-calendar'] });
      toast.success(isEditing ? "Pendência atualizada!" : "Pendência criada com sucesso!");
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        project_id: initialProjectId || "",
        contact_id: initialContactId || "",
        responsible: "",
        deadline: "",
        priority: "media",
        status: "a_fazer",
        waiting_for: "",
        notes: "",
        estimated_minutes: "",
        actual_minutes: ""
      });
    },
    onError: (error) => {
      toast.error((isEditing ? "Erro ao atualizar pendência: " : "Erro ao criar pendência: ") + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Título é obrigatório");
      return;
    }
    createTask.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pendência" : "Nova Pendência"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input 
              id="title" 
              placeholder="O que precisa ser feito?" 
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Projeto</Label>
              <Select 
                value={formData.project_id} 
                onValueChange={v => setFormData(prev => ({ ...prev, project_id: v }))}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-contact">Contato vinculado</Label>
              <Select
                value={formData.contact_id || 'none'}
                onValueChange={v => setFormData(prev => ({ ...prev, contact_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="task-contact">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável</Label>
              <Input 
                id="responsible" 
                placeholder="Quem fará?" 
                value={formData.responsible}
                onChange={e => setFormData(prev => ({ ...prev, responsible: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="priority">Prioridade</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v: any) => setFormData(prev => ({ ...prev, priority: v }))}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea 
              id="description" 
              placeholder="Detalhes da tarefa..." 
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  <SelectItem value="a_fazer">A fazer</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="aguardando_terceiro">Aguardando terceiro</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waiting">Aguardando quem?</Label>
              <Input 
                id="waiting" 
                placeholder="Nome da pessoa/empresa" 
                value={formData.waiting_for}
                onChange={e => setFormData(prev => ({ ...prev, waiting_for: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated">Tempo estimado (min)</Label>
              <Input
                id="estimated"
                type="number"
                min={0}
                placeholder="Ex.: 60"
                value={formData.estimated_minutes}
                onChange={e => setFormData(prev => ({ ...prev, estimated_minutes: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual">Tempo realizado (min)</Label>
              <Input
                id="actual"
                type="number"
                min={0}
                placeholder="Ex.: 45"
                value={formData.actual_minutes}
                onChange={e => setFormData(prev => ({ ...prev, actual_minutes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Pendência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
