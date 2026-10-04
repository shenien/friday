import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { parseLocalDate, timeAgo } from "../lib/date";
import { SendersView } from "./SendersView";
import type { JobStatus, TriageBucket, TriageItem, TriageState } from "../types";

type Tab = TriageBucket | "senders";

const TABS: { key: Tab; label: string }[] = [
  { key: "reply", label: "Reply" },
  { key: "action", label: "Action" },
  { key: "updates", label: "Updates" },
  { key: "newsletter", label: "Newsletters" },
  { key: "noise", label: "Noise" },
  { key: "senders", label: "Senders" },
];

const EMPTY_COPY: Record<TriageBucket, string> = {
  reply: "Nobody's waiting on you, Boss.",
  action: "Nothing needs doing right now.",
  updates: "No updates to catch up on.",
  newsletter: "No newsletters in the last few weeks.",
  noise: "No noise either. Suspiciously quiet.",
};

const URGENCY_DOT = { high: "bg-red-400", normal: "bg-gold", low: "bg-ink-faint" } as const;
const URGENCY_ORDER = { high: 0, normal: 1, low: 2 } as const;
const PAGE_SIZE = 8;
const STALE_MS = 30 * 60 * 1000;
const dueFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function sortItems(items: TriageItem[], bucket: TriageBucket) {
  const sorted = [...items];
  if (bucket === "reply" || bucket === "action") {
    // Most urgent first; within a level, whoever's been waiting longest.
    return sorted.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || b.ageDays - a.ageDays);
  }
  if (bucket === "newsletter" || bucket === "noise") {
    return sorted.sort((a, b) => a.fromName.localeCompare(b.fromName) || b.date.localeCompare(a.date));
  }
  return sorted.sort((a, b) => b.date.localeCompare(a.date));
}

function DueChip({ due }: { due: string }) {
  const date = parseLocalDate(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tone =
    date.getTime() < today.getTime() ? "text-red-400" : date.getTime() === today.getTime() ? "text-gold" : "text-ink-dim";
  return <span className={`shrink-0 text-[11px] ${tone}`}>Due {dueFormatter.format(date)}</span>;
}

export function ChiefOfStaffPanel() {
  const [state, setState] = useState<TriageState | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [tab, setTab] = useState<Tab>("reply");
  const [collapsed, setCollapsed] = useState(false);
  const [shown, setShown] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const bootstrapped = useRef(false);
  const picked = useRef(false);

  const run = useCallback(async () => {
    try {
      const { job } = await api.runTriage();
      setJob(job);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't start the briefing.", tone: "error" });
    }
  }, []);

  // Show whatever we last figured out right away, then quietly refresh if
  // it's gone stale — same instant-then-update feel as the inbox cleanup.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    api.getTriage().then(({ state, job }) => {
      setState(state);
      setJob(job);
      const age = state.generatedAt ? Date.now() - new Date(state.generatedAt).getTime() : Infinity;
      if (!job.running && age > STALE_MS) run();
    });
  }, [run]);

  useEffect(() => {
    function onRequested() {
      if (!job?.running) run();
    }
    window.addEventListener("friday:run-triage", onRequested);
    return () => window.removeEventListener("friday:run-triage", onRequested);
  }, [job?.running, run]);

  useEffect(() => {
    if (!job?.running) return;
    const timer = setInterval(() => {
      api.getTriage().then(({ state, job }) => {
        setJob(job);
        if (!job.running) setState(state);
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [job?.running]);

  // Land on the first bucket that actually has something in it.
  useEffect(() => {
    if (!state || picked.current || !state.generatedAt) return;
    picked.current = true;
    const live = (b: TriageBucket) => state.items.some((i) => i.bucket === b && !i.dismissed);
    const first = (["reply", "action", "updates", "newsletter", "noise"] as TriageBucket[]).find(live);
    if (first) setTab(first);
  }, [state]);

  const items = (state?.items ?? []).filter((i) => !i.dismissed);
  const counts = {
    reply: items.filter((i) => i.bucket === "reply").length,
    action: items.filter((i) => i.bucket === "action").length,
    updates: items.filter((i) => i.bucket === "updates").length,
    newsletter: items.filter((i) => i.bucket === "newsletter").length,
    noise: items.filter((i) => i.bucket === "noise").length,
  };

  async function guarded<T>(key: string, action: () => Promise<T>, okText?: (r: T) => string) {
    setBusy(key);
    setNotice(null);
    try {
      const result = await action();
      if (okText) setNotice({ text: okText(result), tone: "ok" });
      return result;
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't go through.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  function dismiss(item: TriageItem) {
    setState((s) =>
      s && { ...s, items: s.items.map((i) => (i.threadId === item.threadId ? { ...i, dismissed: true } : i)) },
    );
    api.dismissTriage(item.threadId, item.lastMessageId).catch(() => {});
  }

  // Opening a thread in Gmail means you've read it, so mirror that here.
  function opened(item: TriageItem) {
    if (!item.unread) return;
    setState((s) =>
      s && { ...s, items: s.items.map((i) => (i.threadId === item.threadId ? { ...i, unread: false } : i)) },
    );
    api.markThreadRead(item.threadId).catch(() => {});
  }

  const markRead = (item: TriageItem) =>
    guarded(`read-${item.threadId}`, () => api.markThreadRead(item.threadId)).then((r) => r && setState(r.state));

  const markSpam = (item: TriageItem) =>
    guarded(`spam-${item.threadId}`, () => api.markThreadSpam(item.threadId)).then((r) => r && setState(r.state));

  const unsubscribe = (item: TriageItem) =>
    guarded(
      `unsub-${item.threadId}`,
      () => api.unsubscribeThread(item.threadId),
      (r) => (r.ok ? `Unsubscribed from ${item.fromName}.` : `${item.fromName} didn't confirm the unsubscribe.`),
    ).then((r) => r && setState(r.state));

  const markAllRead = (bucket: TriageBucket) =>
    guarded(
      `bucket-${bucket}`,
      () => api.markBucketRead(bucket),
      (r) => `Marked ${r.marked} thread${r.marked === 1 ? "" : "s"} as read.`,
    ).then((r) => r && setState(r.state));

  const bucket = tab === "senders" ? null : tab;
  const list = bucket ? sortItems(items.filter((i) => i.bucket === bucket), bucket) : [];
  const visible = list.slice(0, shown[tab] ?? PAGE_SIZE);
  const remaining = list.length - visible.length;
  const unreadInBucket = list.filter((i) => i.unread).length;
  const running = Boolean(job?.running);
  const progress =
    running && job && job.total > 0 ? ` ${job.phase === "classifying" ? "sorting" : "reading"} ${job.done}/${job.total}` : "";

  return (
    <div id="triage" className="glass flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink"
        >
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} className="inline-block">
            ▾
          </motion.span>
          Chief of Staff
        </button>
        <div className="flex items-center gap-3">
          {state?.generatedAt && !running && (
            <span className="hidden text-xs text-ink-faint sm:inline">Updated {timeAgo(state.generatedAt)}</span>
          )}
          <button
            onClick={run}
            disabled={running}
            className="rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold disabled:opacity-50"
          >
            {running ? `Briefing…${progress}` : "Brief me"}
          </button>
        </div>
      </div>

      {job?.error && (
        <p className="text-sm text-red-400">
          {job.error.message}{" "}
          {job.error.code === "reauth" && (
            <a href="/api/auth/google" className="text-cyan underline">
              Reconnect Google
            </a>
          )}
        </p>
      )}
      {notice && <p className={`text-sm ${notice.tone === "ok" ? "text-cyan" : "text-red-400"}`}>{notice.text}</p>}

      {collapsed ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-faint">
          <span>Reply: {counts.reply}</span>
          <span>Action: {counts.action}</span>
          <span>Updates: {counts.updates}</span>
          <span>Newsletters: {counts.newsletter}</span>
          <span>Noise: {counts.noise}</span>
        </div>
      ) : (
        <>
          {state?.generatedAt ? (
            <p className="text-xs text-ink-faint">
              {counts.reply + counts.action > 0
                ? `${counts.reply} waiting on a reply and ${counts.action} needing action, `
                : "Nothing is waiting on you, "}
              from {state.stats.threads} threads in the last {state.windowDays} days
              {state.stats.handled > 0 ? ` (${state.stats.handled} you've already answered)` : ""}.
            </p>
          ) : (
            !running && (
              <p className="text-sm text-ink-faint">
                Hit "Brief me" and I'll go through your inbox: who's waiting on you, what needs doing, and what's just
                noise.
              </p>
            )
          )}

          <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2 text-xs">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1 transition ${
                  tab === t.key ? "bg-cyan/15 text-cyan" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t.label}
                {t.key !== "senders" && ` (${counts[t.key]})`}
              </button>
            ))}
          </div>

          {tab === "senders" ? (
            <SendersView />
          ) : (
            <div className="space-y-2">
              {bucket && (bucket === "newsletter" || bucket === "noise" || bucket === "updates") && unreadInBucket > 0 && (
                <button
                  onClick={() => markAllRead(bucket)}
                  disabled={busy === `bucket-${bucket}`}
                  className="text-xs text-ink-faint transition hover:text-cyan disabled:opacity-50"
                >
                  {busy === `bucket-${bucket}` ? "Marking…" : `Mark all ${unreadInBucket} unread as read`}
                </button>
              )}
              {visible.length === 0 && bucket && state?.generatedAt && (
                <p className="text-sm text-ink-faint">{EMPTY_COPY[bucket]}</p>
              )}
              <AnimatePresence initial={false}>
                {visible.map((item) => (
                  <motion.div
                    key={item.threadId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2.5"
                  >
                    {(item.bucket === "reply" || item.bucket === "action") && (
                      <span
                        title={`${item.urgency} urgency`}
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${URGENCY_DOT[item.urgency]}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <a
                          href={item.gmailUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => opened(item)}
                          className={`truncate text-sm hover:text-cyan hover:underline ${
                            item.unread ? "font-semibold text-ink" : "text-ink-dim"
                          }`}
                        >
                          {item.vip && <span className="mr-1 text-gold">★</span>}
                          {item.subject}
                        </a>
                        <span className="flex shrink-0 items-baseline gap-2">
                          {item.due && <DueChip due={item.due} />}
                          <span className="text-[11px] text-ink-faint">{item.ageDays === 0 ? "today" : `${item.ageDays}d`}</span>
                        </span>
                      </div>
                      <p className="truncate text-xs text-ink-faint">
                        {item.fromName}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                      {item.nextStep && <p className="mt-0.5 truncate text-xs text-cyan">→ {item.nextStep}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.canUnsubscribe && (item.bucket === "newsletter" || item.bucket === "noise") && (
                        <button
                          onClick={() => unsubscribe(item)}
                          disabled={busy === `unsub-${item.threadId}`}
                          className="rounded-md bg-red-400/15 px-2 py-1 text-xs text-red-400 transition hover:bg-red-400/25 disabled:opacity-50"
                        >
                          Unsubscribe
                        </button>
                      )}
                      {item.unread && item.bucket !== "reply" && item.bucket !== "action" && (
                        <button
                          onClick={() => markRead(item)}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-cyan"
                        >
                          Read
                        </button>
                      )}
                      {item.bucket === "noise" && (
                        <button
                          onClick={() => markSpam(item)}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-red-400"
                        >
                          Spam
                        </button>
                      )}
                      {(item.bucket === "reply" || item.bucket === "action" || item.bucket === "updates") && (
                        <button
                          onClick={() => dismiss(item)}
                          title="Handled — hide until something new arrives"
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-cyan"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {remaining > 0 && (
                <button
                  onClick={() => setShown((s) => ({ ...s, [tab]: (s[tab] ?? PAGE_SIZE) + PAGE_SIZE }))}
                  className="text-xs text-ink-faint transition hover:text-cyan"
                >
                  Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} left)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
