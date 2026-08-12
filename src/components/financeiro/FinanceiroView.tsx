import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TransactionModal } from "@/components/modals/TransactionModal";

export function FinanceiroView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [activeModal, setActiveModal] = useState<'receita' | 'despesa' | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['financial_transactions', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, projects(name), contacts(name)')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString())
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: allTotals } = useQuery({
    queryKey: ['financial_totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('amount, type, status');
      
      if (error) throw error;
      return data;
    }
  });

  // Cálculos do mês
  const receitasMes = transactions
    .filter(t => t.type === 'receita')
    .reduce((acc, t) => acc + t.amount, 0);
  
  const despesasMes = transactions
    .filter(t => t.type === 'despesa')
    .reduce((acc, t) => acc + t.amount, 0);

  const resultadoMes = receitasMes - despesasMes;

  // Cálculos globais de pendências
  const aReceber = allTotals
    ?.filter(t => t.type === 'receita' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0) || 0;

  const aPagar = allTotals
    ?.filter(t => t.type === 'despesa' && t.status === 'pendente')
    .reduce((acc, t) => acc + t.amount, 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'todos' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
          <p className="text-muted-foreground italic">Visão executiva do fluxo de caixa.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-card border rounded-lg p-1 mr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-bold min-w-[120px] text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700" onClick={() => setActiveModal('receita')}>
            <ArrowUpRight className="mr-2 h-4 w-4" /> Receita
          </Button>
          <Button variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10" onClick={() => setActiveModal('despesa')}>
            <ArrowDownLeft className="mr-2 h-4 w-4" /> Despesa
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">Receitas (Mês)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700">{formatCurrency(receitasMes)}</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Despesas (Mês)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-destructive">{formatCurrency(despesasMes)}</div>
          </CardContent>
        </Card>
        <Card className={cn(resultadoMes >= 0 ? "bg-primary/5 border-primary/10" : "bg-amber-50 border-amber-100")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Resultado (Mês)</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", resultadoMes < 0 && "text-amber-700")}>{formatCurrency(resultadoMes)}</div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">A Receber</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-muted-foreground/80">{formatCurrency(aReceber)}</div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">A Pagar</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-muted-foreground/80">{formatCurrency(aPagar)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none bg-card/60 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 px-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Buscar movimentação..." 
                className="pl-9 bg-background/50 border-none shadow-inner" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)} className="w-auto">
              <TabsList className="bg-background/50">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="receita">Receitas</TabsTrigger>
                <TabsTrigger value="despesa">Despesas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button variant="ghost" size="icon"><Filter className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/30 border-b">
                <tr>
                  <th className="text-left p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Descrição</th>
                  <th className="text-left p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Categoria</th>
                  <th className="text-left p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Projeto</th>
                  <th className="text-left p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Data</th>
                  <th className="text-left p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Valor</th>
                  <th className="text-center p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">Carregando transações...</td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground italic">Nenhuma movimentação encontrada no período.</td>
                  </tr>
                ) : filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          transaction.type === 'receita' ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                        )}>
                          {transaction.type === 'receita' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-foreground group-hover:text-primary transition-colors">{transaction.description}</div>
                          {transaction.contacts?.name && <div className="text-[10px] text-muted-foreground">{transaction.contacts.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px] bg-accent/20 border-none px-2 font-medium">
                        {transaction.category}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {transaction.projects?.name ? (
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{transaction.projects.name}</div>
                      ) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="p-4 text-muted-foreground font-medium">
                      {format(new Date(transaction.date), "dd/MM/yyyy")}
                    </td>
                    <td className={cn(
                      "p-4 text-right font-black text-base",
                      transaction.type === 'receita' ? "text-emerald-600" : "text-destructive"
                    )}>
                      {transaction.type === 'receita' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <Badge 
                        variant={transaction.status === 'pago' ? 'default' : 'outline'}
                        className={cn(
                          "capitalize text-[10px] font-bold px-2 py-0.5",
                          transaction.status === 'pago' ? "bg-emerald-500 hover:bg-emerald-600" : "border-amber-500/30 text-amber-600 bg-amber-500/5"
                        )}
                      >
                        {transaction.status === 'pago' ? (transaction.type === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TransactionModal 
        open={activeModal !== null} 
        onOpenChange={(open) => !open && setActiveModal(null)}
        type={activeModal || 'receita'}
      />
    </div>
  );
}
