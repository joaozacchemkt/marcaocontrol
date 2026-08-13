
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, User, Mail, Phone, MessageSquare, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ProjectTeamProps {
  project: any;
}

export function ProjectTeam({ project }: ProjectTeamProps) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Pessoas Envolvidas</h3>
        <Button>
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
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">{member.role || "Stakeholder"}</p>
                    <div className="flex gap-1">
                      {member.contact?.email && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title={member.contact.email}>
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                      {member.contact?.phone && (
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Phone className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={member.type === 'externo' ? 'outline' : 'default'} className="text-[9px] uppercase">
                  {member.type || 'interno'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-accent/50 rounded-xl p-4 border border-dashed">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold">Links Úteis / Stakeholders</h4>
        </div>
        <p className="text-[10px] text-muted-foreground">Repositórios, docs de terceiros ou dashboards externos.</p>
      </div>
    </div>
  );
}
