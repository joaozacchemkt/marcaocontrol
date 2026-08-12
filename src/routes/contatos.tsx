import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/contatos")({
  component: ContatosPage,
});

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, User, Building2, Phone, Mail, MapPin, CheckSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContactModal } from "@/components/modals/ContactModal";
import { TaskModal } from "@/components/modals/TaskModal";
import { EventModal } from "@/components/modals/EventModal";



function ContatosPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Contatos</h2>
            <p className="text-muted-foreground">Gestão estratégica de stakeholders.</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Contato
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar contatos por nome ou empresa..." 
            className="pl-9 bg-card" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 w-full animate-pulse rounded-xl bg-accent" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                Nenhum contato encontrado.
              </div>
            ) : filteredContacts.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>
      <ContactModal open={showModal} onOpenChange={setShowModal} />
    </AppLayout>
  );
}

function ContactCard({ contact }: { contact: any }) {
  const [activeModal, setActiveModal] = useState<'task' | 'event' | null>(null);

  return (
    <div className="group rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {contact.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold group-hover:text-primary transition-colors">{contact.name}</h3>
            <div className="flex items-center text-xs text-muted-foreground gap-1">
              <Building2 className="h-3 w-3" />
              {contact.company || "Pessoa Física"}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="secondary" className="text-[10px] font-bold px-2 uppercase">{contact.category}</Badge>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-dashed">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] uppercase font-bold" onClick={() => setActiveModal('task')}>
          <CheckSquare className="h-3 w-3 mr-1" /> Pendência
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] uppercase font-bold" onClick={() => setActiveModal('event')}>
          <Calendar className="h-3 w-3 mr-1" /> Agenda
        </Button>
      </div>

      <TaskModal 
        open={activeModal === 'task'} 
        onOpenChange={(open: boolean) => !open && setActiveModal(null)}
      />
      
      <EventModal
        open={activeModal === 'event'}
        onOpenChange={(open: boolean) => !open && setActiveModal(null)}
        initialContactId={contact.id}
      />

    </div>
  );
}


