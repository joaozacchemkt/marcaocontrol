
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { cn } from "@/lib/utils";

interface ProjectFinanceProps {
  project: any;
}

export function ProjectFinance({ project }: ProjectFinanceProps) {
  const [activeModal, setActiveModal] = useState<'revenue' | 'expense' | null>(null);

  const receitas = project.financial_transactions
    ?.filter((t: any) => t.type === 'receita')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;
  
  const despesas = project.financial_transactions
    ?.filter((t: any) => t.type === 'despesa')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;

  const resultadoFinanceiro = receitas - despesas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Fluxo de Caixa do Projeto</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-emerald-600" onClick={() => setActiveModal('revenue')}>
            <TrendingUp className="h-4 w-4 mr-2" /> Receita
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setActiveModal('expense')}>
            <TrendingDown className="h-4 w-4 mr-2" /> Despesa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Total Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margem / Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", resultadoFinanceiro < 0 ? "text-destructive" : "text-emerald-600")}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultadoFinanceiro)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {project.financial_transactions?.length > 0 ? (
              project.financial_transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-full", t.type === 'receita' ? "bg-emerald-100 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                      {t.type === 'receita' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.category || "Geral"}</p>
                    </div>
                  </div>
                  <span className={cn("font-bold", t.type === 'receita' ? "text-emerald-600" : "text-destructive")}>
                    {t.type === 'receita' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma transação registrada para este projeto.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionModal 
        open={activeModal !== null} 
        onOpenChange={() => setActiveModal(null)}
        type={activeModal === 'revenue' ? 'receita' : 'despesa'}
        initialProjectId={project.id}
      />
    </div>
  );
}
