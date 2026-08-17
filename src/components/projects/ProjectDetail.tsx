
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  FileText, 
  Users, 
  DollarSign, 
  Clock, 
  FileUp,
  ChevronLeft,
  Settings2,
  GraduationCap,
  Building2,
  Users2,
  Target,
  Rocket,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectOverview } from "./workspace/common/ProjectOverview";
import { ProjectTasks } from "./workspace/common/ProjectTasks";
import { ProjectCalendar } from "./workspace/common/ProjectCalendar";
import { ProjectFinance } from "./workspace/common/ProjectFinance";
import { ProjectNotes } from "./workspace/common/ProjectNotes";
import { ProjectFiles } from "./workspace/common/ProjectFiles";
import { ProjectTeam } from "./workspace/common/ProjectTeam";
import { ProjectTimeline } from "./workspace/common/ProjectTimeline";

// Template Faculdade
import { FaculdadeWorkspace } from "./workspace/faculdade/FaculdadeWorkspace";

export function ProjectDetail() {
  const { projectId } = useParams({ from: '/_authenticated/projetos/$projectId' });
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks (*),
          financial_transactions (*),
          project_contacts (*, contact:contacts(*))
        `)
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!project) return <div>Projeto não encontrado.</div>;

  const projectType = project.type || 'generico';

  const typeIcons: Record<string, any> = {
    faculdade: GraduationCap,
    imovel: Building2,
    consultoria: Users2,
    perfil_publico: Target,
    novo_negocio: Rocket,
    pessoal: User,
    generico: LayoutDashboard,
  };

  const TypeIcon = typeIcons[projectType] || LayoutDashboard;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/projetos" className="hover:text-foreground transition-colors">Projetos</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{project.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-wider">
                  {project.category || "Sem categoria"}
                </Badge>
                <Badge variant="secondary" className="capitalize text-[10px] font-bold tracking-wider">
                  {projectType.replace(/_/g, ' ')}
                </Badge>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" /> Configurações
             </Button>
             <Button size="sm">Editar Projeto</Button>
          </div>
        </div>
      </div>

      {/* Tabs System */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/50 p-1 inline-flex w-auto min-w-full md:min-w-0">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" /> Visão Geral
            </TabsTrigger>
            
            {/* Faculdade Specific Tabs */}
            {projectType === 'faculdade' && (
              <TabsTrigger value="faculdade" className="gap-2 text-primary font-bold">
                <GraduationCap className="h-4 w-4" /> Faculdade
              </TabsTrigger>
            )}

            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" /> Pendências
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" /> Anotações
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <FileUp className="h-4 w-4" /> Arquivos
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" /> Pessoas
            </TabsTrigger>
            
            {/* Conditional Finance Tab */}
            {(project.budget || project.financial_transactions?.length > 0) && (
              <TabsTrigger value="finance" className="gap-2">
                <DollarSign className="h-4 w-4" /> Financeiro
              </TabsTrigger>
            )}

            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" /> Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <ProjectOverview project={project} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
          <ProjectTasks project={project} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0 focus-visible:outline-none">
          <ProjectCalendar project={project} />
        </TabsContent>

        <TabsContent value="notes" className="mt-0 focus-visible:outline-none">
          <ProjectNotes project={project} />
        </TabsContent>

        <TabsContent value="files" className="mt-0 focus-visible:outline-none">
          <ProjectFiles project={project} />
        </TabsContent>

        <TabsContent value="team" className="mt-0 focus-visible:outline-none">
          <ProjectTeam project={project} />
        </TabsContent>

        <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
          <ProjectFinance project={project} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
          <ProjectTimeline project={project} />
        </TabsContent>

        {/* Templates Específicos */}
        {projectType === 'faculdade' && (
          <TabsContent value="faculdade" className="mt-0 focus-visible:outline-none">
            <FaculdadeWorkspace project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
