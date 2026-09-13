import { readJson, writeJson } from "./store.js";
import { fetchInboxMessages, markAsRead, markAsSpam, fireUnsubscribe, gmailUrl } from "./gmail.js";
import { getConnectedEmail } from "./google.js";
import { classifyMessages } from "./classifyInbox.js";
import { extractTravel } from "./travelExtract.js";

const FILE = "inbox-review.json";

const EMPTY_REVIEW = {
  scannedAt: null,
  stats: { scanned: 0, human: 0, markedRead: 0 },
  people: [],
  orders: [],
  other: [],
  unsubscribeCandidates: [],
  travelCandidates: [],
};

function mergeById(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

export async function getReview() {
  return readJson(FILE, EMPTY_REVIEW);
}

export async function runScan(authClient, anthropic, model) {
  const existing = await readJson(FILE, EMPTY_REVIEW);
  const email = await getConnectedEmail();
  const messages = await fetchInboxMessages(authClient);
  const classifications = await classifyMessages(anthropic, model, messages);
  const categoryById = new Map(classifications.map((c) => [c.id, c.category]));

  const newPeople = [];
  const newOrders = [];
  const newOrderMessages = [];
  const newOther = [];
  const newUnsubscribeCandidates = [];
  let human = 0;
  let markedRead = 0;

  for (const message of messages) {
    const category = categoryById.get(message.id) || "other_automated";
    const summary = {
      id: message.id,
      from: message.from,
      subject: message.subject,
      date: message.date,
      gmailUrl: gmailUrl(message.threadId, email),
    };

    if (category === "human") {
      // Never modified — just surfaced for visibility, same as the user
      // would see it in Gmail directly.
      human += 1;
      newPeople.push(summary);
      continue;
    }

    if (category === "orders_deliveries" || category === "important_other") {
      // Left unread on purpose — still needs the user's attention. Only
      // cleared when they act on it (mark read / spam) from the review queue.
      if (category === "orders_deliveries") {
        newOrders.push(summary);
        newOrderMessages.push(message);
      } else {
        newOther.push(summary);
      }
      continue;
    }

    await markAsRead(authClient, message.id);
    markedRead += 1;

    if (category === "marketing_or_political" && message.unsubscribeUrl) {
      newUnsubscribeCandidates.push({
        ...summary,
        unsubscribeUrl: message.unsubscribeUrl,
        unsubscribeOneClick: message.unsubscribeOneClick,
        status: "pending",
      });
    }
  }

  let newTravelCandidates = [];
  if (newOrderMessages.length > 0) {
    const travel = await extractTravel(anthropic, model, newOrderMessages);
    const summaryById = new Map(newOrders.map((s) => [s.id, s]));
    newTravelCandidates = travel
      .filter((t) => summaryById.has(t.id))
      .map((t) => ({
        ...summaryById.get(t.id),
        title: t.title || summaryById.get(t.id).subject,
        date: t.date,
        endDate: t.endDate || null,
        location: t.location || null,
        status: "pending",
      }));
  }

  const review = {
    scannedAt: new Date().toISOString(),
    stats: { scanned: messages.length, human, markedRead },
    people: mergeById(existing.people, newPeople),
    orders: mergeById(existing.orders, newOrders),
    other: mergeById(existing.other, newOther),
    unsubscribeCandidates: mergeById(
      existing.unsubscribeCandidates.filter((c) => c.status === "pending"),
      newUnsubscribeCandidates,
    ),
    travelCandidates: mergeById(
      (existing.travelCandidates || []).filter((c) => c.status === "pending"),
      newTravelCandidates,
    ),
  };
  await writeJson(FILE, review);
  return review;
}

export async function approveUnsubscribe(id) {
  const review = await readJson(FILE, EMPTY_REVIEW);
  const candidate = review.unsubscribeCandidates.find((c) => c.id === id);
  if (!candidate) throw new Error("Candidate not found.");

  const ok = await fireUnsubscribe(candidate.unsubscribeUrl, candidate.unsubscribeOneClick);
  candidate.status = ok ? "unsubscribed" : "failed";
  await writeJson(FILE, review);
  return candidate;
}

export async function dismissCandidate(id) {
  const review = await readJson(FILE, EMPTY_REVIEW);
  const candidate = review.unsubscribeCandidates.find((c) => c.id === id);
  if (!candidate) throw new Error("Candidate not found.");

  candidate.status = "dismissed";
  await writeJson(FILE, review);
  return candidate;
}

export async function approveTravel(authClient, createEvent, id) {
  const review = await readJson(FILE, EMPTY_REVIEW);
  const candidate = review.travelCandidates.find((c) => c.id === id);
  if (!candidate) throw new Error("Travel candidate not found.");

  try {
    await createEvent(authClient, {
      title: candidate.title,
      date: candidate.date,
      endDate: candidate.endDate,
      location: candidate.location,
    });
    candidate.status = "added";
  } catch (err) {
    candidate.status = "failed";
    if (String(err.message || "").toLowerCase().includes("insufficient")) {
      throw new Error("Calendar write access isn't granted yet — reconnect Google to approve travel events.");
    }
  }
  await writeJson(FILE, review);
  return candidate;
}

export async function skipTravel(id) {
  const review = await readJson(FILE, EMPTY_REVIEW);
  const candidate = review.travelCandidates.find((c) => c.id === id);
  if (!candidate) throw new Error("Travel candidate not found.");
  candidate.status = "skipped";
  await writeJson(FILE, review);
  return candidate;
}

const LISTS = ["people", "orders", "other"];

function removeFromLists(review, id) {
  for (const key of LISTS) {
    review[key] = review[key].filter((m) => m.id !== id);
  }
}

export async function markItemRead(authClient, id) {
  await markAsRead(authClient, id);
  const review = await readJson(FILE, EMPTY_REVIEW);
  removeFromLists(review, id);
  await writeJson(FILE, review);
  return review;
}

export async function markItemSpam(authClient, id) {
  await markAsSpam(authClient, id);
  const review = await readJson(FILE, EMPTY_REVIEW);
  removeFromLists(review, id);
  await writeJson(FILE, review);
  return review;
}
