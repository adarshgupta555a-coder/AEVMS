"use client";

import * as React from "react";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Pencil,
  Trash2,
  Calendar,
  ListTodo,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useEventTasks,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} from "../hooks/use-events";
import type {
  EventTaskItem,
  CreateEventTaskInput,
  UpdateEventTaskInput,
} from "../schemas/event.schema";
import type { TaskPriority, TaskStatus } from "@/types/models";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";

interface EventTasksTabProps {
  eventId: string;
}

const priorityColors: Record<
  string,
  { badge: string; dot: string; label: string }
> = {
  URGENT: {
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    dot: "bg-rose-500",
    label: "Urgent",
  },
  HIGH: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    label: "High",
  },
  MEDIUM: {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
    label: "Medium",
  },
  LOW: {
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
    dot: "bg-slate-400",
    label: "Low",
  },
};

export function EventTasksTab({ eventId }: EventTasksTabProps) {
  const { data: tasks = [], isLoading } = useEventTasks(eventId);
  const createTaskMutation = useCreateTaskMutation(eventId);
  const updateTaskMutation = useUpdateTaskMutation(eventId);
  const deleteTaskMutation = useDeleteTaskMutation(eventId);

  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<EventTaskItem | null>(null);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null);

  // Form states for Create/Edit
  const [formData, setFormData] = React.useState<{
    title: string;
    description: string;
    dueDate: string;
    priority: TaskPriority;
    status: TaskStatus;
  }>({
    title: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    status: "TODO",
  });

  const openCreateDialog = () => {
    setFormData({
      title: "",
      description: "",
      dueDate: "",
      priority: "MEDIUM",
      status: "TODO",
    });
    setIsCreateOpen(true);
  };

  const openEditDialog = (task: EventTaskItem) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate
        ? format(new Date(task.dueDate), "yyyy-MM-dd")
        : "",
      priority: task.priority,
      status: task.status,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      const payload: CreateEventTaskInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        priority: formData.priority,
        status: formData.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      };

      await createTaskMutation.mutateAsync(payload);
      toast.success("Task created successfully");
      setIsCreateOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!formData.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      const payload: UpdateEventTaskInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        priority: formData.priority,
        status: formData.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      };

      await updateTaskMutation.mutateAsync({
        taskId: editingTask.id,
        data: payload,
      });
      toast.success("Task updated successfully");
      setEditingTask(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleToggleTaskStatus = async (task: EventTaskItem) => {
    const nextStatus: TaskStatus =
      task.status === "COMPLETED" ? "TODO" : "COMPLETED";

    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: { status: nextStatus },
      });
      toast.success(
        nextStatus === "COMPLETED"
          ? "Task marked as completed"
          : "Task moved back to To-Do"
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update task status"
      );
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await deleteTaskMutation.mutateAsync(deletingTaskId);
      toast.success("Task deleted successfully");
      setDeletingTaskId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const filteredTasks = React.useMemo(() => {
    if (statusFilter === "ALL") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const stats = React.useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const todo = tasks.filter((t) => t.status === "TODO").length;
    return { total, completed, inProgress, todo };
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === "ALL"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("TODO")}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === "TODO"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              To Do ({stats.todo})
            </button>
            <button
              onClick={() => setStatusFilter("IN_PROGRESS")}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === "IN_PROGRESS"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              In Progress ({stats.inProgress})
            </button>
            <button
              onClick={() => setStatusFilter("COMPLETED")}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === "COMPLETED"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Completed ({stats.completed})
            </button>
          </div>
        </div>

        <Button size="sm" onClick={openCreateDialog} className="gap-1.5 h-8">
          <Plus className="size-3.5" />
          Add Task
        </Button>
      </div>

      {/* Task List */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Operational Task Checklist
              </CardTitle>
              <CardDescription className="text-xs">
                Track deliverables, procurement actions, vendor follow-ups, and run-sheet items.
              </CardDescription>
            </div>
            {stats.total > 0 && (
              <Badge variant="outline" className="text-xs">
                {stats.completed}/{stats.total} Completed (
                {Math.round((stats.completed / stats.total) * 100)}%)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading event operational tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                <ListTodo className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                No tasks found in this view
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add checklists, procurement actions, and assignments for this event.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs h-7"
                onClick={openCreateDialog}
              >
                <Plus className="size-3.5 mr-1" /> Create Task
              </Button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isCompleted = task.status === "COMPLETED";
              const isOverdue =
                task.dueDate &&
                isPast(parseISO(task.dueDate)) &&
                !isCompleted;
              const priorityCfg =
                priorityColors[task.priority] || priorityColors.MEDIUM;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors",
                    isCompleted && "bg-muted/15"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(task)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      title={
                        isCompleted
                          ? "Mark as incomplete"
                          : "Mark as completed"
                      }
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="size-4 hover:stroke-primary" />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium text-foreground",
                            isCompleted && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", priorityCfg.badge)}
                        >
                          <span
                            className={cn(
                              "size-1 rounded-full mr-1",
                              priorityCfg.dot
                            )}
                          />
                          {priorityCfg.label}
                        </Badge>

                        {task.status === "IN_PROGRESS" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 px-1.5 py-0"
                          >
                            In Progress
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p
                          className={cn(
                            "text-[11px] text-muted-foreground line-clamp-2",
                            isCompleted && "line-through opacity-70"
                          )}
                        >
                          {task.description}
                        </p>
                      )}

                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {isOverdue ? (
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                              <AlertTriangle className="size-3" />
                              Overdue ({formatDate(task.dueDate)})
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              Due {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(task)}
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title="Edit task"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeletingTaskId(task.id)}
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title="Delete task"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Add Operational Task
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create a milestone or action item for this event production.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="task-title" className="text-xs">
                  Task Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-title"
                  placeholder="e.g. Confirm audio/visual technician crew"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-desc" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="task-desc"
                  placeholder="Brief details or scope of this deliverable..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="task-due" className="text-xs">
                    Due Date
                  </Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="task-priority" className="text-xs">
                    Priority
                  </Label>
                  <select
                    id="task-priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        priority: e.target.value as TaskPriority,
                      }))
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createTaskMutation.isPending}
                className="text-xs h-8"
              >
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleUpdateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Edit Operational Task
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update task status, priority, or due date.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="edit-task-title" className="text-xs">
                  Task Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-task-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-task-desc" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="edit-task-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-task-due" className="text-xs">
                    Due Date
                  </Label>
                  <Input
                    id="edit-task-due"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-task-priority" className="text-xs">
                    Priority
                  </Label>
                  <select
                    id="edit-task-priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        priority: e.target.value as TaskPriority,
                      }))
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-task-status" className="text-xs">
                    Status
                  </Label>
                  <select
                    id="edit-task-status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value as TaskStatus,
                      }))
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingTask(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateTaskMutation.isPending}
                className="text-xs h-8"
              >
                {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingTaskId)}
        onOpenChange={(open) => !open && setDeletingTaskId(null)}
        title="Delete Operational Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete Task"
        variant="destructive"
        onConfirm={handleDeleteTask}
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
}
