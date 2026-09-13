import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";

interface CaptureBarProps {
  onCaptured: (result: { type: "task" | "note" }) => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number };
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function CaptureBar({ onCaptured }: CaptureBarProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const SpeechRecognitionCtor = getSpeechRecognition();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    function onOpenCapture() {
      setOpen(true);
    }
    window.addEventListener("friday:open-capture", onOpenCapture);
    return () => window.removeEventListener("friday:open-capture", onOpenCapture);
  }, []);

  function toggleListening() {
    if (!SpeechRecognitionCtor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const result = await api.capture(trimmed);
      setText("");
      setStatus(result.type === "task" ? "Filed as an objective." : "Filed as a note.");
      onCaptured(result);
      setTimeout(() => setStatus(null), 2500);
    } catch {
      setStatus("Couldn't file that one, Boss.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="glass w-80 rounded-2xl p-4 shadow-2xl"
          >
            <p className="mb-2 text-xs text-ink-faint">
              Capture a thought — I'll sort out whether it's a task or a note.
            </p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="What's on your mind…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/50 focus:outline-none"
              />
              {SpeechRecognitionCtor && (
                <button
                  onClick={toggleListening}
                  title={listening ? "Stop listening" : "Speak instead of typing"}
                  className={`shrink-0 rounded-lg px-2.5 text-sm transition ${
                    listening ? "breathe bg-red-400/20 text-red-400" : "bg-white/5 text-ink-faint hover:text-cyan"
                  }`}
                >
                  🎙
                </button>
              )}
              <button
                onClick={submit}
                disabled={sending}
                className="shrink-0 rounded-lg bg-gold/90 px-3 py-2 text-sm font-medium text-black hover:bg-gold disabled:opacity-50"
              >
                {sending ? "…" : "Go"}
              </button>
            </div>
            {status && <p className="mt-2 text-xs text-cyan">{status}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className="glass glow-cyan flex h-14 w-14 items-center justify-center rounded-full text-2xl text-cyan shadow-xl"
        aria-label="Capture a thought"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.15 }}>
          +
        </motion.span>
      </motion.button>
    </div>
  );
}
