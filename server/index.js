import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import * as tasks from "./tasks.js";
import * as notes from "./notes.js";
import * as memory from "./memory.js";
import { classifyCapture } from "./capture.js";
import * as googleAuth from "./google.js";
import { getUpcomingEvents, createEvent } from "./calendar.js";
import * as inboxTriage from "./inboxTriage.js";
import * as tripPacking from "./tripPacking.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "../dist");

const app = express();
const PORT = process.env.PORT || 3003;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// In dev, Vite (not this server) serves the frontend on its own port — this
// server only sees /api/*. Post-OAuth redirects need to point back there
// explicitly, since a plain "/" would otherwise hit this server directly.
const CLIENT_ORIGIN = existsSync(DIST_DIR) ? "" : "http://localhost:5176";

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// --- Tasks ---

app.get("/api/tasks", async (_req, res) => {
  res.json({ tasks: await tasks.listTasks() });
});

app.post("/api/tasks", async (req, res) => {
  const { text, priority, dueDate } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing task text." });
  }
  const task = await tasks.addTask({ text, priority, dueDate });
  res.status(201).json({ task });
});

app.patch("/api/tasks/:id", async (req, res) => {
  const task = await tasks.updateTask(req.params.id, req.body || {});
  if (!task) return res.status(404).json({ error: "Task not found." });
  res.json({ task });
});

app.delete("/api/tasks/:id", async (req, res) => {
  const removed = await tasks.deleteTask(req.params.id);
  if (!removed) return res.status(404).json({ error: "Task not found." });
  res.json({ ok: true });
});

// --- Google auth (Gmail + Calendar) ---

app.get("/api/auth/google/status", async (_req, res) => {
  res.json(await googleAuth.getStatus());
});

app.get("/api/auth/google", (_req, res) => {
  try {
    res.redirect(googleAuth.getAuthUrl());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) throw new Error(String(error));
    await googleAuth.handleCallback(code);
    res.redirect(`${CLIENT_ORIGIN}/?google=connected`);
  } catch (err) {
    console.error("google auth callback failed:", err);
    res.redirect(`${CLIENT_ORIGIN}/?google=error`);
  }
});

app.post("/api/auth/google/disconnect", async (_req, res) => {
  await googleAuth.disconnect();
  res.json({ ok: true });
});

// --- Calendar ---

app.get("/api/calendar/agenda", async (_req, res) => {
  try {
    const client = await googleAuth.getAuthorizedClient();
    const events = await getUpcomingEvents(client);
    res.json({ events });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// --- Trip packing ---

app.get("/api/trips/:eventId/packing", async (req, res) => {
  res.json({ list: await tripPacking.getPackingList(req.params.eventId) });
});

app.post("/api/trips/:eventId/packing/generate", async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  try {
    const list = await tripPacking.generatePackingList(anthropic, MODEL, req.params.eventId, req.body || {});
    res.status(201).json({ list });
  } catch (err) {
    console.error("packing list generation failed:", err);
    res.status(500).json({ error: "Couldn't put a list together, Boss." });
  }
});

app.patch("/api/trips/:eventId/packing/:index", async (req, res) => {
  try {
    const list = await tripPacking.toggleItem(req.params.eventId, Number(req.params.index), Boolean(req.body?.checked));
    res.json({ list });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Calendar event creation (from detected travel confirmations) ---

app.post("/api/gmail/travel/:id/approve", async (req, res) => {
  try {
    const client = await googleAuth.getAuthorizedClient();
    res.json(await inboxTriage.approveTravel(client, createEvent, req.params.id));
  } catch (err) {
    console.error("travel approve failed:", err);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/gmail/travel/:id/skip", async (req, res) => {
  try {
    res.json(await inboxTriage.skipTravel(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Gmail triage ---

app.get("/api/gmail/review", async (_req, res) => {
  res.json(await inboxTriage.getReview());
});

app.post("/api/gmail/scan", async (_req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  try {
    const client = await googleAuth.getAuthorizedClient();
    const review = await inboxTriage.runScan(client, anthropic, MODEL);
    res.json(review);
  } catch (err) {
    console.error("gmail scan failed:", err);
    res.status(503).json({ error: err.message });
  }
});

app.post("/api/gmail/unsubscribe/:id", async (req, res) => {
  try {
    const candidate = await inboxTriage.approveUnsubscribe(req.params.id);
    res.json({ candidate });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/gmail/dismiss/:id", async (req, res) => {
  try {
    const candidate = await inboxTriage.dismissCandidate(req.params.id);
    res.json({ candidate });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/gmail/item/:id/read", async (req, res) => {
  try {
    const client = await googleAuth.getAuthorizedClient();
    res.json(await inboxTriage.markItemRead(client, req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/gmail/item/:id/spam", async (req, res) => {
  try {
    const client = await googleAuth.getAuthorizedClient();
    res.json(await inboxTriage.markItemSpam(client, req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Notes ---

app.get("/api/notes", async (_req, res) => {
  res.json({ notes: await notes.listNotes() });
});

app.post("/api/notes", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing note text." });
  }
  const note = await notes.addNote({ text });
  res.status(201).json({ note });
});

app.delete("/api/notes/:id", async (req, res) => {
  const removed = await notes.deleteNote(req.params.id);
  if (!removed) return res.status(404).json({ error: "Note not found." });
  res.json({ ok: true });
});

// --- Capture (auto-classify a brain dump into a task or a note) ---

app.post("/api/capture", async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text." });
  }

  try {
    const classified = await classifyCapture(anthropic, MODEL, text);
    if (classified.type === "task") {
      const task = await tasks.addTask({ text: classified.text, priority: classified.priority, dueDate: null });
      return res.status(201).json({ type: "task", task });
    }
    const note = await notes.addNote({ text: classified.text });
    res.status(201).json({ type: "note", note });
  } catch (err) {
    console.error("capture failed:", err);
    res.status(500).json({ error: "Couldn't make sense of that, Boss." });
  }
});

// --- Memory ---

app.get("/api/memory", async (_req, res) => {
  res.json({ facts: await memory.getFacts() });
});

app.post("/api/memory", async (req, res) => {
  const { fact } = req.body || {};
  if (!fact || typeof fact !== "string") {
    return res.status(400).json({ error: "Missing fact." });
  }
  res.status(201).json({ facts: await memory.addFacts([fact]) });
});

app.delete("/api/memory/:index", async (req, res) => {
  try {
    res.json({ facts: await memory.removeFact(Number(req.params.index)) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Chat ---

app.post("/api/chat", async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing messages." });
  }

  try {
    const facts = await memory.getFacts();
    const system =
      "You are Friday, modeled on FRIDAY from the Marvel films — Tony Stark's AI, now " +
      "this user's. Talk to them the way Friday talks to Tony: quick, casual, a little " +
      "wry, unfailingly competent, never stiff or corporate. Call them 'Boss'. Default " +
      "to short, direct replies — a sentence or two, not a briefing — unless the " +
      "question genuinely needs more. Skip the pleasantries and the disclaimers; get " +
      "straight to the useful part, the way an AI who's seen everything and is unfazed " +
      "by it would." +
      (facts.length
        ? `\n\nWhat you already know about the user, from past conversations:\n- ${facts.join("\n- ")}`
        : "");

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";
    res.json({ reply });

    const lastUser = messages[messages.length - 1];
    memory
      .extractFacts(anthropic, MODEL, lastUser.content, reply)
      .then((newFacts) => memory.addFacts(newFacts))
      .catch((err) => console.error("memory update failed:", err));
  } catch (err) {
    console.error("chat failed:", err);
    res.status(500).json({ error: "Failed to reach the reasoning core." });
  }
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Friday server listening on http://localhost:${PORT}`);
});
