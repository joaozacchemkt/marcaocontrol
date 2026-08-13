
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ProjectNotesProps {
  project: any;
}

export function ProjectNotes({ project }: ProjectNotesProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [formData, setFormData] = useState({ title: "", content: "", category: "" });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['project-notes', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const saveNote = useMutation({
    mutationFn: async (data: any) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      if (editingNote) {
        const { error } = await supabase
          .from('project_notes')
          .update(data)
          .eq('id', editingNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_notes')
          .insert({ ...data, project_id: project.id, user_id: userData.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', project.id] });
      toast.success(editingNote ? "Nota atualizada" : "Nota criada");
      setShowModal(false);
      setEditingNote(null);
      setFormData({ title: "", content: "", category: "" });
    }
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', project.id] });
      toast.success("Nota excluída");
    }
  });

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Anotações do Projeto</h3>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Nota
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input 
          placeholder="Buscar nas anotações..." 
          className="pl-9" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-32 animate-pulse bg-accent rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredNotes.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
              Nenhuma anotação encontrada.
            </div>
          ) : filteredNotes.map(note => (
            <Card key={note.id} className="group relative">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold truncate pr-8">{note.title}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    setEditingNote(note);
                    setFormData({ title: note.title, content: note.content, category: note.category || "" });
                    setShowModal(true);
                  }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNote.mutate(note.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase">
                  <span>{new Date(note.created_at || '').toLocaleDateString()}</span>
                  {note.category && <Badge variant="outline" className="text-[9px] uppercase">{note.category}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? "Editar Nota" : "Nova Anotação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título da nota"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input 
                value={formData.category} 
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Reunião, Estudo, Insight"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea 
                value={formData.content} 
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Escreva aqui sua nota..."
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={() => saveNote.mutate(formData)}>Salvar Nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
