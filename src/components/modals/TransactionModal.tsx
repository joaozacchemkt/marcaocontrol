import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'receita' | 'despesa';
}

const REVENUE_CATEGORIES = ["Venda", "Consultoria", "Honorário", "Dividendos", "Aporte", "Outros"];
const EXPENSE_CATEGORIES = ["Obra", "Manutenção", "Imposto", "Marketing", "Administrativo", "Pessoal", "Viagem", "Outros"];

export function TransactionModal({ open, onOpenChange, type }: TransactionModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    due_date: "",
    category: "Outros",
    project_id: "none",
    contact_id: "none",
    status: "pendente" as 'pendente' | 'pago',
    notes: ""
  });

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

  const createTransaction = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const insertData: any = {
        description: data.description,
        amount: parseFloat(data.amount),
        due_date: data.due_date || null,
        category: data.category,
        project_id: data.project_id === 'none' ? null : data.project_id,
        contact_id: data.contact_id === 'none' ? null : data.contact_id,
        status: data.status,
        type: type,
        user_id: userData.user.id
      };
      
      if (data.date) {
        insertData.date = data.date;
      }

      const { error } = await supabase.from('financial_transactions').insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['project'] }); // Para atualizar o financeiro do projeto
      toast.success(`${type === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso!`);
      onOpenChange(false);
      setFormData({
        description: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        due_date: "",
        category: "Outros",
        project_id: "none",
        contact_id: "none",
        status: "pendente",
        notes: ""
      });
    },
    onError: (error) => {
      toast.error("Erro ao registrar: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    createTransaction.mutate(formData);
  };

  const categories = type === 'receita' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            Novo Lançamento: <span className={type === 'receita' ? "text-emerald-500" : "text-destructive"}>{type === 'receita' ? 'Receita' : 'Despesa'}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input 
                id="description" 
                placeholder="Ex: Aluguel Unidade 12" 
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input 
                id="amount" 
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data do Lançamento</Label>
              <Input 
                id="date" 
                type="date"
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Vencimento</Label>
              <Input 
                id="due_date" 
                type="date"
                value={formData.due_date}
                onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  {categories.map(cat => (
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
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago / Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Projeto Relacionado</Label>
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
              <Label htmlFor="contact">Contato Relacionado</Label>
              <Select 
                value={formData.contact_id} 
                onValueChange={v => setFormData(prev => ({ ...prev, contact_id: v }))}
              >
                <SelectTrigger id="contact">
                  <SelectValue placeholder="Selecione um contato" />
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
            <Label htmlFor="notes">Observações</Label>
            <Textarea 
              id="notes" 
              placeholder="Notas adicionais..." 
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="h-20"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createTransaction.isPending} className={type === 'receita' ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
              {createTransaction.isPending ? "Salvando..." : `Salvar ${type === 'receita' ? 'Receita' : 'Despesa'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
