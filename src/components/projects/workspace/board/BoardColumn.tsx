import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoardCard } from "./BoardCard";
import type { BoardStatus, BoardTask } from "./board-types";

export interface BoardColumnProps {
  id: BoardStatus;
  label: string;
  tasks: BoardTask[];
  subtaskCounts: Record<string, number>;
  reminders: Set<string>;
  onOpen: (task: BoardTask) => void;
  onQuickAdd: (title: string, status: BoardStatus) => void;
  onDelete: (task: BoardTask) => void;
  selectedIds: Set<string>;
  onToggleSelect: (task: BoardTask) => void;
}

export function BoardColumn({
  id,
  label,
  tasks,
  subtaskCounts,
  reminders,
  onOpen,
  onQuickAdd,
  onDelete,
  selectedIds,
  onToggleSelect,
}: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const value = title.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    onQuickAdd(value, id);
    setTitle("");
  };

  return (
    <div
      ref={setNodeRef}
      className="flex w-[280px] shrink-0 flex-col gap-3 rounded-2xl border border-border/50 bg-accent/20 p-3"
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          {label}
          <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
            {tasks.length}
          </Badge>
        </h3>
      </div>

      <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[80px] flex-col gap-2">
          {tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              subtaskCount={subtaskCounts[task.id] ?? 0}
              hasReminder={reminders.has(task.id)}
              onOpen={onOpen}
              onDelete={onDelete}
              selected={selectedIds.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
          {tasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-muted-foreground/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Solte cards aqui
            </p>
          )}
        </div>
      </SortableContext>

      {adding ? (
        <Input
          autoFocus
          value={title}
          placeholder="Título do card..."
          onChange={(event) => setTitle(event.target.value)}
          onBlur={submit}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") {
              setTitle("");
              setAdding(false);
            }
          }}
          className="h-9 bg-card text-sm"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar card
        </Button>
      )}
    </div>
  );
}
