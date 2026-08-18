import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/_authenticated/ideias")({
  component: IdeiasPage,
});

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Search, Plus, Trash2, ArrowRight, ExternalLink, Pencil } from "lucide-react";
import { IdeaModal, IDEA_STATUS_OPTIONS } from "@/components/modals/IdeaModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "@tanstack/react-router";
import { ProjectModal } from "@/components/modals/ProjectModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function IdeiasPage() {
  const [search, setSearch] = useState("");
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [ideaModal, setIdeaModal] = useState<{ open: boolean; idea: any | null }>({ open: false, idea: null });
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const queryClient = useQueryClient();

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['ideas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ideas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success("Insight arquivado com sucesso");
    }
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-minimal'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, objective'); // objective ou notes para encontrar origem
      return data || [];
    }
  });

  const filteredIdeas = ideas.filter(i => {
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(i.description?.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "todos" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Projeto gerado a partir de uma ideia (match por nome) para o botão "Abrir projeto".
  const findLinkedProject = (idea: any) =>
    projects.find((p: any) => p.name?.toLowerCase() === idea.title?.toLowerCase());

  const handleTransform = (idea: any) => {
    setSelectedIdea(idea);
    setIsProjectModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Incubadora de Ideias</h2>
            <p className="text-muted-foreground">Registre insights e sementes de futuros projetos.</p>
          </div>
          <Button onClick={() => setIdeaModal({ open: true, idea: null })}>
            <Plus className="h-4 w-4 mr-2" /> Novo Insight
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar insights e rascunhos..." 
            className="pl-9 bg-card" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {IDEA_STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => <div key={i} className="h-40 w-full animate-pulse rounded-xl bg-accent" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredIdeas.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                O silêncio precede a inovação. Registre seu primeiro insight.
              </div>
            ) : filteredIdeas.map(idea => (
              <div key={idea.id} className="group flex flex-col justify-between rounded-xl border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Insight
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                        {IDEA_STATUS_OPTIONS.find(s => s.value === idea.status)?.label || "Ideia"}
                      </Badge>
                      {idea.category && (
                        <Badge variant="outline" className="text-[10px] uppercase">{idea.category}</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">
                      {idea.created_at ? format(new Date(idea.created_at), "dd MMM yyyy", { locale: ptBR }) : "N/A"}
                    </span>
                  </div>
                  <h3 className="text-xl font-black mb-2 group-hover:text-primary transition-colors">
                    {idea.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                    {idea.description || "Sem descrição detalhada."}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-dashed">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar insight"
                      onClick={() => setIdeaModal({ open: true, idea })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Excluir insight">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir insight?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{idea.title}" será removido permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(idea.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex gap-2">
                    {idea.status === 'virou_projeto' ? (
                      findLinkedProject(idea) ? (
                        <Button asChild variant="default" size="sm" className="h-8 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700">
                          <Link to="/projetos/$projectId" params={{ projectId: findLinkedProject(idea)!.id }}>
                            Abrir projeto
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold uppercase tracking-wider">
                          <Link to="/projetos">
                            Ver projetos
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Link>
                        </Button>
                      )
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs font-bold uppercase tracking-wider"
                        onClick={() => handleTransform(idea)}
                      >
                        Transformar em Projeto
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <IdeaModal
        open={ideaModal.open}
        onOpenChange={(open) => setIdeaModal(prev => ({ open, idea: open ? prev.idea : null }))}
        idea={ideaModal.idea}
      />
      <ProjectModal 
        open={isProjectModalOpen} 
        onOpenChange={(open) => {
          setIsProjectModalOpen(open);
          if (!open) setSelectedIdea(null);
        }}
        initialData={selectedIdea ? {
          name: selectedIdea.title,
          description: selectedIdea.description,
          category: selectedIdea.category,
          notes: selectedIdea.notes,
          ideaId: selectedIdea.id
        } : null}
      />
    </AppLayout>
  );
}
