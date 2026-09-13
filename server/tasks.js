import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./store.js";

const FILE = "tasks.json";

export async function listTasks() {
  const data = await readJson(FILE, { tasks: [] });
  return data.tasks;
}

export async function addTask({ text, priority, dueDate, recurrence }) {
  const data = await readJson(FILE, { tasks: [] });
  const task = {
    id: randomUUID(),
    text,
    done: false,
    priority: priority || "normal",
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    recurrence: recurrence || "none",
  };
  data.tasks.push(task);
  await writeJson(FILE, data);
  return task;
}

function nextDueDate(fromDate, recurrence) {
  const base = fromDate ? new Date(fromDate) : new Date();
  if (recurrence === "daily") base.setDate(base.getDate() + 1);
  else if (recurrence === "weekly") base.setDate(base.getDate() + 7);
  else if (recurrence === "monthly") base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export async function updateTask(id, patch) {
  const data = await readJson(FILE, { tasks: [] });
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;

  // Completing a recurring task doesn't retire it — it just rolls the due
  // date forward and stays open, the way a weekly chore should behave.
  if (patch.done === true && task.recurrence && task.recurrence !== "none") {
    task.completedAt = new Date().toISOString();
    task.dueDate = nextDueDate(task.dueDate, task.recurrence);
    delete patch.done;
  }

  Object.assign(task, patch);
  if ("done" in patch) {
    task.completedAt = patch.done ? new Date().toISOString() : null;
  }
  await writeJson(FILE, data);
  return task;
}

export async function deleteTask(id) {
  const data = await readJson(FILE, { tasks: [] });
  const next = data.tasks.filter((t) => t.id !== id);
  const removed = next.length !== data.tasks.length;
  data.tasks = next;
  await writeJson(FILE, data);
  return removed;
}
