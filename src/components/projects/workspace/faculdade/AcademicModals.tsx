
import { useState } from "react";
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
import { ProjectFiles } from "../common/ProjectFiles";

interface ExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ExamModal({ open, onOpenChange, projectId }: ExamModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    date: "",
    exam_time: "",
    weight: "",
    notes: ""
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['academic-subjects-select', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_subjects')
        .select('id, name')
        .eq('project_id', projectId);
      return data || [];
    }
  });

  const createExam = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: exam, error } = await supabase.from('academic_exams').insert({
        title: data.title,
        subject_id: data.subject_id,
        date: data.date,
        exam_time: data.exam_time || null,
        weight: data.weight ? parseFloat(data.weight) : null,
        notes: data.notes || null,
        user_id: userData.user.id,
        status: 'a_estudar' as any
      }).select().single();

      if (error) throw error;

      if (exam) {
        await logActivity({
          projectId,
          type: 'task_created',
          description: `Nova prova agendada: "${data.title}"`,
          entityType: 'academic_exam',
          entityId: exam.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-exams'] });
      toast.success("Prova agendada com sucesso!");
      onOpenChange(false);
      setFormData({ title: "", subject_id: "", date: "", exam_time: "", weight: "", notes: "" });
    },
    onError: (error) => {
      toast.error("Erro ao agendar prova: " + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agendar Prova</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createExam.mutate(formData); }} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título da Prova *</Label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: P1 - Cálculo I"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Matéria *</Label>
            <Select value={formData.subject_id} onValueChange={v => setFormData(prev => ({ ...prev, subject_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a matéria" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={formData.exam_time} onChange={e => setFormData(prev => ({ ...prev, exam_time: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createExam.isPending}>Agendar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentModal({ open, onOpenChange, projectId }: ExamModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ title: "", subject_id: "", deadline: "", weight: "", description: "" });

  const { data: subjects = [] } = useQuery({
    queryKey: ['academic-subjects-select', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_subjects').select('id, name').eq('project_id', projectId);
      return data || [];
    }
  });

  const createAssignment = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: assignment, error } = await supabase.from('academic_assignments').insert({
        title: data.title,
        subject_id: data.subject_id,
        project_id: projectId,
        deadline: data.deadline || null,
        weight: data.weight ? parseFloat(data.weight) : null,
        description: data.description || null,
        user_id: userData.user.id,
        status: 'nao_iniciado'
      }).select().single();

      if (error) throw error;
      if (assignment) {
        await logActivity({
          projectId,
          type: 'task_created',
          description: `Novo trabalho cadastrado: "${data.title}"`,
          entityType: 'academic_assignment',
          entityId: assignment.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-assignments'] });
      toast.success("Trabalho cadastrado!");
      onOpenChange(false);
      setFormData({ title: "", subject_id: "", deadline: "", weight: "", description: "" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Trabalho/Atividade</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createAssignment.mutate(formData); }} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Matéria *</Label>
            <Select value={formData.subject_id} onValueChange={v => setFormData(prev => ({ ...prev, subject_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a matéria" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prazo de Entrega</Label>
            <Input type="date" value={formData.deadline} onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))} />
          </div>
          <DialogFooter><Button type="submit">Cadastrar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SummaryModal({ open, onOpenChange, projectId }: ExamModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ title: "", subject_id: "", content: "" });

  const { data: subjects = [] } = useQuery({
    queryKey: ['academic-subjects-select', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_subjects').select('id, name').eq('project_id', projectId);
      return data || [];
    }
  });

  const createSummary = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: summary, error } = await supabase.from('academic_summaries').insert({
        title: data.title,
        subject_id: data.subject_id,
        project_id: projectId,
        content: data.content,
        user_id: userData.user.id
      }).select().single();

      if (error) throw error;
      if (summary) {
        await logActivity({
          projectId,
          type: 'note_created',
          description: `Novo resumo criado: "${data.title}"`,
          entityType: 'academic_summary',
          entityId: summary.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-summaries'] });
      toast.success("Resumo salvo!");
      onOpenChange(false);
      setFormData({ title: "", subject_id: "", content: "" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Novo Resumo de Estudo</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createSummary.mutate(formData); }} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Matéria *</Label>
            <Select value={formData.subject_id} onValueChange={v => setFormData(prev => ({ ...prev, subject_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a matéria" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conteúdo do Resumo</Label>
              <Textarea className="min-h-[200px]" value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} />
            </div>
            <div className="pt-4 border-t">
              <Label className="text-xs font-bold uppercase mb-2 block">Anexos e Referências</Label>
              <ProjectFiles project={{ id: projectId }} />
            </div>
          </div>
          <DialogFooter><Button type="submit">Salvar Resumo</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
