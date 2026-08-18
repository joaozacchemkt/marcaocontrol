import { useMemo, useState } from "react";
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
  LayoutGrid,
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
import { ConfigurarAmbiente } from "./workspace/common/ConfigurarAmbiente";
import { ProjectRelations } from "./workspace/common/ProjectRelations";
import { ExecutiveSummary } from "./workspace/common/ExecutiveSummary";
import {
  MODULE_TABS_BY_TYPE,
  resolveTabConfig,
  visibleTabs,
  type TabKey,
} from "@/lib/workspace-tabs";
import { ModuleBoard } from "./workspace/common/ModuleBoard";
import { isModuleKey } from "@/lib/workspace-modules";

// Template Faculdade
import { FaculdadeWorkspace } from "./workspace/faculdade/FaculdadeWorkspace";
// Template OAB
import { PainelOab } from "./workspace/oab/PainelOab";

const TAB_ICONS: Partial<Record<TabKey, React.ComponentType<{ className?: string }>>> = {
  overview: LayoutDashboard,
  faculdade: GraduationCap,
  painel_oab: Scale,
  tasks: CheckSquare,
  calendar: CalendarIcon,
  notes: FileText,
  files: FileUp,
  team: Users,
  finance: DollarSign,
  timeline: Clock,
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  faculdade: GraduationCap,
  imovel: Building2,
  consultoria: Users2,
  perfil_publico: Target,
  perfil_imobiliario: Target,
  novo_negocio: Rocket,
  pessoal: User,
  reformas: Hammer,
  obra: Hammer,
  oab: Scale,
  produto_digital: MonitorSmartphone,
  domestico: Home,
  financeiro_pessoal: Wallet,
  investimento_imovel: Building2,
  generico: LayoutDashboard,
};

export function ProjectDetail() {
  const { projectId } = useParams({ from: "/_authenticated/projetos/$projectId" });
  const [activeTab, setActiveTab] = useState<string>("overview");

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

  // Abas disponíveis para este workspace (a de Faculdade só existe no template).
  const availableTabs = useMemo<TabKey[]>(() => {
    const base: TabKey[] = [
      "overview",
      "board",
      "tasks",
      "calendar",
      "notes",
      "files",
      "team",
      "finance",
      "timeline",
    ];
    const modules = MODULE_TABS_BY_TYPE[projectType] ?? [];
    const withTemplate: TabKey[] =
      projectType === "faculdade"
        ? [...base, "faculdade"]
        : projectType === "oab"
          ? [...base, "painel_oab"]
          : base;
    return [...withTemplate, ...modules];
  }, [projectType]);

  const tabConfig = useMemo(
    () =>
      resolveTabConfig(
        projectType,
        (project as { tab_config?: unknown } | undefined)?.tab_config,
      ),
    [projectType, project],
  );

  const tabs = useMemo(
    () => visibleTabs(tabConfig, availableTabs),
    [tabConfig, availableTabs],
  );

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );

  if (!project) return <div>Projeto não encontrado.</div>;

  const TypeIcon = TYPE_ICONS[projectType] || LayoutDashboard;
  const currentTab = tabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : (tabs[0]?.key ?? "overview");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb & Header */}
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

          <div className="flex items-center gap-2">
            <ConfigurarAmbiente
              projectId={projectId}
              config={tabConfig}
              available={availableTabs}
            />
            <Button size="sm">Editar Projeto</Button>
          </div>
        </div>
      </div>

      {/* Tabs System */}
      <Tabs
        value={currentTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6"
      >
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/50 p-1 inline-flex w-auto min-w-full md:min-w-0">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.key] ?? LayoutGrid;
              return (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
                  <Icon className="h-4 w-4" /> {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <div className="space-y-6">
            <ExecutiveSummary project={project as never} />
            <ProjectOverview project={project} />
            <ProjectRelations projectId={projectId} />
          </div>
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

        {tabs
          .filter((tab) => isModuleKey(tab.key))
          .map((tab) => (
            <TabsContent
              key={tab.key}
              value={tab.key}
              className="mt-0 focus-visible:outline-none"
            >
              <ModuleBoard projectId={projectId} moduleKey={tab.key} />
            </TabsContent>
          ))}

        {projectType === "oab" && (
          <TabsContent value="painel_oab" className="mt-0 focus-visible:outline-none">
            <PainelOab projectId={projectId} />
          </TabsContent>
        )}

        {projectType === "faculdade" && (
          <TabsContent value="faculdade" className="mt-0 focus-visible:outline-none">
            <FaculdadeWorkspace project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
