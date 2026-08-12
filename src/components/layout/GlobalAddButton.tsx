import { useState } from "react";
import { 
  Plus, 
  CheckSquare, 
  Calendar, 
  Briefcase, 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lightbulb 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TaskModal } from "../modals/TaskModal";
import { ProjectModal } from "../modals/ProjectModal";
import { ContactModal } from "../modals/ContactModal";
import { TransactionModal } from "../modals/TransactionModal";
import { EventModal } from "../modals/EventModal";

export function GlobalAddButton() {
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const actions = [
    { label: "Nova Pendência", icon: CheckSquare, onClick: () => setActiveModal("task") },
    { label: "Novo Compromisso", icon: Calendar, onClick: () => setActiveModal("event") },
    { label: "Novo Projeto", icon: Briefcase, onClick: () => setActiveModal("project") },
    { label: "Novo Contato", icon: Users, onClick: () => setActiveModal("contact") },
    { label: "Nova Receita", icon: ArrowUpRight, onClick: () => setActiveModal("revenue"), className: "text-emerald-500" },
    { label: "Nova Despesa", icon: ArrowDownLeft, onClick: () => setActiveModal("expense"), className: "text-destructive" },
    { label: "Nova Ideia", icon: Lightbulb, onClick: () => console.log("Idea") },
  ];

  return (
    <div className="w-full">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button className="w-full justify-center shadow-sm hover:bg-primary/90 transition-all active:scale-95 py-6">
            <Plus className="mr-2 h-5 w-5" />
            <span className="font-semibold text-base">Novo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {actions.map((action) => (
            <DropdownMenuItem 
              key={action.label} 
              onClick={action.onClick}
              className="cursor-pointer py-2.5"
            >
              <action.icon className={`mr-3 h-4 w-4 ${action.className || "text-muted-foreground"}`} />
              <span>{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskModal 
        open={activeModal === "task"} 
        onOpenChange={() => setActiveModal(null)} 
      />
      <EventModal
        open={activeModal === "event"}
        onOpenChange={() => setActiveModal(null)}
      />
      <ProjectModal
        open={activeModal === "project"}
        onOpenChange={() => setActiveModal(null)}
      />
      <ContactModal
        open={activeModal === "contact"}
        onOpenChange={() => setActiveModal(null)}
      />
      <TransactionModal
        open={activeModal === "revenue"}
        onOpenChange={() => setActiveModal(null)}
        type="receita"
      />
      <TransactionModal
        open={activeModal === "expense"}
        onOpenChange={() => setActiveModal(null)}
        type="despesa"
      />
    </div>
  );
}

