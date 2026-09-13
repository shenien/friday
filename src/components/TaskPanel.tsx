import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Priority, Recurrence, Task } from "../types";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-400",
  normal: "bg-cyan",
  low: "bg-ink-faint",
};
const RECURRENCE_CYCLE: Recurrence[] = ["none", "daily", "weekly", "monthly"];
const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dueLabel(task: Task): { text: string; className: string } | null {
  if (!task.dueDate || task.done) return null;
  const today = todayISO();
  if (task.dueDate < today) return { text: "Overdue", className: "text-red-400" };
  if (task.dueDate === today) return { text: "Due today", className: "text-gold" };
  return { text: `Due ${task.dueDate}`, className: "text-ink-faint" };
}

interface TaskPanelProps {
  tasks: Task[];
  loading: boolean;
  onToggle: (task: Task) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetRecurrence: (id: string, recurrence: Recurrence) => void;
  onRemove: (id: string) => void;
}

export function TaskPanel({
  tasks,
  loading,
  onToggle,
  onSetDueDate,
  onSetRecurrence,
  onRemove,
}: TaskPanelProps) {
  const [editingDueFor, setEditingDueFor] = useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  const openCount = tasks.filter((t) => !t.done).length;

  function cycleRecurrence(task: Task) {
    const idx = RECURRENCE_CYCLE.indexOf(task.recurrence);
    onSetRecurrence(task.id, RECURRENCE_CYCLE[(idx + 1) % RECURRENCE_CYCLE.length]);
  }

  return (
    <div id="objectives" className="glass flex h-full flex-col rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Objectives</h2>
        <span className="text-xs text-ink-faint">{openCount} open</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {loading && <p className="text-sm text-ink-faint">Loading objectives…</p>}
        {!loading && sorted.length === 0 && (
          <p className="text-sm text-ink-faint">
            Nothing on the list, Boss. Drop a thought in the capture button to add one.
          </p>
        )}
        <AnimatePresence initial={false}>
          {sorted.map((task) => {
            const due = dueLabel(task);
            const isEditingDue = editingDueFor === task.id;
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
              >
                <button
                  onClick={() => onToggle(task)}
                  className={`h-4 w-4 shrink-0 rounded-full border transition ${
                    task.done ? "border-cyan bg-cyan" : "border-white/30 hover:border-cyan"
                  }`}
                  aria-label="Toggle done"
                  title={task.recurrence !== "none" ? "Completing rolls this to its next due date" : undefined}
                />
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                <span
                  className={`flex-1 text-sm ${task.done ? "text-ink-faint line-through" : "text-ink"}`}
                >
                  {task.text}
                </span>

                <button
                  onClick={() => cycleRecurrence(task)}
                  className={`shrink-0 text-xs transition hover:text-cyan ${
                    task.recurrence !== "none"
                      ? "text-cyan"
                      : "text-ink-faint opacity-0 group-hover:opacity-100"
                  }`}
                  title="Click to cycle: none → daily → weekly → monthly"
                >
                  {task.recurrence === "none" ? "↻" : `↻ ${RECURRENCE_LABEL[task.recurrence]}`}
                </button>

                {isEditingDue ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={task.dueDate ?? ""}
                    onBlur={(e) => {
                      onSetDueDate(task.id, e.target.value || null);
                      setEditingDueFor(null);
                    }}
                    className="w-32 shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-ink-dim focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingDueFor(task.id)}
                    className={`shrink-0 text-xs ${
                      due ? due.className : "text-ink-faint opacity-0 group-hover:opacity-100"
                    } hover:underline`}
                  >
                    {due ? due.text : "+ due date"}
                  </button>
                )}

                <button
                  onClick={() => onRemove(task.id)}
                  className="text-ink-faint opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
