import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";

interface Command {
  id: string;
  label: string;
  run: () => void;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function dispatch(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCaptureStatus(null);
    }
  }, [open]);

  const commands: Command[] = useMemo(
    () => [
      { id: "capture", label: "Add an objective or note", run: () => dispatch("friday:open-capture") },
      { id: "chat", label: "Ask Friday something", run: () => { scrollTo("chat"); dispatch("friday:focus-chat"); } },
      { id: "brief", label: "Brief me on my inbox", run: () => { scrollTo("triage"); dispatch("friday:run-triage"); } },
      { id: "scan", label: "Clean up inbox now", run: () => { scrollTo("cleanup"); dispatch("friday:scan-inbox"); } },
      { id: "memory", label: "What Friday knows about you", run: () => { scrollTo("memory"); dispatch("friday:open-memory"); } },
      { id: "objectives", label: "Go to Objectives", run: () => scrollTo("objectives") },
      { id: "notes", label: "Go to Notes", run: () => scrollTo("notes") },
      { id: "inbox", label: "Go to Chief of Staff", run: () => scrollTo("triage") },
      { id: "calendar", label: "Go to Calendar", run: () => scrollTo("agenda") },
      { id: "weather", label: "Go to Weather", run: () => scrollTo("weather") },
    ],
    [],
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  async function runFallbackCapture() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setCaptureStatus("Filing…");
    try {
      const result = await api.capture(trimmed);
      setCaptureStatus(result.type === "task" ? "Filed as an objective." : "Filed as a note.");
      window.dispatchEvent(new CustomEvent("friday:captured", { detail: { type: result.type } }));
      setTimeout(() => setOpen(false), 700);
    } catch {
      setCaptureStatus("Couldn't file that, Boss.");
    }
  }

  function runCommand(command: Command) {
    command.run();
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (filtered[0]) runCommand(filtered[0]);
                  else runFallbackCapture();
                }
              }}
              placeholder="Type a command, or just capture a thought…"
              className="w-full bg-transparent px-5 py-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <div className="max-h-72 overflow-y-auto border-t border-white/10 p-2">
              {filtered.map((command) => (
                <button
                  key={command.id}
                  onClick={() => runCommand(command)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-dim transition hover:bg-white/5 hover:text-ink"
                >
                  {command.label}
                </button>
              ))}
              {filtered.length === 0 && query.trim() && (
                <button
                  onClick={runFallbackCapture}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-cyan transition hover:bg-white/5"
                >
                  {captureStatus || `Capture: "${query.trim()}"`}
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <p className="px-3 py-2 text-sm text-ink-faint">Type to search commands…</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
