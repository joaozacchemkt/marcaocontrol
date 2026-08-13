
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  FileText, 
  Video, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FaculdadeWorkspaceProps {
  project: any;
}

export function FaculdadeWorkspace({ project }: FaculdadeWorkspaceProps) {
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
            <div className="text-2xl font-black">{subjects.filter(s => s.status === 'ativa').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Média Global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">8.5</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Faltas Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600">12</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projetos/Provas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">4</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="materias">Matérias</TabsTrigger>
          <TabsTrigger value="provas">Provas & Trabalhos</TabsTrigger>
          <TabsTrigger value="aulas">Resumos de Aulas</TabsTrigger>
          <TabsTrigger value="recursos">Recursos (Vídeos/Links)</TabsTrigger>
        </TabsList>

        <TabsContent value="materias" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingSubjects ? (
              [1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse bg-accent rounded-xl" />)
            ) : subjects.length === 0 ? (
              <Card className="col-span-full border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma matéria cadastrada. Comece adicionando sua grade curricular.
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
                  <p className="text-xs text-muted-foreground">{subject.professor || 'Sem professor definido'}</p>
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
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {subject.schedule || 'A definir'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      {subject.location || 'Sala virtual'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="provas" className="pt-4 text-center py-20 border border-dashed rounded-xl text-muted-foreground">
          Funcionalidade de Provas & Trabalhos em desenvolvimento.
        </TabsContent>

        <TabsContent value="aulas" className="pt-4 text-center py-20 border border-dashed rounded-xl text-muted-foreground">
          Funcionalidade de Resumos de Aulas em desenvolvimento.
        </TabsContent>

        <TabsContent value="recursos" className="pt-4 text-center py-20 border border-dashed rounded-xl text-muted-foreground">
          Funcionalidade de Recursos Acadêmicos em desenvolvimento.
        </TabsContent>
      </Tabs>
    </div>
  );
}
