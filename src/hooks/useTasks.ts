import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Recurrence, Task } from "../types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return api.listTasks().then(({ tasks }) => setTasks(tasks));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function toggleDone(task: Task) {
    const { task: updated } = await api.updateTask(task.id, { done: !task.done });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function setDueDate(id: string, dueDate: string | null) {
    const { task: updated } = await api.updateTask(id, { dueDate });
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function setRecurrence(id: string, recurrence: Recurrence) {
    const { task: updated } = await api.updateTask(id, { recurrence });
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function removeTask(id: string) {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return { tasks, loading, refresh, toggleDone, setDueDate, setRecurrence, removeTask };
}
