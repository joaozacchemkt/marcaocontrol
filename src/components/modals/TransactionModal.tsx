import { useState, useEffect } from "react";
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
import { logActivity } from "@/lib/activity";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import {
  FINANCIAL_FREQUENCY_LABELS,
  advanceFinancialRecurrence,
  type FinancialFrequency,
} from "@/lib/financial-recurrence";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'receita' | 'despesa';
  initialProjectId?: string;
  /** Quando informado, o modal opera em modo de edição. */
  transaction?: any | null;
}


export function TransactionModal({ open, onOpenChange, type, initialProjectId, transaction }: TransactionModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(transaction?.id);

  const emptyForm = {
    description: "",
    amount: "",
    date: new Date().toISOString().split('T')[0]!,
    due_date: "",
    category: "Outros",
    project_id: initialProjectId || "none",
    contact_id: "none",
    status: "pendente" as 'pendente' | 'pago',
    notes: "",
    repete: "nao" as FinancialFrequency | "nao",
  };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (transaction?.id) {
      setFormData({
        description: transaction.description ?? "",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        date: transaction.date ? String(transaction.date).split('T')[0]! : new Date().toISOString().split('T')[0]!,
        due_date: transaction.due_date ? String(transaction.due_date).split('T')[0]! : "",
        category: transaction.category ?? "Outros",
        project_id: transaction.project_id ?? "none",
        contact_id: transaction.contact_id ?? "none",
        status: (transaction.status ?? "pendente") as 'pendente' | 'pago',
        notes: transaction.notes ?? "",
        repete: "nao",
      });
      return;
    }
    setFormData({ ...emptyForm, project_id: initialProjectId || "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProjectId, transaction]);


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
        notes: data.notes ? data.notes : null,
        type: type,
        user_id: userData.user.id
      };
      
      if (data.date) {
        insertData.date = data.date;
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('financial_transactions')
          .update({ ...insertData, user_id: undefined })
          .eq('id', transaction.id);
        if (updateError) throw updateError;
        // Mantém a regra de recorrência em sincronia com a edição, para as
        // próximas ocorrências não saírem com valor/descrição defasados.
        if (transaction.financial_recurrence_id) {
          await supabase
            .from('financial_recurrences')
            .update({
              description: insertData.description,
              amount: insertData.amount,
              category: insertData.category,
              project_id: insertData.project_id,
              contact_id: insertData.contact_id,
            })
            .eq('id', transaction.financial_recurrence_id);
        }
        return;
      }

      let recurrenceId: string | null = null;
      // "Repete": cria a regra de recorrência e amarra a este 1º lançamento.
      if (data.repete !== "nao") {
        const { data: rec, error: recErr } = await supabase
          .from("financial_recurrences")
          .insert({
            user_id: userData.user.id,
            project_id: insertData.project_id,
            contact_id: insertData.contact_id,
            description: insertData.description,
            type,
            amount: insertData.amount,
            category: insertData.category,
            frequency: data.repete,
            // start_date = vencimento original: é o dia-âncora da série.
            start_date: data.due_date || data.date || new Date().toISOString().split("T")[0],
            next_run: data.due_date || data.date || new Date().toISOString().split("T")[0],
          } as never)
          .select()
          .single();
        if (recErr) throw recErr;
        recurrenceId = (rec as { id: string } | null)?.id ?? null;
        insertData.financial_recurrence_id = recurrenceId;
      }

      const { data: created, error } = await supabase.from('financial_transactions').insert(insertData).select().single();

      if (error) {
        // Não deixa a regra órfã se o lançamento falhar.
        if (recurrenceId) {
          await supabase.from('financial_recurrences').delete().eq('id', recurrenceId);
        }
        throw error;
      }

      if (created && created.project_id) {
        await logActivity({
          projectId: created.project_id,
          type: 'transaction_created',
          description: `Nova ${type}: "${created.description}" (R$ ${created.amount})`,
          entityType: 'transaction',
          entityId: created.id
        });
      }

      // Se o 1º lançamento da recorrência já entrou como pago, gera o próximo
      // agora (o disparo normal é ao quitar — que não vai acontecer aqui).
      if (recurrenceId && created?.status === "pago") {
        await advanceFinancialRecurrence(
          recurrenceId,
          created.due_date ? String(created.due_date).slice(0, 10) : undefined,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial_pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['financial_recurrences'] });
      queryClient.invalidateQueries({ queryKey: ['financial_totals'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-transactions'] });
      toast.success(
        isEditing
          ? "Lançamento atualizado!"
          : `${type === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso!`,
      );
      onOpenChange(false);
      setFormData({ ...emptyForm, project_id: initialProjectId || "none" });
    },
    onError: (error) => {
      toast.error("Erro ao registrar: " + error.message);
    }
  });

  const submit = useGuardedSubmit(() => {
    if (!formData.description || !formData.amount) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    createTransaction.mutate(formData);
  }, createTransaction.isPending);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const categories = FINANCE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isEditing ? "Editar Lançamento" : "Novo Lançamento"}: <span className={type === 'receita' ? "text-emerald-500" : "text-destructive"}>{type === 'receita' ? 'Receita' : 'Despesa'}</span>
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

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="repete">Repete?</Label>
              <Select
                value={formData.repete}
                onValueChange={(v: any) => setFormData(prev => ({ ...prev, repete: v }))}
              >
                <SelectTrigger id="repete">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não — lançamento único</SelectItem>
                  {(Object.entries(FINANCIAL_FREQUENCY_LABELS) as [FinancialFrequency, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              {formData.repete !== "nao" && (
                <p className="text-[11px] text-muted-foreground">
                  Ao quitar este lançamento, o próximo é criado sozinho na data seguinte.
                </p>
              )}
            </div>
          )}

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
