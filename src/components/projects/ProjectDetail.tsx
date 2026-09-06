import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  DollarSign,
  Clock,
  FileText,
  GraduationCap,
  Building2,
  Users2,
  Target,
  Rocket,
  User,
  Home,
  Wallet,
  Hammer,
  Scale,
  MonitorSmartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectOverview } from "./workspace/common/ProjectOverview";
import { ProjectFinance } from "./workspace/common/ProjectFinance";
import { ProjectNotes } from "./workspace/common/ProjectNotes";
import { ProjectFiles } from "./workspace/common/ProjectFiles";
import { ProjectTeam } from "./workspace/common/ProjectTeam";
import { ProjectTimeline } from "./workspace/common/ProjectTimeline";
import { ProjectRelations } from "./workspace/common/ProjectRelations";
import { ExecutiveSummary } from "./workspace/common/ExecutiveSummary";
import { ProjectModal } from "@/components/modals/ProjectModal";
import { ProjectBoard } from "./workspace/board/ProjectBoard";
import { FaculdadeWorkspace } from "./workspace/faculdade/FaculdadeWorkspace";

/** Tipos de projeto que ganham a aba extra "Estudo". */
const STUDY_TYPES = new Set(["faculdade", "oab"]);

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  faculdade: GraduationCap,
  oab: Scale,
  imovel: Building2,
  perfil_imobiliario: Target,
  investimento_imovel: Building2,
  consultoria: Users2,
  perfil_publico: Target,
  novo_negocio: Rocket,
  produto_digital: MonitorSmartphone,
  reformas: Hammer,
  obra: Hammer,
  domestico: Home,
  pessoal: User,
  financeiro_pessoal: Wallet,
  generico: LayoutDashboard,
};

export function ProjectDetail() {
  const { projectId } = useParams({ from: "/_authenticated/projetos/$projectId" });
  const [activeTab, setActiveTab] = useState<string>("painel");
  const [editOpen, setEditOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          *,
          tasks (*),
          financial_transactions (*),
          project_contacts (*, contact:contacts(*))
        `,
        )
        .eq("id", projectId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const projectType = (project as { type?: string } | undefined)?.type || "generico";
  const isStudy = STUDY_TYPES.has(projectType);

  // Estrutura padrão, igual em todo projeto. "Estudo" só aparece em faculdade/OAB.
  const tabs = useMemo(
    () =>
      [
        { key: "painel", label: "Painel", icon: LayoutDashboard },
        { key: "tarefas", label: "Tarefas", icon: CheckSquare },
        ...(isStudy ? [{ key: "estudo", label: "Estudo", icon: GraduationCap }] : []),
        { key: "pessoas", label: "Pessoas", icon: Users },
        { key: "financeiro", label: "Financeiro", icon: DollarSign },
        { key: "arquivos", label: "Arquivos & Notas", icon: FileText },
        { key: "historico", label: "Histórico", icon: Clock },
      ] as const,
    [isStudy],
  );

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );

  if (!project) return <div>Projeto não encontrado.</div>;

  const TypeIcon = TYPE_ICONS[projectType] || LayoutDashboard;
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : "painel";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/projetos" className="hover:text-foreground transition-colors">
            Projetos
          </Link>
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
                <Badge
                  variant="outline"
                  className="capitalize text-[10px] font-bold tracking-wider"
                >
                  {project.category || "Sem categoria"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="capitalize text-[10px] font-bold tracking-wider"
                >
                  {projectType.replace(/_/g, " ")}
                </Badge>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
            </div>
          </div>

          <Button size="sm" onClick={() => setEditOpen(true)}>
            Editar Projeto
          </Button>
        </div>
      </div>

      {/* Abas */}
      <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/50 p-1 inline-flex w-auto min-w-full md:min-w-0">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
                <tab.icon className="h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="painel" className="mt-0 focus-visible:outline-none">
          <div className="space-y-6">
            <ExecutiveSummary project={project as never} />
            <ProjectOverview project={project} />
            <ProjectRelations projectId={projectId} />
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-0 focus-visible:outline-none">
          <ProjectBoard projectId={projectId} />
        </TabsContent>

        {isStudy && (
          <TabsContent value="estudo" className="mt-0 focus-visible:outline-none">
            <FaculdadeWorkspace project={project} />
          </TabsContent>
        )}

        <TabsContent value="pessoas" className="mt-0 focus-visible:outline-none">
          <ProjectTeam project={project} />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-0 focus-visible:outline-none">
          <ProjectFinance project={project} />
        </TabsContent>

        <TabsContent value="arquivos" className="mt-0 focus-visible:outline-none">
          <div className="space-y-8">
            <ProjectNotes project={project} />
            <ProjectFiles project={project} />
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-0 focus-visible:outline-none">
          <ProjectTimeline project={project} />
        </TabsContent>
      </Tabs>

      <ProjectModal
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project as any}
      />
    </div>
  );
}
