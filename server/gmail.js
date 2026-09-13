import { google } from "googleapis";

const HEADER_NAMES = ["From", "Subject", "List-Unsubscribe", "List-Unsubscribe-Post", "Date"];

function getHeader(message, name) {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

// List-Unsubscribe looks like: "<https://.../unsub?x=1>, <mailto:unsub@x.com>"
// We only act on the http(s) form (one click, no extra scope needed) — a
// mailto-only sender is left for the user to unsubscribe from manually.
function extractUnsubscribeUrl(headerValue) {
  if (!headerValue) return null;
  const match = headerValue.match(/<(https?:\/\/[^>]+)>/i);
  return match ? match[1] : null;
}

export async function fetchInboxMessages(authClient, maxResults = 25) {
  const gmail = google.gmail({ version: "v1", auth: authClient });

  const { data: list } = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX", "UNREAD"],
    maxResults,
  });

  const ids = (list.messages || []).map((m) => m.id);
  const messages = await Promise.all(
    ids.map((id) =>
      gmail.users.messages
        .get({ userId: "me", id, format: "metadata", metadataHeaders: HEADER_NAMES })
        .then((r) => r.data),
    ),
  );

  return messages.map((message) => ({
    id: message.id,
    threadId: message.threadId,
    from: getHeader(message, "From"),
    subject: getHeader(message, "Subject") || "(no subject)",
    snippet: message.snippet || "",
    date: getHeader(message, "Date"),
    unsubscribeUrl: extractUnsubscribeUrl(getHeader(message, "List-Unsubscribe")),
    // RFC 8058: senders that support true one-click unsubscribe advertise it
    // with this exact header, and expect a POST with this exact body — a
    // plain GET to the same URL often just loads a "click to confirm" page
    // that a server-side request can't complete.
    unsubscribeOneClick: getHeader(message, "List-Unsubscribe-Post") === "List-Unsubscribe=One-Click",
  }));
}

export async function markAsRead(authClient, messageId) {
  const gmail = google.gmail({ version: "v1", auth: authClient });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

export async function markAsSpam(authClient, messageId) {
  const gmail = google.gmail({ version: "v1", auth: authClient });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX", "UNREAD"] },
  });
}

// Gmail's web UI deep-links by thread, not by individual message id — linking
// by message id silently loads the inbox with nothing selected. The account
// slot (/u/0/, /u/1/...) is specific to whatever order accounts were signed
// into in THAT browser, which we have no way to know — `authuser=<email>`
// is Google's account-agnostic way to target a specific account instead.
export function gmailUrl(threadId, email) {
  const base = email
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`
    : "https://mail.google.com/mail/u/0/";
  return `${base}#inbox/${threadId}`;
}

// Fires the sender's unsubscribe link. This is a real request to a
// third-party endpoint, so it should only ever be called after the user has
// explicitly approved that specific item in the review queue — never automatically.
export async function fireUnsubscribe(url, oneClick) {
  const res = oneClick
    ? await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
        redirect: "follow",
      })
    : await fetch(url, { method: "GET", redirect: "follow" });
  return res.ok;
}
