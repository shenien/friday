import { google } from "googleapis";
import { withBackoff, gmailBudget } from "./throttle.js";

const META_HEADERS = [
  "From",
  "Subject",
  "Date",
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
  "Precedence",
  "Auto-Submitted",
];

// Real people don't send from addresses like these, or from mail-platform
// subdomains like e.brand.com / email.brand.com / notify.bank.com.
const SYSTEM_LOCAL = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?|notify|alerts?|mailer|bounce|billing|statements?|receipts?|automated|digest|newsletter)/i;
const SYSTEM_HOST = /^(e|em|email|mail|mailer|notify|notifications?|news|updates?|alerts?|send|mg|mc|go|click|s|t)./i;

function header(message, name) {
  return message?.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

export function parseAddress(raw) {
  if (!raw) return { name: "", email: "" };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

function unsubscribeUrl(value) {
  const m = value?.match(/<(https?:\/\/[^>]+)>/i);
  return m ? m[1] : null;
}

function gmailCategory(labelIds = []) {
  const hit = labelIds.find((l) => l.startsWith("CATEGORY_"));
  return hit ? hit.replace("CATEGORY_", "").toLowerCase() : null;
}

// Bulk/automated senders announce themselves in headers far more reliably
// than any content heuristic can.
function looksAutomated(message, from) {
  const precedence = header(message, "Precedence") || "";
  const autoSubmitted = header(message, "Auto-Submitted") || "";
  return Boolean(
    header(message, "List-Unsubscribe") ||
      /bulk|list|junk/i.test(precedence) ||
      (autoSubmitted && autoSubmitted.toLowerCase() !== "no") ||
      SYSTEM_LOCAL.test(from.email.split("@")[0]) ||
      SYSTEM_HOST.test(from.email.split("@")[1] || ""),
  );
}

function gmailClient(auth) {
  return google.gmail({ version: "v1", auth });
}

export async function listThreadIds(auth, query, max) {
  const gmail = gmailClient(auth);
  const ids = [];
  let pageToken;
  do {
    const { data } = await withBackoff(async () => {
      await gmailBudget(10);
      return gmail.users.threads.list({
        userId: "me",
        q: query,
        maxResults: Math.min(100, max - ids.length),
        pageToken,
      });
    });
    ids.push(...(data.threads || []).map((t) => t.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export async function listMessageIds(auth, query, max) {
  const gmail = gmailClient(auth);
  const ids = [];
  let pageToken;
  do {
    const { data } = await withBackoff(async () => {
      await gmailBudget(5);
      return gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(100, max - ids.length),
        pageToken,
      });
    });
    ids.push(...(data.messages || []).map((m) => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

// One thread distilled to what triage needs: who spoke last, whether it was
// the user (then nothing is owed), and the signals that mark bulk mail.
export async function getThreadSummary(auth, threadId, myEmail) {
  const { data } = await withBackoff(async () => {
    await gmailBudget(10);
    return gmailClient(auth).users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: META_HEADERS,
    });
  });
  const messages = data.messages || [];
  const last = messages[messages.length - 1];
  if (!last) return null;

  const from = parseAddress(header(last, "From"));
  const labels = last.labelIds || [];
  return {
    threadId,
    lastMessageId: last.id,
    subject: header(last, "Subject") || "(no subject)",
    from,
    date: new Date(Number(last.internalDate)).toISOString(),
    messageCount: messages.length,
    unread: messages.some((m) => m.labelIds?.includes("UNREAD")),
    lastFromMe: labels.includes("SENT") || from.email === myEmail,
    iEverReplied: messages.some((m) => m.labelIds?.includes("SENT")),
    snippet: last.snippet || "",
    gmailCategory: gmailCategory(labels),
    automated: looksAutomated(last, from),
    unsubscribeUrl: unsubscribeUrl(header(last, "List-Unsubscribe")),
    unsubscribeOneClick: header(last, "List-Unsubscribe-Post") === "List-Unsubscribe=One-Click",
  };
}

export async function getMessageMeta(auth, messageId) {
  const { data } = await withBackoff(async () => {
    await gmailBudget(5);
    return gmailClient(auth).users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: META_HEADERS,
    });
  });
  const from = parseAddress(header(data, "From"));
  return {
    id: data.id,
    from,
    subject: header(data, "Subject") || "(no subject)",
    date: new Date(Number(data.internalDate)).toISOString(),
    unread: (data.labelIds || []).includes("UNREAD"),
    gmailCategory: gmailCategory(data.labelIds),
    automated: looksAutomated(data, from),
    unsubscribeUrl: unsubscribeUrl(header(data, "List-Unsubscribe")),
    unsubscribeOneClick: header(data, "List-Unsubscribe-Post") === "List-Unsubscribe=One-Click",
  };
}

export async function setThreadRead(auth, threadId) {
  await withBackoff(async () => {
    await gmailBudget(10);
    return gmailClient(auth).users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  });
}

export async function setThreadSpam(auth, threadId) {
  await withBackoff(async () => {
    await gmailBudget(10);
    return gmailClient(auth).users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX", "UNREAD"] },
    });
  });
}
