
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Plus, 
  Clock,
  CheckCircle2,
  FileText,
  ClipboardList,
  Target,
  Brain
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, isFuture, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FaculdadeWorkspaceProps {
  project: any;
}

export function FaculdadeWorkspace({ project }: FaculdadeWorkspaceProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("materias");

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['academic-subjects', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_subjects')
        .select('*')
        .eq('project_id', project.id)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: exams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['academic-exams', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_exams')
        .select('*, academic_subjects(name)')
        .eq('project_id', project.id)
        .order('exam_date');
      if (error) throw error;
      return data;
    }
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['academic-assignments', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_assignments')
        .select('*, academic_subjects(name)')
        .eq('project_id', project.id)
        .order('deadline');
      if (error) throw error;
      return data;
    }
  });

  const { data: summaries = [], isLoading: loadingSummaries } = useQuery({
    queryKey: ['academic-summaries', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_summaries')
        .select('*, academic_subjects(name)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Cálculo de Médias e Faltas (Mockado enquanto não temos lógica de notas completa)
  const activeSubjects = subjects.filter(s => s.status === 'ativa');
  const globalAverage = subjects.length > 0 ? 8.5 : 0;
  const totalAbsences = subjects.reduce((acc, s) => acc + (s.current_absences || 0), 0);
  const totalAbsenceLimit = subjects.reduce((acc, s) => acc + (s.absences_limit || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Portal Acadêmico
          </h3>
          <p className="text-sm text-muted-foreground">Gestão completa do curso e matérias.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Target className="h-4 w-4 mr-2" /> Estudar Agora
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nova Matéria
          </Button>
        </div>
      </div>

      {/* Resumo de Desempenho */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-primary">Matérias Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{activeSubjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Média Global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{globalAverage}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Faltas Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", totalAbsences > totalAbsenceLimit * 0.7 && "text-destructive")}>
              {totalAbsences}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendências Acadêmicas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {exams.filter(e => e.status !== 'corrigida').length + assignments.filter(a => a.status !== 'corrigido').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="materias">Matérias</TabsTrigger>
          <TabsTrigger value="provas">Provas</TabsTrigger>
          <TabsTrigger value="trabalhos">Trabalhos</TabsTrigger>
          <TabsTrigger value="resumos">Resumos</TabsTrigger>
        </TabsList>

        <TabsContent value="materias" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingSubjects ? (
              [1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse bg-accent rounded-xl" />)
            ) : subjects.length === 0 ? (
              <Card className="col-span-full border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma matéria cadastrada.
                </CardContent>
              </Card>
            ) : subjects.map(subject => (
              <Card key={subject.id} className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden">
                <div className="h-2 w-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold truncate">{subject.name}</CardTitle>
                    <Badge variant="outline" className="text-[9px] uppercase">{subject.period}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{subject.professor || 'Sem professor'}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span>Presença</span>
                      <span className={(subject.current_absences ?? 0) > ((subject.absences_limit ?? 0) * 0.7) ? "text-destructive" : ""}>
                        {subject.current_absences ?? 0}/{subject.absences_limit ?? 0} faltas
                      </span>
                    </div>
                    <Progress value={((subject.current_absences ?? 0) / (subject.absences_limit || 1)) * 100} className="h-1" />
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-bold">MÉDIA ATUAL</span>
                    <span className="font-black text-primary">8.5</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="provas" className="pt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="xs" variant="outline"><Plus className="h-3 w-3 mr-1" /> Agendar Prova</Button>
            </div>
            <div className="grid gap-3">
              {exams.length === 0 ? (
                <div className="py-10 text-center border rounded-xl border-dashed text-muted-foreground text-sm">
                  Nenhuma prova agendada.
                </div>
              ) : exams.map(exam => (
                <div key={exam.id} className="bg-card border rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{exam.academic_subjects?.name}: {exam.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {exam.exam_date ? format(new Date(exam.exam_date), "dd/MM/yyyy", { locale: ptBR }) : 'Data não definida'}
                        </span>
                        <Badge variant="outline" className="text-[8px] uppercase">{exam.status?.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {exam.grade ? (
                      <div className="text-lg font-black text-primary">{exam.grade}</div>
                    ) : (
                      <Button size="xs" variant="ghost">Lançar Nota</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trabalhos" className="pt-4">
           <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="xs" variant="outline"><Plus className="h-3 w-3 mr-1" /> Novo Trabalho</Button>
            </div>
            <div className="grid gap-3">
              {assignments.length === 0 ? (
                <div className="py-10 text-center border rounded-xl border-dashed text-muted-foreground text-sm">
                  Nenhum trabalho cadastrado.
                </div>
              ) : assignments.map(assignment => (
                <div key={assignment.id} className="bg-card border rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{assignment.academic_subjects?.name}: {assignment.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn(
                          "flex items-center gap-1 text-[10px]",
                          assignment.deadline && isFuture(new Date(assignment.deadline)) ? "text-muted-foreground" : "text-destructive font-bold"
                        )}>
                          <Clock className="h-3 w-3" />
                          Entrega: {assignment.deadline ? format(new Date(assignment.deadline), "dd/MM/yyyy", { locale: ptBR }) : 'Pendente'}
                        </span>
                        <Badge variant="secondary" className="text-[8px] uppercase">{assignment.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button size="xs" variant="ghost">Ver Detalhes</Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resumos" className="pt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Base de Conhecimento</h4>
              <Button size="xs" variant="outline"><Plus className="h-3 w-3 mr-1" /> Criar Resumo</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {summaries.length === 0 ? (
                <div className="col-span-full py-10 text-center border rounded-xl border-dashed text-muted-foreground text-sm">
                  Nenhum resumo criado. Estude e registre seus insights aqui.
                </div>
              ) : summaries.map(summary => (
                <Card key={summary.id} className="hover:border-primary/30 transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm font-bold">{summary.title}</CardTitle>
                      <Badge variant="outline" className="text-[8px]">{summary.academic_subjects?.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-3">{summary.content}</p>
                    <div className="flex items-center gap-2 mt-4 text-[9px] text-muted-foreground font-medium">
                      <Brain className="h-3 w-3" />
                      {format(new Date(summary.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
