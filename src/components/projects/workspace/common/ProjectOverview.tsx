
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Target, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Clock, 
  User, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectOverviewProps {
  project: any;
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const completedTasks = project.tasks?.filter((t: any) => t.status === 'concluido').length || 0;
  const totalTasks = project.tasks?.length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const receitas = project.financial_transactions
    ?.filter((t: any) => t.type === 'receita')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;
  
  const despesas = project.financial_transactions
    ?.filter((t: any) => t.type === 'despesa')
    .reduce((acc: number, t: any) => acc + t.amount, 0) || 0;

  const resultadoFinanceiro = receitas - despesas;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Coluna da Esquerda: Resumo e Status */}
      <div className="md:col-span-2 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progresso</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(progress)}%</div>
              <Progress value={progress} className="h-2 mt-4" />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prazo Final</CardTitle>
              <Calendar className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {project.deadline ? format(new Date(project.deadline), "dd MMM, yyyy", { locale: ptBR }) : "Não definido"}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {project.start_date ? `Iniciado em ${format(new Date(project.start_date), "dd/MM/yy")}` : "Início pendente"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Objetivo e Próxima Ação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Objetivo</label>
              <p className="mt-1 text-foreground leading-relaxed">
                {project.objective || "Nenhum objetivo específico definido."}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">Próxima Ação</label>
              <p className="mt-1 text-foreground font-medium flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                {project.next_action || "Definir próximo passo crítico."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
              {project.description || "Nenhuma descrição detalhada."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coluna da Direita: Finanças e Pessoas */}
      <div className="space-y-6">
        {project.type !== 'pessoal' && (
          <Card className="shadow-sm border-emerald-100/20 bg-emerald-50/5 dark:bg-emerald-950/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" /> Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm text-muted-foreground">Resultado</span>
                <span className={cn("text-2xl font-black", resultadoFinanceiro < 0 ? "text-destructive" : "text-emerald-600")}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultadoFinanceiro)}
                </span>
              </div>
              <div className="pt-4 border-t border-dashed space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" /> Receitas
                  </span>
                  <span className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-destructive" /> Despesas
                  </span>
                  <span className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesas)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Equipe / Stakeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.project_contacts?.length > 0 ? (
                project.project_contacts.map((pc: any) => (
                  <div key={pc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                        {pc.contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pc.contact.name}</p>
                        <p className="text-[10px] text-muted-foreground">{pc.role_in_project || pc.contact.role || "Membro"}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhuma pessoa vinculada.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Status Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="capitalize w-full justify-center py-1">
              {project.status?.replace(/_/g, ' ')}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Rocket(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
      <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
    </svg>
  );
}
