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

// Placeholder para os modais que serão criados
// import { TaskModal } from "../modals/TaskModal";
// ... etc

export function GlobalAddButton() {
  const [open, setOpen] = useState(false);

  const actions = [
    { label: "Nova Pendência", icon: CheckSquare, onClick: () => console.log("Task") },
    { label: "Novo Compromisso", icon: Calendar, onClick: () => console.log("Event") },
    { label: "Novo Projeto", icon: Briefcase, onClick: () => console.log("Project") },
    { label: "Novo Contato", icon: Users, onClick: () => console.log("Contact") },
    { label: "Nova Receita", icon: ArrowUpRight, onClick: () => console.log("Revenue"), className: "text-emerald-500" },
    { label: "Nova Despesa", icon: ArrowDownLeft, onClick: () => console.log("Expense"), className: "text-destructive" },
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
    </div>
  );
}
