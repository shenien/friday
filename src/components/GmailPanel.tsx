import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import type { EmailSummary, InboxReview, TravelCandidate, UnsubscribeCandidate } from "../types";

const EMPTY: InboxReview = {
  scannedAt: null,
  stats: { scanned: 0, human: 0, markedRead: 0 },
  people: [],
  orders: [],
  other: [],
  unsubscribeCandidates: [],
  travelCandidates: [],
};

const PAGE_SIZE = 5;
type Tab = "people" | "orders" | "other";
const TABS: { key: Tab; label: string }[] = [
  { key: "people", label: "People" },
  { key: "orders", label: "Orders & Deliveries" },
  { key: "other", label: "Other" },
];

export function GmailPanel() {
  const [review, setReview] = useState<InboxReview>(EMPTY);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [unsubCollapsed, setUnsubCollapsed] = useState(true);
  const [travelCollapsed, setTravelCollapsed] = useState(true);
  const [travelShown, setTravelShown] = useState(PAGE_SIZE);
  const [travelResolved, setTravelResolved] = useState<Record<string, "added" | "failed" | "skipped">>({});
  const [travelError, setTravelError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("people");
  const [shown, setShown] = useState<Record<Tab, number>>({ people: PAGE_SIZE, orders: PAGE_SIZE, other: PAGE_SIZE });
  const [unsubShown, setUnsubShown] = useState(PAGE_SIZE);
  const [justResolved, setJustResolved] = useState<Record<string, "unsubscribed" | "failed" | "dismissed">>({});
  const autoScanFired = useRef(false);

  useEffect(() => {
    if (autoScanFired.current) return;
    autoScanFired.current = true;

    api
      .inboxReview()
      .then(setReview)
      .finally(() => scan());
  }, []);

  useEffect(() => {
    function onScanRequested() {
      scan();
    }
    window.addEventListener("friday:scan-inbox", onScanRequested);
    return () => window.removeEventListener("friday:scan-inbox", onScanRequested);
  }, []);

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const result = await api.scanInbox();
      setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  function flashResolved(id: string, status: "unsubscribed" | "failed" | "dismissed") {
    setJustResolved((prev) => ({ ...prev, [id]: status }));
    setTimeout(() => {
      setJustResolved((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setReview((prev) => ({
        ...prev,
        unsubscribeCandidates: prev.unsubscribeCandidates.filter((c) => c.id !== id || c.status === "pending"),
      }));
    }, 2200);
  }

  async function unsubscribe(id: string) {
    const { candidate } = await api.approveUnsubscribe(id);
    setReview((prev) => ({
      ...prev,
      unsubscribeCandidates: prev.unsubscribeCandidates.map((c) => (c.id === id ? { ...c, ...candidate } : c)),
    }));
    flashResolved(id, candidate.status === "unsubscribed" ? "unsubscribed" : "failed");
  }

  async function keep(id: string) {
    await api.dismissUnsubscribe(id);
    setReview((prev) => ({
      ...prev,
      unsubscribeCandidates: prev.unsubscribeCandidates.map((c) => (c.id === id ? { ...c, status: "dismissed" } : c)),
    }));
    flashResolved(id, "dismissed");
  }

  function flashTravel(id: string, status: "added" | "failed" | "skipped") {
    setTravelResolved((prev) => ({ ...prev, [id]: status }));
    setTimeout(() => {
      setTravelResolved((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setReview((prev) => ({
        ...prev,
        travelCandidates: prev.travelCandidates.filter((c) => c.id !== id || c.status === "pending"),
      }));
    }, 2200);
  }

  async function addToCalendar(id: string) {
    setTravelError(null);
    try {
      const { candidate } = await api.approveTravel(id);
      setReview((prev) => ({
        ...prev,
        travelCandidates: prev.travelCandidates.map((c) => (c.id === id ? { ...c, ...candidate } : c)),
      }));
      flashTravel(id, candidate.status === "added" ? "added" : "failed");
    } catch (err) {
      setTravelError(err instanceof Error ? err.message : "Couldn't add that to your calendar.");
    }
  }

  async function skipTravelItem(id: string) {
    await api.skipTravel(id);
    setReview((prev) => ({
      ...prev,
      travelCandidates: prev.travelCandidates.map((c) => (c.id === id ? { ...c, status: "skipped" } : c)),
    }));
    flashTravel(id, "skipped");
  }

  async function markRead(id: string) {
    setReview((prev) => ({
      ...prev,
      people: prev.people.filter((m) => m.id !== id),
      orders: prev.orders.filter((m) => m.id !== id),
      other: prev.other.filter((m) => m.id !== id),
    }));
    await api.markItemRead(id);
  }

  async function markSpam(id: string) {
    setReview((prev) => ({
      ...prev,
      people: prev.people.filter((m) => m.id !== id),
      orders: prev.orders.filter((m) => m.id !== id),
      other: prev.other.filter((m) => m.id !== id),
    }));
    await api.markItemSpam(id);
  }

  const counts = {
    people: review.people.length,
    orders: review.orders.length,
    other: review.other.length,
    unsub: review.unsubscribeCandidates.filter((c) => c.status === "pending" || justResolved[c.id]).length,
    travel: review.travelCandidates.filter((c) => c.status === "pending" || travelResolved[c.id]).length,
  };

  const activeItems = review[activeTab];
  const visible = activeItems.slice(0, shown[activeTab]);
  const remaining = activeItems.length - visible.length;

  const pendingUnsub = review.unsubscribeCandidates.filter((c) => c.status === "pending" || justResolved[c.id]);
  const visibleUnsub = pendingUnsub.slice(0, unsubShown);
  const remainingUnsub = pendingUnsub.length - visibleUnsub.length;

  const pendingTravel = review.travelCandidates.filter((c) => c.status === "pending" || travelResolved[c.id]);
  const visibleTravel = pendingTravel.slice(0, travelShown);
  const remainingTravel = pendingTravel.length - visibleTravel.length;

  return (
    <div id="inbox" className="glass flex h-full flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink"
        >
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} className="inline-block">
            ▾
          </motion.span>
          Inbox
        </button>
        <button
          onClick={scan}
          disabled={scanning}
          className="rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Scan Inbox"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {collapsed ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-faint">
          <span>People: {counts.people}</span>
          <span>Orders: {counts.orders}</span>
          <span>Other: {counts.other}</span>
          <span>Unsubscribe: {counts.unsub}</span>
          <span>Travel found: {counts.travel}</span>
        </div>
      ) : (
        <>
          {review.scannedAt && (
            <p className="text-xs text-ink-faint">
              Scanned {review.stats.scanned}, cleaned up {review.stats.markedRead} pieces of noise.
            </p>
          )}
          {!review.scannedAt && !error && (
            <p className="text-sm text-ink-faint">
              Run a scan and I'll sort what's left into people, orders, and everything else.
            </p>
          )}

          <div className="flex gap-1 border-b border-white/10 pb-2 text-xs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-2.5 py-1 transition ${
                  activeTab === tab.key
                    ? "bg-cyan/15 text-cyan"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visible.length === 0 && (
              <p className="text-sm text-ink-faint">Nothing here, Boss.</p>
            )}
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <EmailRow
                  key={item.id}
                  item={item}
                  onRead={() => markRead(item.id)}
                  onSpam={activeTab !== "people" ? () => markSpam(item.id) : undefined}
                />
              ))}
            </AnimatePresence>
            {remaining > 0 && (
              <button
                onClick={() => setShown((s) => ({ ...s, [activeTab]: s[activeTab] + PAGE_SIZE }))}
                className="text-xs text-ink-faint transition hover:text-cyan"
              >
                Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} left)
              </button>
            )}
          </div>

          {counts.unsub > 0 && (
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() => setUnsubCollapsed((v) => !v)}
                className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-faint hover:text-ink"
              >
                <motion.span animate={{ rotate: unsubCollapsed ? -90 : 0 }} className="inline-block">
                  ▾
                </motion.span>
                Unsubscribe candidates ({counts.unsub})
              </button>

              {!unsubCollapsed && (
                <div className="mt-2 space-y-2">
                  <AnimatePresence initial={false}>
                    {visibleUnsub.map((item) => (
                      <UnsubRow
                        key={item.id}
                        item={item}
                        resolved={justResolved[item.id]}
                        onUnsubscribe={() => unsubscribe(item.id)}
                        onKeep={() => keep(item.id)}
                      />
                    ))}
                  </AnimatePresence>
                  {remainingUnsub > 0 && (
                    <button
                      onClick={() => setUnsubShown((n) => n + PAGE_SIZE)}
                      className="text-xs text-ink-faint transition hover:text-cyan"
                    >
                      Show {Math.min(remainingUnsub, PAGE_SIZE)} more ({remainingUnsub} left)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {travelError && <p className="text-sm text-red-400">{travelError}</p>}

          {counts.travel > 0 && (
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() => setTravelCollapsed((v) => !v)}
                className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-faint hover:text-ink"
              >
                <motion.span animate={{ rotate: travelCollapsed ? -90 : 0 }} className="inline-block">
                  ▾
                </motion.span>
                Travel found ({counts.travel})
              </button>

              {!travelCollapsed && (
                <div className="mt-2 space-y-2">
                  <AnimatePresence initial={false}>
                    {visibleTravel.map((item) => (
                      <TravelRow
                        key={item.id}
                        item={item}
                        resolved={travelResolved[item.id]}
                        onAdd={() => addToCalendar(item.id)}
                        onSkip={() => skipTravelItem(item.id)}
                      />
                    ))}
                  </AnimatePresence>
                  {remainingTravel > 0 && (
                    <button
                      onClick={() => setTravelShown((n) => n + PAGE_SIZE)}
                      className="text-xs text-ink-faint transition hover:text-cyan"
                    >
                      Show {Math.min(remainingTravel, PAGE_SIZE)} more ({remainingTravel} left)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmailRow({
  item,
  onRead,
  onSpam,
}: {
  item: EmailSummary;
  onRead: () => void;
  onSpam?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <a
          href={item.gmailUrl}
          target="_blank"
          rel="noreferrer"
          onClick={onRead}
          className="block truncate text-sm text-ink hover:text-cyan hover:underline"
        >
          {item.subject}
        </a>
        <p className="truncate text-xs text-ink-faint">{item.from}</p>
      </div>
      <button
        onClick={onRead}
        className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-cyan"
        title="Mark as read"
      >
        Read
      </button>
      {onSpam && (
        <button
          onClick={onSpam}
          className="shrink-0 rounded-md bg-red-400/15 px-2 py-1 text-xs text-red-400 transition hover:bg-red-400/25"
          title="Mark as spam"
        >
          Spam
        </button>
      )}
    </motion.div>
  );
}

function TravelRow({
  item,
  resolved,
  onAdd,
  onSkip,
}: {
  item: TravelCandidate;
  resolved?: "added" | "failed" | "skipped";
  onAdd: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <a
          href={item.gmailUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-ink hover:text-cyan hover:underline"
        >
          {item.title}
        </a>
        <p className="truncate text-xs text-ink-faint">
          {item.date.slice(0, 10)}
          {item.location ? ` · ${item.location}` : ""}
        </p>
      </div>
      {resolved ? (
        <span
          className={`shrink-0 text-xs ${
            resolved === "added" ? "text-cyan" : resolved === "skipped" ? "text-ink-faint" : "text-red-400"
          }`}
        >
          {resolved === "added" && "✓ Added to calendar"}
          {resolved === "skipped" && "Skipped"}
          {resolved === "failed" && "Couldn't add"}
        </span>
      ) : (
        <>
          <button
            onClick={onAdd}
            className="shrink-0 rounded-md bg-cyan/15 px-2 py-1 text-xs text-cyan transition hover:bg-cyan/25"
          >
            Add to Calendar
          </button>
          <button
            onClick={onSkip}
            className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-ink"
          >
            Skip
          </button>
        </>
      )}
    </motion.div>
  );
}

function UnsubRow({
  item,
  resolved,
  onUnsubscribe,
  onKeep,
}: {
  item: UnsubscribeCandidate;
  resolved?: "unsubscribed" | "failed" | "dismissed";
  onUnsubscribe: () => void;
  onKeep: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <a
          href={item.gmailUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-ink hover:text-cyan hover:underline"
        >
          {item.subject}
        </a>
        <p className="truncate text-xs text-ink-faint">{item.from}</p>
      </div>
      {resolved ? (
        <span
          className={`shrink-0 text-xs ${
            resolved === "unsubscribed" ? "text-cyan" : resolved === "dismissed" ? "text-ink-faint" : "text-red-400"
          }`}
        >
          {resolved === "unsubscribed" && "✓ Unsubscribed"}
          {resolved === "dismissed" && "Kept"}
          {resolved === "failed" && "Couldn't confirm"}
        </span>
      ) : (
        <>
          <button
            onClick={onUnsubscribe}
            className="shrink-0 rounded-md bg-red-400/15 px-2 py-1 text-xs text-red-400 transition hover:bg-red-400/25"
          >
            Unsubscribe
          </button>
          <button
            onClick={onKeep}
            className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs text-ink-faint transition hover:text-ink"
          >
            Keep
          </button>
        </>
      )}
    </motion.div>
  );
}
