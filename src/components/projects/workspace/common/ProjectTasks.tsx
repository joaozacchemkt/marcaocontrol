
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, List, Kanban } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskModal } from "@/components/modals/TaskModal";

interface ProjectTasksProps {
  project: any;
}

export function ProjectTasks({ project }: ProjectTasksProps) {
  const [showTaskModal, setShowTaskModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Pendências do Projeto</h3>
        <Button onClick={() => setShowTaskModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden p-6">
        <TaskList initialProjectId={project.id} />
      </div>

      <TaskModal 
        open={showTaskModal} 
        onOpenChange={setShowTaskModal} 
        initialProjectId={project.id} 
      />
    </div>
  );
}
