import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import type { ChatMessage } from "../types";

const PROMPTS = [
  "What do you need, Boss?",
  "I'm listening.",
  "Go ahead — I'm all yours.",
  "What can I do for you?",
];
const PROMPT = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onFocusChat() {
      inputRef.current?.focus();
    }
    window.addEventListener("friday:focus-chat", onFocusChat);
    return () => window.removeEventListener("friday:focus-chat", onFocusChat);
  }, []);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const { reply } = await api.chat(next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Systems hiccupped, Boss — try that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <motion.div layout id="chat" className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Ask Friday</h2>
        {!hasMessages && <span className="text-xs text-ink-faint">{PROMPT}</span>}
      </div>

      <AnimatePresence initial={false}>
        {hasMessages && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-64 space-y-2 overflow-y-auto"
          >
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-auto bg-cyan/15 text-ink" : "bg-white/5 text-ink-dim"
                }`}
              >
                {m.content}
              </motion.div>
            ))}
            {sending && <p className="text-sm text-ink-faint">On it…</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a question…"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/50 focus:outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={send}
          disabled={sending}
          className="rounded-lg bg-gold/90 px-3 text-sm font-medium text-black transition hover:bg-gold disabled:opacity-50"
        >
          Send
        </motion.button>
      </div>
    </motion.div>
  );
}
