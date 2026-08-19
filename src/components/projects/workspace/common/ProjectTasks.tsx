import { TaskList } from "@/components/tasks/TaskList";

interface ProjectTasksProps {
  project: { id: string };
}

/** Aba de pendências do projeto: apenas o quadro/lista, sem cabeçalho duplicado. */
export function ProjectTasks({ project }: ProjectTasksProps) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden p-6">
      <TaskList initialProjectId={project.id} />
    </div>
  );
}
