import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { timeAgo } from "../lib/date";
import type { JobStatus, SenderRule, SenderStat, SenderStats } from "../types";

interface SendersData {
  stats: SenderStats;
  rules: Record<string, SenderRule>;
  job: JobStatus;
}

const KIND_LABEL = { person: "Person", newsletter: "Newsletter", automated: "Automated" } as const;
const KIND_TONE = {
  person: "bg-cyan/15 text-cyan",
  newsletter: "bg-gold/15 text-gold",
  automated: "bg-white/10 text-ink-dim",
} as const;
const PAGE_SIZE = 12;

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function SendersView() {
  const [data, setData] = useState<SendersData | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api.getSenders().then(setData);
  }, []);

  const running = Boolean(data?.job.running);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => api.getSenders().then(setData), 2500);
    return () => clearInterval(timer);
  }, [running]);

  async function analyze() {
    setNotice(null);
    try {
      const { job } = await api.analyzeSenders();
      setData((d) => d && { ...d, job });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't start the analysis.", tone: "error" });
    }
  }

  async function toggleRule(sender: SenderStat, rule: SenderRule) {
    const next = data?.rules[sender.email] === rule ? null : rule;
    const { rules } = await api.setSenderRule(sender.email, next);
    setData((d) => d && { ...d, rules });
  }

  async function unsubscribe(sender: SenderStat) {
    setBusy(sender.email);
    setNotice(null);
    try {
      const { ok } = await api.unsubscribeSender(sender.email);
      if (ok) {
        setNotice({ text: `Unsubscribed from ${sender.name}.`, tone: "ok" });
        setData(await api.getSenders());
      } else {
        setNotice({ text: `${sender.name} didn't confirm the unsubscribe.`, tone: "error" });
      }
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't unsubscribe.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="text-sm text-ink-faint">Loading…</p>;

  const { stats, rules, job } = data;
  const senders = stats.senders;
  const top = senders[0]?.count || 1;
  const highVolume = senders.filter((s) => s.highVolume && !s.unsubscribedAt).length;
  const progress = running && job.total > 0 ? ` ${job.done}/${job.total}` : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-faint">
          {stats.generatedAt && stats.totals
            ? `Based on ${stats.sampled} messages from the last ${stats.spanDays} days · analyzed ${timeAgo(stats.generatedAt)}`
            : "See who actually fills your inbox, and which bulk senders you can cut off."}
        </p>
        <button
          onClick={analyze}
          disabled={running}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-ink transition hover:bg-white/15 disabled:opacity-50"
        >
          {running ? `Analyzing…${progress}` : stats.generatedAt ? "Re-analyze" : "Analyze my senders"}
        </button>
      </div>

      {job.error && (
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

      {stats.totals && (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-sm text-ink-dim">
          Your top 10 senders account for <span className="text-ink">{pct(stats.totals.topTenShare)}</span> of your mail,
          and <span className="text-ink">{pct(stats.totals.automatedShare)}</span> of it is automated.
          {highVolume > 0 && (
            <>
              {" "}
              <span className="text-gold">
                {highVolume} bulk sender{highVolume === 1 ? "" : "s"} email{highVolume === 1 ? "s" : ""} you 8+ times a
                month
              </span>{" "}
              and can be unsubscribed from.
            </>
          )}
        </p>
      )}

      <div className="space-y-1.5">
        {senders.slice(0, shown).map((s, i) => {
          const rule = rules[s.email];
          return (
            <div key={s.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/5 px-3 py-2">
              <span className="w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
              <div className="min-w-[10rem] flex-1">
                <p className="truncate text-sm text-ink">
                  {rule === "vip" && <span className="mr-1 text-gold">★</span>}
                  {s.name}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {s.email}
                  {s.recentSubjects[0] ? ` · “${s.recentSubjects[0]}”` : ""}
                </p>
              </div>
              <div className="w-28 shrink-0">
                <p className="text-xs text-ink-dim">
                  {s.count} total · ~{s.perMonth}/mo
                </p>
                <div className="mt-1 h-1 rounded-full bg-white/10">
                  <div className="h-1 rounded-full bg-gradient-to-r from-cyan to-gold" style={{ width: pct(s.count / top) }} />
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${KIND_TONE[s.kind]}`}>
                {KIND_LABEL[s.kind]}
              </span>
              {s.highVolume && !s.unsubscribedAt && (
                <span className="shrink-0 rounded-full bg-red-400/15 px-2 py-0.5 text-[11px] text-red-400">
                  High volume
                </span>
              )}
              {s.unread > 0 && <span className="shrink-0 text-xs text-gold">{s.unread} unread</span>}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => toggleRule(s, "vip")}
                  title="VIP: always surface their mail first"
                  className={`rounded-md px-2 py-1 text-xs transition ${
                    rule === "vip" ? "bg-gold/20 text-gold" : "bg-white/5 text-ink-faint hover:text-gold"
                  }`}
                >
                  ★ VIP
                </button>
                <button
                  onClick={() => toggleRule(s, "mute")}
                  title="Mute: always file their mail under Noise"
                  className={`rounded-md px-2 py-1 text-xs transition ${
                    rule === "mute" ? "bg-white/15 text-ink" : "bg-white/5 text-ink-faint hover:text-ink"
                  }`}
                >
                  {rule === "mute" ? "Muted" : "Mute"}
                </button>
                {s.unsubscribedAt ? (
                  <span className="px-1 text-xs text-cyan">✓ Unsubscribed</span>
                ) : (
                  s.canUnsubscribe && (
                    <button
                      onClick={() => unsubscribe(s)}
                      disabled={busy === s.email}
                      className="rounded-md bg-red-400/15 px-2 py-1 text-xs text-red-400 transition hover:bg-red-400/25 disabled:opacity-50"
                    >
                      {busy === s.email ? "…" : "Unsubscribe"}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {senders.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="text-xs text-ink-faint transition hover:text-cyan"
        >
          Show {Math.min(senders.length - shown, PAGE_SIZE)} more ({senders.length - shown} left)
        </button>
      )}
    </div>
  );
}
