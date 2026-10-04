import { readJson, writeJson } from "./store.js";
import { listMessageIds, getMessageMeta } from "./gmailThreads.js";
import { fireUnsubscribe } from "./gmail.js";
import { mapLimit } from "./throttle.js";

const STATS_FILE = "sender-stats.json";
const RULES_FILE = "sender-rules.json";
const EMPTY_STATS = { generatedAt: null, windowDays: 90, sampled: 0, spanDays: 0, totals: null, senders: [] };

let job = { running: false, phase: null, done: 0, total: 0, error: null };
let inFlight = null;

// ---- Rules: the user's standing instructions about specific senders ----

export async function getRules() {
  return readJson(RULES_FILE, {});
}

export async function setRule(email, rule) {
  const rules = await getRules();
  if (rule === "vip" || rule === "mute") rules[email] = rule;
  else delete rules[email];
  await writeJson(RULES_FILE, rules);
  return rules;
}

// ---- Analysis ----

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

export function aggregate(messages) {
  const bySender = new Map();
  for (const m of messages) {
    if (!m.from.email) continue;
    const s = bySender.get(m.from.email) || { email: m.from.email, msgs: [] };
    s.msgs.push(m);
    bySender.set(m.from.email, s);
  }

  const dates = messages.map((m) => new Date(m.date).getTime());
  const spanDays = Math.max(7, Math.round((Date.now() - Math.min(...dates)) / 86400000));

  const senders = [...bySender.values()].map(({ email, msgs }) => {
    msgs.sort((a, b) => b.date.localeCompare(a.date));
    const unread = msgs.filter((m) => m.unread).length;
    const automatedShare = msgs.filter((m) => m.automated).length / msgs.length;
    const automated = automatedShare >= 0.5;
    const withUnsub = msgs.find((m) => m.unsubscribeUrl);
    const category = mostCommon(msgs.map((m) => m.gmailCategory));
    const kind = !automated
      ? "person"
      : withUnsub || category === "promotions" || category === "forums"
        ? "newsletter"
        : "automated";
    return {
      email,
      domain: email.split("@")[1] || "",
      name: mostCommon(msgs.map((m) => m.from.name)) || email,
      count: msgs.length,
      perMonth: Math.round((msgs.length / spanDays) * 30),
      unread,
      kind,
      lastDate: msgs[0].date,
      recentSubjects: msgs.slice(0, 3).map((m) => m.subject),
      canUnsubscribe: Boolean(withUnsub),
      // Frequent bulk mail you could cut off at the source. (We can't tell
      // what you opened — the cleanup scan marks promotions read for you.)
      highVolume: kind !== "person" && Boolean(withUnsub) && Math.round((msgs.length / spanDays) * 30) >= 8,
      unsubscribedAt: null,
      _unsubscribeUrl: withUnsub?.unsubscribeUrl || null,
      _unsubscribeOneClick: withUnsub?.unsubscribeOneClick || false,
    };
  });

  senders.sort((a, b) => b.count - a.count);
  const total = messages.length;
  const automatedMessages = messages.filter((m) => m.automated).length;
  return {
    spanDays,
    totals: {
      messages: total,
      uniqueSenders: senders.length,
      unread: messages.filter((m) => m.unread).length,
      automatedShare: total ? automatedMessages / total : 0,
      topTenShare: total ? senders.slice(0, 10).reduce((n, s) => n + s.count, 0) / total : 0,
    },
    senders: senders.slice(0, 40),
  };
}

async function runAnalysis(auth, { days, max }) {
  job = { running: true, phase: "listing", done: 0, total: 0, error: null };
  const ids = await listMessageIds(auth, `newer_than:${days}d -in:sent -in:drafts -from:me`, max);
  job.phase = "reading";
  job.total = ids.length;

  let failed = 0;
  const messages = (
    await mapLimit(ids, 4, async (id) => {
      try {
        return await getMessageMeta(auth, id);
      } catch (err) {
        failed += 1;
        if (failed === 1) console.error("sender analysis: message fetch failed:", err?.message);
        return null;
      } finally {
        job.done += 1;
      }
    })
  ).filter(Boolean);
  if (ids.length > 0 && failed > ids.length * 0.3) throw new Error("Gmail kept refusing requests — try again in a minute.");

  const previous = await readJson(STATS_FILE, EMPTY_STATS);
  const unsubscribed = new Map(previous.senders.map((s) => [s.email, s.unsubscribedAt]));

  const result = aggregate(messages);
  for (const s of result.senders) s.unsubscribedAt = unsubscribed.get(s.email) || null;

  await writeJson(STATS_FILE, {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    sampled: messages.length,
    ...result,
  });
}

export function startAnalysis(auth, opts = {}) {
  if (inFlight) return job;
  const options = { days: 90, max: 600, ...opts };
  inFlight = runAnalysis(auth, options)
    .then(() => {
      job = { ...job, running: false, phase: "done" };
    })
    .catch((err) => {
      console.error("sender analysis failed:", err);
      job = { running: false, phase: "error", done: 0, total: 0, error: toJobError(err) };
    })
    .finally(() => {
      inFlight = null;
    });
  return job;
}

export function toJobError(err) {
  const message = String(err?.message || err);
  if (/invalid_grant/i.test(message)) {
    return { code: "reauth", message: "Google disconnected — reconnect to keep Friday working." };
  }
  if (/not connected/i.test(message)) {
    return { code: "reauth", message: "Google isn't connected yet." };
  }
  return { code: "failed", message };
}

function publicSender(s) {
  const { _unsubscribeUrl, _unsubscribeOneClick, ...rest } = s;
  return rest;
}

export async function getSenders() {
  const stats = await readJson(STATS_FILE, EMPTY_STATS);
  return {
    stats: { ...stats, senders: stats.senders.map(publicSender) },
    rules: await getRules(),
    job,
  };
}

// Only ever called from an explicit click on a specific sender.
export async function unsubscribeSender(email) {
  const stats = await readJson(STATS_FILE, EMPTY_STATS);
  const sender = stats.senders.find((s) => s.email === email);
  if (!sender?._unsubscribeUrl) throw new Error("No unsubscribe link on file for that sender.");

  const ok = await fireUnsubscribe(sender._unsubscribeUrl, sender._unsubscribeOneClick);
  if (ok) {
    sender.unsubscribedAt = new Date().toISOString();
    await writeJson(STATS_FILE, stats);
    await setRule(email, "mute");
  }
  return { ok, sender: publicSender(sender) };
}
