import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";

export function MemoryPanel() {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    function onOpenMemory() {
      setOpen(true);
    }
    window.addEventListener("friday:open-memory", onOpenMemory);
    return () => window.removeEventListener("friday:open-memory", onOpenMemory);
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      api.listFacts().then(({ facts }) => {
        setFacts(facts);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  async function addFact() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const { facts } = await api.addFact(trimmed);
    setFacts(facts);
    setDraft("");
  }

  async function removeFact(index: number) {
    const { facts } = await api.removeFact(index);
    setFacts(facts);
  }

  return (
    <div id="memory" className="glass rounded-2xl p-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink"
      >
        <span className="flex items-center gap-2">
          <motion.span animate={{ rotate: open ? -90 : 0 }} className="inline-block">
            ▾
          </motion.span>
          What Friday Knows About You
        </span>
        {loaded && <span className="normal-case tracking-normal text-ink-faint">{facts.length}</span>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1.5">
              {facts.length === 0 && (
                <p className="text-sm text-ink-faint">
                  Nothing learned yet — the more we talk, the more I'll pick up.
                </p>
              )}
              {facts.map((fact, i) => (
                <div key={i} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <span className="flex-1 text-sm text-ink-dim">{fact}</span>
                  <button
                    onClick={() => removeFact(i)}
                    className="text-ink-faint opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    aria-label="Forget this"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFact()}
                placeholder="Tell me something to remember…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/50 focus:outline-none"
              />
              <button
                onClick={addFact}
                className="shrink-0 rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-gold"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
