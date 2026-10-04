import { readJson, writeJson } from "./store.js";
import { getConnectedEmail } from "./google.js";
import { getFacts } from "./memory.js";
import { gmailUrl, fireUnsubscribe } from "./gmail.js";
import { listThreadIds, getThreadSummary, setThreadRead, setThreadSpam } from "./gmailThreads.js";
import { getRules, setRule, toJobError } from "./senders.js";
import { mapLimit } from "./throttle.js";

const FILE = "triage.json";
const WINDOW_DAYS = 21;
const MAX_THREADS = 80;
const BATCH_SIZE = 20;
const BUCKETS = ["reply", "action", "updates", "newsletter", "noise"];
const BULK_READ_BUCKETS = ["updates", "newsletter", "noise"];

const EMPTY = {
  generatedAt: null,
  windowDays: WINDOW_DAYS,
  stats: { threads: 0, handled: 0 },
  items: [],
  dismissed: {},
};

let job = { running: false, phase: null, done: 0, total: 0, error: null };
let inFlight = null;

const TRIAGE_TOOL = {
  name: "record_triage",
  description: "Record the triage decision for every email thread provided.",
  input_schema: {
    type: "object",
    properties: {
      threads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The thread id exactly as given." },
            bucket: { type: "string", enum: BUCKETS },
            urgency: { type: "string", enum: ["high", "normal", "low"] },
            reason: { type: "string", description: "At most 14 words on why it landed in this bucket." },
            next_step: { type: "string", description: "reply/action only: a short imperative. Otherwise empty." },
            due: { type: "string", description: "YYYY-MM-DD if a specific deadline is stated, else empty." },
          },
          required: ["id", "bucket", "urgency", "reason"],
        },
      },
    },
    required: ["threads"],
  },
};

function systemPrompt(facts) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    `You are the user's chief of staff and email operations expert. Today is ${today}. ` +
    "Triage each email thread into exactly one bucket.\n\n" +
    "Buckets:\n" +
    "- reply: a real person is waiting on a written response from the user — a direct question, a request, " +
    "scheduling, an introduction, or a follow-up on something the user owes them. The thread's last message is from them.\n" +
    "- action: the user must DO something that isn't replying — pay or dispute a bill, sign/approve/confirm via a link, " +
    "RSVP, renew, verify a security alert, return or schedule something, meet a deadline. Automated mail counts when it " +
    "needs a concrete action.\n" +
    "- updates: worth knowing but needs nothing — order confirmations, shipping/delivery notices, receipts, statements, " +
    "calendar notices, and human mail that is purely FYI or a \"thanks\".\n" +
    "- newsletter: content the user subscribed to — digests, Substack/blog posts, product or industry newsletters.\n" +
    "- noise: promotions, sales, marketing, political or fundraising mail, social-network notifications, anything skippable.\n\n" +
    "Judging well:\n" +
    "- Be strict about reply and action: use them only when something is genuinely owed. A friendly human message that " +
    "asks nothing is \"updates\".\n" +
    "- A notice that a statement, document, or update is merely available to view (\"your statement is ready\", " +
    "\"3 new updates\") is \"updates\". Use \"action\" only when a payment, signature, verification, deadline, or " +
    "decision is actually required of the user.\n" +
    "- urgency: high = time-sensitive within about 2 days, a hard deadline, or clearly important to the user; " +
    "low = can wait weeks; otherwise normal.\n" +
    "- Resolve relative dates (\"by Friday\") against today when filling `due`.\n" +
    "- Senders marked VIP always matter: lean toward reply/action and high urgency when they are waiting on the user." +
    (facts.length ? `\n\nWhat you already know about the user:\n- ${facts.slice(0, 25).join("\n- ")}` : "")
  );
}

function decodeEntities(text) {
  return text
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function ageInDays(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function describeThread(t, rule) {
  const who = t.from.name ? `${t.from.name} <${t.from.email}>` : t.from.email;
  const context = [
    `${ageInDays(t.date)}d old`,
    `${t.messageCount} message${t.messageCount === 1 ? "" : "s"}`,
    t.unread ? "unread" : "read",
    `Gmail tab: ${t.gmailCategory || "primary/unknown"}`,
    `bulk/automated sender: ${t.automated ? "yes" : "no"}`,
    t.iEverReplied ? "user replied earlier in this thread" : null,
  ].filter(Boolean);
  return (
    `[${t.threadId}]\nFrom: ${who}${rule === "vip" ? "  (VIP)" : ""}\nSubject: ${t.subject}\n` +
    `Snippet: ${decodeEntities(t.snippet).slice(0, 240)}\nContext: ${context.join(" · ")}`
  );
}

export async function classifyBatch(anthropic, model, batch, rules, facts) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt(facts),
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "record_triage" },
    messages: [
      { role: "user", content: batch.map((t) => describeThread(t, rules[t.from.email])).join("\n\n") },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  return new Map((block?.input?.threads || []).map((d) => [d.id, d]));
}

function toItem(t, decision, rule, email) {
  const bucket = BUCKETS.includes(decision?.bucket) ? decision.bucket : "updates";
  let urgency = ["high", "normal", "low"].includes(decision?.urgency) ? decision.urgency : "normal";
  if (rule === "vip" && (bucket === "reply" || bucket === "action")) urgency = "high";
  const actionable = bucket === "reply" || bucket === "action";
  return {
    threadId: t.threadId,
    lastMessageId: t.lastMessageId,
    subject: t.subject,
    fromName: t.from.name || t.from.email,
    fromEmail: t.from.email,
    date: t.date,
    ageDays: ageInDays(t.date),
    unread: t.unread,
    messageCount: t.messageCount,
    snippet: decodeEntities(t.snippet),
    bucket,
    urgency,
    reason: decision?.reason || "",
    nextStep: actionable ? decision?.next_step || "" : "",
    due: /^\d{4}-\d{2}-\d{2}$/.test(decision?.due || "") ? decision.due : null,
    vip: rule === "vip",
    gmailUrl: gmailUrl(t.threadId, email),
    unsubscribeUrl: t.unsubscribeUrl,
    unsubscribeOneClick: t.unsubscribeOneClick,
    unsubscribedAt: null,
  };
}

async function runTriage(auth, anthropic, model) {
  job = { running: true, phase: "listing", done: 0, total: 0, error: null };
  const email = await getConnectedEmail();
  const ids = await listThreadIds(auth, `in:inbox newer_than:${WINDOW_DAYS}d`, MAX_THREADS);

  job.phase = "reading";
  job.total = ids.length;
  let failed = 0;
  const summaries = (
    await mapLimit(ids, 4, async (id) => {
      try {
        return await getThreadSummary(auth, id, email);
      } catch (err) {
        failed += 1;
        if (failed === 1) console.error("triage: thread fetch failed:", err?.message);
        return null;
      } finally {
        job.done += 1;
      }
    })
  ).filter(Boolean);
  if (ids.length > 0 && failed > ids.length * 0.3) throw new Error("Gmail kept refusing requests — try again in a minute.");

  // If the user spoke last, nothing is owed on this thread.
  const waiting = summaries.filter((t) => !t.lastFromMe);
  const handled = summaries.length - waiting.length;

  const rules = await getRules();
  const muted = waiting.filter((t) => rules[t.from.email] === "mute");
  const toClassify = waiting.filter((t) => rules[t.from.email] !== "mute");

  const batches = [];
  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) batches.push(toClassify.slice(i, i + BATCH_SIZE));

  job.phase = "classifying";
  job.done = 0;
  job.total = batches.length;
  const facts = await getFacts();
  const decisions = new Map();
  let failures = 0;
  await mapLimit(batches, 2, async (batch) => {
    try {
      for (const [id, d] of await classifyBatch(anthropic, model, batch, rules, facts)) decisions.set(id, d);
    } catch (err) {
      failures += 1;
      console.error("triage batch failed:", err);
    } finally {
      job.done += 1;
    }
  });
  if (batches.length > 0 && failures === batches.length) throw new Error("Couldn't reach the reasoning core.");

  const items = [
    ...toClassify.map((t) => toItem(t, decisions.get(t.threadId), rules[t.from.email], email)),
    ...muted.map((t) => toItem(t, { bucket: "noise", urgency: "low", reason: "Sender is muted." }, "mute", email)),
  ];

  const previous = await readJson(FILE, EMPTY);
  await writeJson(FILE, {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    stats: { threads: summaries.length, handled },
    items,
    dismissed: previous.dismissed || {},
  });
}

export function startTriage(auth, anthropic, model) {
  if (inFlight) return job;
  inFlight = runTriage(auth, anthropic, model)
    .then(() => {
      job = { ...job, running: false, phase: "done" };
    })
    .catch((err) => {
      console.error("triage failed:", err);
      job = { running: false, phase: "error", done: 0, total: 0, error: toJobError(err) };
    })
    .finally(() => {
      inFlight = null;
    });
  return job;
}

function publicState(state) {
  return {
    ...state,
    dismissed: undefined,
    items: state.items.map(({ unsubscribeUrl, unsubscribeOneClick, ...item }) => ({
      ...item,
      canUnsubscribe: Boolean(unsubscribeUrl) && !item.unsubscribedAt,
      dismissed: state.dismissed?.[item.threadId] === item.lastMessageId,
    })),
  };
}

export async function getTriage() {
  return { state: publicState(await readJson(FILE, EMPTY)), job };
}

// Hidden until a newer message lands in the thread.
export async function dismiss(threadId, messageId) {
  const state = await readJson(FILE, EMPTY);
  state.dismissed = { ...state.dismissed, [threadId]: messageId };
  await writeJson(FILE, state);
  return publicState(state);
}

export async function markThreadRead(auth, threadId) {
  await setThreadRead(auth, threadId);
  const state = await readJson(FILE, EMPTY);
  for (const item of state.items) if (item.threadId === threadId) item.unread = false;
  await writeJson(FILE, state);
  return publicState(state);
}

export async function markThreadSpam(auth, threadId) {
  await setThreadSpam(auth, threadId);
  const state = await readJson(FILE, EMPTY);
  state.items = state.items.filter((item) => item.threadId !== threadId);
  await writeJson(FILE, state);
  return publicState(state);
}

export async function markBucketRead(auth, bucket) {
  if (!BULK_READ_BUCKETS.includes(bucket)) throw new Error("That bucket can't be bulk-marked as read.");
  const state = await readJson(FILE, EMPTY);
  const targets = state.items.filter(
    (i) => i.bucket === bucket && i.unread && state.dismissed?.[i.threadId] !== i.lastMessageId,
  );
  await mapLimit(targets, 3, async (item) => {
    await setThreadRead(auth, item.threadId);
    item.unread = false;
  });
  await writeJson(FILE, state);
  return { state: publicState(state), marked: targets.length };
}

export async function unsubscribeThread(threadId) {
  const state = await readJson(FILE, EMPTY);
  const item = state.items.find((i) => i.threadId === threadId);
  if (!item?.unsubscribeUrl) throw new Error("No unsubscribe link on file for that email.");

  const ok = await fireUnsubscribe(item.unsubscribeUrl, item.unsubscribeOneClick);
  if (ok) {
    for (const i of state.items) if (i.fromEmail === item.fromEmail) i.unsubscribedAt = new Date().toISOString();
    await writeJson(FILE, state);
    await setRule(item.fromEmail, "mute");
  }
  return { ok, state: publicState(state) };
}
