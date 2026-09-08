import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, User, Mail, Phone, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ProjectTeamProps {
  project: any;
}

export function ProjectTeam({ project }: ProjectTeamProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [roleInProject, setRoleInProject] = useState("");

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['project-contacts', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_contacts')
        .select('*, contact:contacts(*)')
        .eq('project_id', project.id);
      if (error) throw error;
      return data;
    }
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-select'],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, name').order('name');
      return data || [];
    }
  });

  const linkedIds = new Set(team.map((m: any) => m.contact_id));
  const availableContacts = contacts.filter((c: any) => !linkedIds.has(c.id));

  const addMember = useMutation({
    mutationFn: async () => {
      if (!contactId) throw new Error("Selecione um contato");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from('project_contacts').insert({
        user_id: userData.user.id,
        project_id: project.id,
        contact_id: contactId,
        role_in_project: roleInProject || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-contacts', project.id] });
      toast.success("Pessoa vinculada ao projeto.");
      setOpen(false);
      setContactId("");
      setRoleInProject("");
    },
    onError: (error: Error) => toast.error("Erro ao vincular: " + error.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-contacts', project.id] });
      toast.success("Pessoa desvinculada.");
    },
    onError: (error: Error) => toast.error("Erro ao desvincular: " + error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Pessoas Envolvidas</h3>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar Pessoa
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-24 animate-pulse bg-accent rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {team.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
              Nenhuma pessoa vinculada a este projeto.
            </div>
          ) : team.map((member: any) => (
            <Card key={member.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-start justify-between">
                <div className="flex gap-4">
                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                    <AvatarImage src={member.contact?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.contact?.name?.substring(0, 2).toUpperCase() || <User />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-sm">{member.contact?.name}</h4>
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
                      {member.role_in_project || "Stakeholder"}
                    </p>
                    <div className="flex gap-1">
                      {member.contact?.email && (
                        <Button asChild variant="ghost" size="icon" className="h-6 w-6" title={member.contact.email}>
                          <a href={`mailto:${member.contact.email}`} aria-label="Enviar e-mail">
                            <Mail className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {member.contact?.phone && (
                        <Button asChild variant="ghost" size="icon" className="h-6 w-6" title={member.contact.phone}>
                          <a href={`tel:${member.contact.phone}`} aria-label="Ligar">
                            <Phone className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {member.contact?.category || 'contato'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    aria-label="Remover do projeto"
                    onClick={() => removeMember.mutate(member.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vincular pessoa ao projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-contact">Contato</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="team-contact">
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum contato disponível</SelectItem>
                  ) : availableContacts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-role">Papel no projeto</Label>
              <Input
                id="team-role"
                placeholder="Ex.: Engenheiro responsável"
                value={roleInProject}
                onChange={e => setRoleInProject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMember.mutate()} disabled={addMember.isPending || !contactId}>
              {addMember.isPending ? "Salvando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
