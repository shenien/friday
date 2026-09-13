import { currentPeriod } from "../lib/greeting";
import type { Task } from "../types";

const HEADER_BY_PERIOD: Record<ReturnType<typeof currentPeriod>, string> = {
  morning: "Where things stand",
  afternoon: "Status check",
  evening: "What you got done today",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinDays(iso: string | null, days: number) {
  if (!iso) return false;
  const diffMs = Date.now() - new Date(iso).getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

interface DebriefPanelProps {
  tasks: Task[];
}

export function DebriefPanel({ tasks }: DebriefPanelProps) {
  const today = todayISO();
  const completedToday = tasks.filter((t) => t.completedAt?.slice(0, 10) === today).length;
  const completedThisWeek = tasks.filter((t) => isWithinDays(t.completedAt, 7)).length;
  const overdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length;
  const dueToday = tasks.filter((t) => !t.done && t.dueDate === today).length;

  const period = currentPeriod();
  const hasAnything = completedToday > 0 || completedThisWeek > 0 || overdue > 0 || dueToday > 0;

  return (
    <div className="glass flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl px-5 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
        {HEADER_BY_PERIOD[period]}
      </h2>
      {!hasAnything && (
        <p className="text-sm text-ink-faint">Nothing logged yet — add an objective to get started.</p>
      )}
      {hasAnything && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Stat value={completedToday} label="done today" tone="text-cyan" />
          <Stat value={completedThisWeek} label="done this week" tone="text-ink-dim" />
          <Stat value={dueToday} label="due today" tone="text-gold" />
          <Stat value={overdue} label="overdue" tone="text-red-400" />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  if (value === 0) return null;
  return (
    <span>
      <span className={`font-semibold ${tone}`}>{value}</span>{" "}
      <span className="text-ink-faint">{label}</span>
    </span>
  );
}
