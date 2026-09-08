import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ExternalLink, FileText, Link2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useGuardedSubmit } from "@/lib/use-guarded-submit";
import { ProjectNotes } from "./ProjectNotes";
import { ProjectFiles } from "./ProjectFiles";

interface ProjectNotesFilesProps {
  project: any;
}

type Section = "notas" | "arquivos" | "links";

const SECTIONS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "notas", label: "Notas", icon: FileText },
  { key: "arquivos", label: "Arquivos", icon: Paperclip },
  { key: "links", label: "Links", icon: Link2 },
];

/** Uma aba só para tudo que é "material de referência" do projeto. */
export function ProjectNotesFiles({ project }: ProjectNotesFilesProps) {
  const [section, setSection] = useState<Section>("notas");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (section === s.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
      </div>

      {section === "notas" && <ProjectNotes project={project} />}
      {section === "arquivos" && <ProjectFiles project={project} />}
      {section === "links" && <ProjectLinks project={project} />}
    </div>
  );
}

function ProjectLinks({ project }: { project: any }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", category: "", notes: "" });
  const queryKey = ["project-links", project.id];

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("useful_links")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      if (!form.name.trim() || !form.url.trim()) throw new Error("Nome e endereço são obrigatórios.");
      const url = /^https?:\/\//i.test(form.url.trim()) ? form.url.trim() : `https://${form.url.trim()}`;
      const { error } = await supabase.from("useful_links").insert({
        user_id: user.id,
        project_id: project.id,
        name: form.name.trim(),
        url,
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setForm({ name: "", url: "", category: "", notes: "" });
      setOpen(false);
      toast.success("Link salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("useful_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Link removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useGuardedSubmit(() => addLink.mutate(), addLink.isPending);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Links úteis</h3>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo link
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando links...</p>
      ) : links.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
          Nenhum link salvo — anúncios, contratos online, planilhas, portais.
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map((link) => (
            <Card key={link.id} className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-3"
                >
                  <span className="rounded-lg border bg-background p-2">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{link.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {link.url}
                    </span>
                    {link.notes && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {link.notes}
                      </span>
                    )}
                  </span>
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  {link.category && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {link.category}
                    </span>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Remover link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover “{link.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>O link será removido da lista.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeLink.mutate(link.id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo link</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="link-name">Nome *</Label>
              <Input
                id="link-name"
                autoFocus
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">Endereço *</Label>
              <Input
                id="link-url"
                placeholder="exemplo.com/documento"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-category">Categoria</Label>
              <Input
                id="link-category"
                placeholder="Ex.: Contrato, Anúncio, Planilha"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-notes">Observação</Label>
              <Textarea
                id="link-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addLink.isPending}>
                {addLink.isPending ? "Salvando..." : "Salvar link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
