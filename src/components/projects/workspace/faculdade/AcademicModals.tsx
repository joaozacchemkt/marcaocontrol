
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";
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

interface AcademicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Quando presente, o modal entra em modo edição. */
  item?: any | null;
}

/** Hook compartilhado: matérias do projeto para os selects. */
function useSubjects(projectId: string) {
  return useQuery({
    queryKey: ['academic-subjects-select', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_subjects')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      return data || [];
    }
  });
}

/* ------------------------------- MATÉRIAS ------------------------------- */

export function SubjectModal({ open, onOpenChange, projectId, item }: AcademicModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(item?.id);

  const empty = {
    name: "",
    professor: "",
    period: "",
    schedule: "",
    location: "",
    absences_limit: "",
    current_absences: "",
    notes: "",
  };
  const [formData, setFormData] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setFormData(item?.id ? {
      name: item.name ?? "",
      professor: item.professor ?? "",
      period: item.period ?? "",
      schedule: item.schedule ?? "",
      location: item.location ?? "",
      absences_limit: item.absences_limit != null ? String(item.absences_limit) : "",
      current_absences: item.current_absences != null ? String(item.current_absences) : "",
      notes: item.notes ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const toInt = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");
      if (!formData.name.trim()) throw new Error("Informe o nome da matéria");

      const payload = {
        name: formData.name.trim(),
        professor: formData.professor || null,
        period: formData.period || null,
        schedule: formData.schedule || null,
        location: formData.location || null,
        absences_limit: toInt(formData.absences_limit),
        current_absences: toInt(formData.current_absences) ?? 0,
        notes: formData.notes || null,
        project_id: projectId,
      };

      if (isEditing) {
        const { error } = await supabase.from('academic_subjects').update(payload).eq('id', item.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('academic_subjects').insert({
        ...payload,
        status: 'ativa',
        user_id: userData.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['academic-subjects-select', projectId] });
      toast.success(isEditing ? "Matéria atualizada!" : "Matéria cadastrada!");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error("Erro ao salvar matéria: " + error.message),
  });

  const submit = useGuardedSubmit(() => save.mutate(), save.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Matéria" : "Nova Matéria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject-name">Nome *</Label>
            <Input
              id="subject-name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex.: Direito Constitucional"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-professor">Professor</Label>
              <Input
                id="subject-professor"
                value={formData.professor}
                onChange={e => setFormData(prev => ({ ...prev, professor: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-period">Período</Label>
              <Input
                id="subject-period"
                value={formData.period}
                onChange={e => setFormData(prev => ({ ...prev, period: e.target.value }))}
                placeholder="Ex.: 2026.1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-schedule">Horário</Label>
              <Input
                id="subject-schedule"
                value={formData.schedule}
                onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                placeholder="Ex.: Seg/Qua 19h"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-location">Local</Label>
              <Input
                id="subject-location"
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-absences-limit">Limite de faltas</Label>
              <Input
                id="subject-absences-limit"
                type="number"
                min={0}
                value={formData.absences_limit}
                onChange={e => setFormData(prev => ({ ...prev, absences_limit: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-absences">Faltas atuais</Label>
              <Input
                id="subject-absences"
                type="number"
                min={0}
                value={formData.current_absences}
                onChange={e => setFormData(prev => ({ ...prev, current_absences: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-notes">Observações</Label>
            <Textarea
              id="subject-notes"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- PROVAS -------------------------------- */

export function ExamModal({ open, onOpenChange, projectId, item }: AcademicModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(item?.id);
  const empty = { title: "", subject_id: "", date: "", exam_time: "", weight: "", grade: "", status: "a_estudar", notes: "" };
  const [formData, setFormData] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setFormData(item?.id ? {
      title: item.title ?? "",
      subject_id: item.subject_id ?? "",
      date: item.date ? String(item.date).slice(0, 10) : "",
      exam_time: item.exam_time ?? "",
      weight: item.weight != null ? String(item.weight) : "",
      grade: item.grade != null ? String(item.grade) : "",
      status: item.status ?? "a_estudar",
      notes: item.notes ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const { data: subjects = [] } = useSubjects(projectId);

  const toNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const payload = {
        title: formData.title,
        subject_id: formData.subject_id,
        date: formData.date,
        exam_time: formData.exam_time || null,
        weight: toNumber(formData.weight),
        grade: toNumber(formData.grade),
        notes: formData.notes || null,
        status: formData.status as any,
      };

      if (isEditing) {
        const { error } = await supabase.from('academic_exams').update(payload).eq('id', item.id);
        if (error) throw error;
        return;
      }

      const { data: exam, error } = await supabase
        .from('academic_exams')
        .insert({ ...payload, user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;

      if (exam) {
        await logActivity({
          projectId,
          type: 'task_created',
          description: `Nova prova agendada: "${formData.title}"`,
          entityType: 'academic_exam',
          entityId: exam.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-exams'] });
      toast.success(isEditing ? "Prova atualizada!" : "Prova agendada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error("Erro ao salvar prova: " + error.message),
  });

  const submit = useGuardedSubmit(() => save.mutate(), save.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Prova" : "Agendar Prova"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 py-4">
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Peso</Label>
              <Input value={formData.weight} onChange={e => setFormData(prev => ({ ...prev, weight: e.target.value }))} placeholder="Ex.: 3" />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input value={formData.grade} onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))} placeholder="Ex.: 8.5" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_estudar">A estudar</SelectItem>
                  <SelectItem value="estudando">Estudando</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="corrigida">Corrigida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Anotações</Label>
            <Textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- TRABALHOS ------------------------------- */

export function AssignmentModal({ open, onOpenChange, projectId, item }: AcademicModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(item?.id);
  const empty = { title: "", subject_id: "", deadline: "", weight: "", grade: "", status: "nao_iniciado", description: "" };
  const [formData, setFormData] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setFormData(item?.id ? {
      title: item.title ?? "",
      subject_id: item.subject_id ?? "",
      deadline: item.deadline ? String(item.deadline).slice(0, 10) : "",
      weight: item.weight != null ? String(item.weight) : "",
      grade: item.grade != null ? String(item.grade) : "",
      status: item.status ?? "nao_iniciado",
      description: item.description ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const { data: subjects = [] } = useSubjects(projectId);

  const toNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const payload = {
        title: formData.title,
        subject_id: formData.subject_id,
        project_id: projectId,
        deadline: formData.deadline || null,
        weight: toNumber(formData.weight),
        grade: toNumber(formData.grade),
        description: formData.description || null,
        status: formData.status,
      };

      if (isEditing) {
        const { error } = await supabase.from('academic_assignments').update(payload).eq('id', item.id);
        if (error) throw error;
        return;
      }

      const { data: assignment, error } = await supabase
        .from('academic_assignments')
        .insert({ ...payload, user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;

      if (assignment) {
        await logActivity({
          projectId,
          type: 'task_created',
          description: `Novo trabalho cadastrado: "${formData.title}"`,
          entityType: 'academic_assignment',
          entityId: assignment.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-assignments'] });
      toast.success(isEditing ? "Trabalho atualizado!" : "Trabalho cadastrado!");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error("Erro ao salvar trabalho: " + error.message),
  });

  const submit = useGuardedSubmit(() => save.mutate(), save.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Trabalho" : "Novo Trabalho/Atividade"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 py-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prazo de Entrega</Label>
              <Input type="date" value={formData.deadline} onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="corrigido">Corrigido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso</Label>
              <Input value={formData.weight} onChange={e => setFormData(prev => ({ ...prev, weight: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input value={formData.grade} onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

