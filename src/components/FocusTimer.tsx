import { useEffect, useRef, useState } from "react";
import type { Priority, Task } from "../types";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const DURATIONS = [5, 15, 25];

function pickTopTask(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  })[0];
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimer({ tasks }: { tasks: Task[] }) {
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topTask = pickTopTask(tasks);

  useEffect(() => {
    if (!running) setRemaining(duration * 60);
  }, [duration, running]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setJustFinished(true);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Time's up, Boss.", {
              body: topTask ? `Focus block done: ${topTask.text}` : "Focus block done.",
            });
          }
          return duration * 60;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setJustFinished(false);
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setJustFinished(false);
    setRemaining(duration * 60);
  }

  const progress = 1 - remaining / (duration * 60);

  return (
    <div className="glass flex items-center gap-5 rounded-2xl px-5 py-4">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#4fd7c8"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 28}
            strokeDashoffset={2 * Math.PI * 28 * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span className="font-mono text-sm text-ink">{formatTime(remaining)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Focus</p>
        <p className="truncate text-sm text-ink">
          {justFinished
            ? "Nice work, Boss."
            : topTask
              ? topTask.text
              : "Nothing queued — add an objective first."}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!running && (
          <div className="flex gap-1">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-md px-1.5 py-0.5 text-xs transition ${
                  duration === d ? "bg-cyan/15 text-cyan" : "text-ink-faint hover:text-ink"
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        )}
        {running ? (
          <button
            onClick={pause}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-ink-dim hover:text-ink"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-gold"
          >
            Start
          </button>
        )}
        <button onClick={reset} className="text-xs text-ink-faint hover:text-ink">
          Reset
        </button>
      </div>
    </div>
  );
}
