import { useEffect, useState } from "react";
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
import { combineDateTime } from "@/lib/reminders";
import { format } from "date-fns";

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContactId?: string;
  initialProjectId?: string;
  /** Quando informado, o modal opera em modo de edição. */
  event?: any | null;
}

export function EventModal({ open, onOpenChange, initialContactId, initialProjectId, event }: EventModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(event?.id);

  const toDateAndTime = (value?: string | null) => {
    if (!value) return { date: "", time: "" };
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
    return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
  };
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    location: "",
    objective: "",
    project_id: initialProjectId || "",
    contact_id: initialContactId || "",
    pre_meeting_notes: ""
  });

  useEffect(() => {
    if (!open) return;
    const start = toDateAndTime(event?.start_time);
    const end = toDateAndTime(event?.end_time);
    setFormData({
      title: event?.title ?? "",
      description: event?.description ?? "",
      start_date: start.date,
      start_time: start.time || "09:00",
      end_date: end.date,
      end_time: end.time,
      location: event?.location ?? "",
      objective: event?.objective ?? "",
      project_id: event?.project_id ?? initialProjectId ?? "",
      contact_id: event?.contact_id ?? initialContactId ?? "",
      pre_meeting_notes: event?.pre_meeting_notes ?? "",
    });
  }, [open, event, initialProjectId, initialContactId]);

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

  const createEvent = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const start = combineDateTime(data.start_date, data.start_time);
      if (Number.isNaN(start.getTime())) throw new Error("Data/hora de início inválida");
      const end = data.end_date
        ? combineDateTime(data.end_date, data.end_time || data.start_time)
        : null;
      if (end && Number.isNaN(end.getTime())) throw new Error("Data/hora de término inválida");

      const { start_date, start_time, end_date, end_time, ...rest } = data;
      const payload = {
        ...rest,
        start_time: start.toISOString(),
        end_time: end ? end.toISOString() : null,
        project_id: data.project_id || null,
        contact_id: data.contact_id || null,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('events')
          .update(payload)
          .eq('id', event.id);
        if (updateError) throw updateError;
        return;
      }

      const { data: created, error } = await supabase.from('events').insert({
        ...payload,
        user_id: userData.user.id,
      }).select().single();

      if (error) throw error;
      
      if (created && created.project_id) {
        await logActivity({
          projectId: created.project_id,
          type: 'event_created',
          description: `Novo compromisso agendado: "${created.title}"`,
          entityType: 'event',
          entityId: created.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(isEditing ? "Compromisso atualizado!" : "Compromisso agendado com sucesso!");
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        start_date: "",
        start_time: "09:00",
        end_date: "",
        end_time: "",
        location: "",
        objective: "",
        project_id: initialProjectId || "",
        contact_id: initialContactId || "",
        pre_meeting_notes: ""
      });
    },
    onError: (error) => {
      toast.error("Erro ao salvar compromisso: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.start_date) {
      toast.error("Título e data de início são obrigatórios");
      return;
    }
    createEvent.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Compromisso" : "Novo Compromisso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Evento *</Label>
            <Input 
              id="title" 
              placeholder="Reunião de Alinhamento, Visita, etc." 
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data de início *</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.start_date}
                onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Hora de início</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.start_time}
                onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="end-date">Data de término (opcional)</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.end_date}
                onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Hora de término</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.end_time}
                onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Projeto</Label>
              <Select 
                value={formData.project_id} 
                onValueChange={v => setFormData(prev => ({ ...prev, project_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="Selecione..." />
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
              <Label htmlFor="contact">Contato</Label>
              <Select 
                value={formData.contact_id} 
                onValueChange={v => setFormData(prev => ({ ...prev, contact_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="contact">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Local / Link da Reunião</Label>
            <Input 
              id="location" 
              placeholder="Google Meet, Escritório, etc." 
              value={formData.location}
              onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">Objetivo Principal</Label>
            <Input 
              id="objective" 
              placeholder="O que deve ser resolvido?" 
              value={formData.objective}
              onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pre_notes">Notas Pré-Reunião</Label>
            <Textarea 
              id="pre_notes" 
              placeholder="Pautas, documentos necessários..." 
              value={formData.pre_meeting_notes}
              onChange={e => setFormData(prev => ({ ...prev, pre_meeting_notes: e.target.value }))}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Agendar Compromisso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
