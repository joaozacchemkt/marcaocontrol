import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Briefcase, Users, CheckSquare, Lightbulb, X, Command } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: results = { projects: [], contacts: [], tasks: [], ideas: [] }, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return { projects: [], contacts: [], tasks: [], ideas: [] };

      const [p, c, t, i] = await Promise.all([
        supabase.from('projects').select('id, name').ilike('name', `%${query}%`).limit(5),
        supabase.from('contacts').select('id, name').ilike('name', `%${query}%`).limit(5),
        supabase.from('tasks').select('id, title').ilike('title', `%${query}%`).limit(5),
        supabase.from('ideas').select('id, title').ilike('title', `%${query}%`).limit(5)
      ]);

      return {
        projects: p.data || [],
        contacts: c.data || [],
        tasks: t.data || [],
        ideas: i.data || []
      };
    },
    enabled: query.length >= 2
  });

  const handleSelect = (type: string, id: string) => {
    setOpen(false);
    setQuery("");
    
    switch (type) {
      case 'project': navigate({ to: '/projetos/$projectId', params: { projectId: id } }); break;
      case 'contact': navigate({ to: '/contatos' }); break;
      case 'task': navigate({ to: '/tarefas' }); break;
      case 'idea': navigate({ to: '/ideias' }); break;
    }
  };

  const hasResults = results.projects.length > 0 || results.contacts.length > 0 || results.tasks.length > 0 || results.ideas.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground hover:bg-accent transition-colors md:w-64"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Busca global...</span>
        <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Pesquisar em tudo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0"
              autoFocus
            />
            {query && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuery("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="max-h-[350px] overflow-y-auto p-2">
            {!query && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Comece a digitar para pesquisar...
              </div>
            )}
            {query && !isLoading && !hasResults && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            )}
            {hasResults && (
              <div className="space-y-4 py-2">
                {results.projects.length > 0 && (
                  <SearchGroup title="Projetos" icon={Briefcase}>
                    {results.projects.map((item: any) => (
                      <SearchItem key={item.id} label={item.name} onClick={() => handleSelect('project', item.id)} />
                    ))}
                  </SearchGroup>
                )}
                {results.contacts.length > 0 && (
                  <SearchGroup title="Contatos" icon={Users}>
                    {results.contacts.map((item: any) => (
                      <SearchItem key={item.id} label={item.name} onClick={() => handleSelect('contact', item.id)} />
                    ))}
                  </SearchGroup>
                )}
                {results.tasks.length > 0 && (
                  <SearchGroup title="Pendências" icon={CheckSquare}>
                    {results.tasks.map((item: any) => (
                      <SearchItem key={item.id} label={item.title} onClick={() => handleSelect('task', item.id)} />
                    ))}
                  </SearchGroup>
                )}
                {results.ideas.length > 0 && (
                  <SearchGroup title="Ideias" icon={Lightbulb}>
                    {results.ideas.map((item: any) => (
                      <SearchItem key={item.id} label={item.title} onClick={() => handleSelect('idea', item.id)} />
                    ))}
                  </SearchGroup>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchGroup({ title, icon: Icon, children }: any) {
  return (
    <div className="px-2">
      <div className="flex items-center px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
        <Icon className="mr-2 h-3 w-3" />
        {title}
      </div>
      <div className="mt-1 space-y-1">
        {children}
      </div>
    </div>
  );
}

function SearchItem({ label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
    >
      {label}
    </button>
  );
}
