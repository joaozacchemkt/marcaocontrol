import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/ideias")({
  component: IdeiasPage,
});

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Search, Plus, Calendar, Star, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function IdeiasPage() {
  const [search, setSearch] = useState("");
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

  const filteredIdeas = ideas.filter(i => 
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    (i.description?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Incubadora de Ideias</h2>
            <p className="text-muted-foreground">Registre insights e sementes de futuros projetos.</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Novo Insight
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar insights e rascunhos..." 
            className="pl-9 bg-card" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                    <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Insight
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">
                      {format(new Date(idea.created_at), "dd MMM yyyy", { locale: ptBR })}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(idea.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold uppercase tracking-wider">
                    Transformar em Projeto
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
