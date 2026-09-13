import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { parseLocalDate } from "../lib/date";
import type { CalendarEvent } from "../types";

type State = { status: "loading" | "unavailable" | "ready"; events: CalendarEvent[] };

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const DAY_MS = 86400000;

function eventStart(event: CalendarEvent) {
  return event.allDay ? parseLocalDate(event.start!) : new Date(event.start!);
}

function formatWhen(event: CalendarEvent) {
  if (!event.start) return "";
  const start = eventStart(event);

  if (event.allDay) {
    // Google's all-day `end.date` is exclusive (a 3-day event Sep 15–17 has
    // end = Sep 18), so step back a day to get the actual last day shown.
    const inclusiveEnd = event.end
      ? new Date(parseLocalDate(event.end).getTime() - DAY_MS)
      : start;
    if (inclusiveEnd.getTime() > start.getTime()) {
      return `${dateFormatter.format(start)} – ${dateFormatter.format(inclusiveEnd)}`;
    }
    return dateFormatter.format(start);
  }

  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}`;
}

function daysUntil(event: CalendarEvent) {
  if (!event.start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = eventStart(event);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days}d`;
  return null;
}

export function AgendaPanel() {
  const [state, setState] = useState<State>({ status: "loading", events: [] });

  useEffect(() => {
    api
      .agenda()
      .then(({ events }) => setState({ status: "ready", events }))
      .catch(() => setState({ status: "unavailable", events: [] }));
  }, []);

  if (state.status === "unavailable") return null;

  return (
    <div id="agenda" className="glass flex h-full flex-col gap-2 rounded-2xl px-5 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
        Coming Up This Month
      </h2>
      {state.status === "loading" && <p className="text-sm text-ink-faint">Checking your calendar…</p>}
      {state.status === "ready" && state.events.length === 0 && (
        <p className="text-sm text-ink-faint">Nothing on the horizon, Boss.</p>
      )}
      {state.status === "ready" && state.events.length > 0 && (
        <div className="space-y-2.5 overflow-y-auto">
          {state.events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-ink-faint">{formatWhen(event)}</span>
                {daysUntil(event) && <span className="shrink-0 text-[11px] text-cyan">{daysUntil(event)}</span>}
              </div>
              <p className="truncate text-sm text-ink">{event.title}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
