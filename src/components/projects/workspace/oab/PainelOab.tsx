import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Target, ListChecks, AlertTriangle } from "lucide-react";
import { parseLocalDate } from "@/lib/dates";

export interface PainelOabProps {
  projectId: string;
}

/** Data-alvo da 1ª fase considerada no planejamento (jan/2028). */
const EXAM_DATE = new Date("2028-01-16T00:00:00");
/** Meta oficial: 40 acertos em 80 questões. Meta pessoal: 56 (70%). */
const OFFICIAL_TARGET = 40;
const PERSONAL_TARGET = 56;
const TOTAL_QUESTIONS = 80;

interface BoardItem {
  module: string;
  stage: string;
  due_date: string | null;
}

export function PainelOab({ projectId }: PainelOabProps) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["oab-panel", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_items")
        .select("module, stage, due_date")
        .eq("project_id", projectId)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as unknown as BoardItem[];
    },
  });

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Math.max(
      0,
      Math.ceil((EXAM_DATE.getTime() - today.getTime()) / 86_400_000),
    );

    const by = (moduleKey: string) => items.filter((i) => i.module === moduleKey);

    const disciplinas = by("disciplinas");
    const dominadas = disciplinas.filter((d) => d.stage === "dominada").length;

    const questoes = by("questoes");
    const resolvidas = questoes.filter((q) => q.stage !== "pendente").length;

    const errosAbertos = by("caderno_erros").filter((e) => e.stage === "aberto").length;

    const atrasados = items.filter((i) => {
      if (!i.due_date) return false;
      const done = ["concluido", "feita", "feito", "realizado", "corrigido", "lida", "revisada", "resolvido", "revisado"];
      if (done.includes(i.stage)) return false;
      return parseLocalDate(i.due_date)! < today;
    }).length;

    return {
      days,
      disciplinas: disciplinas.length,
      dominadas,
      questoes: questoes.length,
      resolvidas,
      errosAbertos,
      atrasados,
    };
  }, [items]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando painel...</p>;
  }

  const dominioPct = stats.disciplinas
    ? Math.round((stats.dominadas / stats.disciplinas) * 100)
    : 0;
  const questoesPct = stats.questoes
    ? Math.round((stats.resolvidas / stats.questoes) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contagem regressiva</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{stats.days}</p>
            <p className="text-xs text-muted-foreground">
              dias até a 1ª fase (jan/2028)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta de acertos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-bold tracking-tight">
              {OFFICIAL_TARGET}
              <span className="text-base font-normal text-muted-foreground">
                /{TOTAL_QUESTIONS}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Meta pessoal: {PERSONAL_TARGET} acertos (70%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disciplinas dominadas</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold tracking-tight">
              {stats.dominadas}
              <span className="text-base font-normal text-muted-foreground">
                /{stats.disciplinas}
              </span>
            </p>
            <Progress value={dominioPct} className="h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos de atenção</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-1">
            <Badge variant={stats.atrasados ? "destructive" : "secondary"}>
              {stats.atrasados} atrasado(s)
            </Badge>
            <Badge variant="outline">{stats.errosAbertos} erro(s) em aberto</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Blocos de questões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.resolvidas} de {stats.questoes} blocos resolvidos
            </span>
            <span className="font-medium">{questoesPct}%</span>
          </div>
          <Progress value={questoesPct} className="h-1.5" />
        </CardContent>
      </Card>
    </div>
  );
}
