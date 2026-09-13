import { AnimatePresence, motion } from "framer-motion";
import type { Note } from "../types";

interface NotesPanelProps {
  notes: Note[];
  loading: boolean;
  onRemove: (id: string) => void;
}

export function NotesPanel({ notes, loading, onRemove }: NotesPanelProps) {
  return (
    <div id="notes" className="glass flex h-full flex-col rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Notes</h2>
        <span className="text-xs text-ink-faint">{notes.length}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading && <p className="text-sm text-ink-faint">Loading notes…</p>}
        {!loading && notes.length === 0 && (
          <p className="text-sm text-ink-faint">
            Nothing filed yet — drop a thought in the capture button to add one.
          </p>
        )}
        <AnimatePresence initial={false}>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-white/5"
            >
              <span className="flex-1 text-sm text-ink">{note.text}</span>
              <button
                onClick={() => onRemove(note.id)}
                className="text-ink-faint opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
