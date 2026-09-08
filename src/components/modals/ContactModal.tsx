import { useEffect, useState } from "react";
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

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o modal opera em modo de edição. */
  contact?: any | null;
}

const CATEGORIES = [
  "Cliente", "Corretor", "Investidor", "Empresário", "Parceiro", 
  "Prestador", "Advogado", "Arquiteto", "Engenheiro", 
  "Fornecedor", "Lead", "Institucional", "Outros"
];

export function ContactModal({ open, onOpenChange, contact }: ContactModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(contact?.id);
  
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    role: "",
    phone: "",
    whatsapp: "",
    email: "",
    city: "",
    category: "Outros",
    notes: "",
    last_contact: "",
    next_contact: "",
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      name: contact?.name ?? "",
      company: contact?.company ?? "",
      role: contact?.role ?? "",
      phone: contact?.phone ?? "",
      whatsapp: contact?.whatsapp ?? "",
      email: contact?.email ?? "",
      city: contact?.city ?? "",
      category: contact?.category ?? "Outros",
      notes: contact?.notes ?? "",
      last_contact: contact?.last_contact ? String(contact.last_contact).slice(0, 10) : "",
      next_contact: contact?.next_contact ? String(contact.next_contact).slice(0, 10) : "",
    });
  }, [open, contact]);

  const createContact = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Datas vazias viram null (colunas timestamptz não aceitam "").
      const payload = {
        ...data,
        last_contact: data.last_contact || null,
        next_contact: data.next_contact || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', contact.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('contacts').insert({
        ...payload,
        user_id: userData.user.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-select'] });
      toast.success(isEditing ? "Contato atualizado!" : "Contato adicionado com sucesso!");
      onOpenChange(false);
      setFormData({
        name: "",
        company: "",
        role: "",
        phone: "",
        whatsapp: "",
        email: "",
        city: "",
        category: "Outros",
        notes: "",
        last_contact: "",
        next_contact: "",
      });
    },
    onError: (error) => {
      toast.error("Erro ao salvar contato: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    createContact.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isEditing ? "Editar Contato" : "Novo Contato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input 
              id="name" 
              placeholder="Nome completo" 
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input 
                id="company" 
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Input 
                id="role" 
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input 
                id="phone" 
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input 
                id="whatsapp" 
                value={formData.whatsapp}
                onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input 
                id="city" 
                value={formData.city}
                onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
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
                <SelectContent className="max-h-[200px]">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last_contact">Último contato</Label>
              <Input
                id="last_contact"
                type="date"
                value={formData.last_contact}
                onChange={e => setFormData(prev => ({ ...prev, last_contact: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_contact">Retornar em</Label>
              <Input
                id="next_contact"
                type="date"
                value={formData.next_contact}
                onChange={e => setFormData(prev => ({ ...prev, next_contact: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="h-20"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Salvar Contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
