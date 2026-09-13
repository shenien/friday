import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./store.js";

const FILE = "notes.json";

export async function listNotes() {
  const data = await readJson(FILE, { notes: [] });
  return data.notes;
}

export async function addNote({ text }) {
  const data = await readJson(FILE, { notes: [] });
  const note = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
  };
  data.notes.push(note);
  await writeJson(FILE, data);
  return note;
}

export async function deleteNote(id) {
  const data = await readJson(FILE, { notes: [] });
  const next = data.notes.filter((n) => n.id !== id);
  const removed = next.length !== data.notes.length;
  data.notes = next;
  await writeJson(FILE, data);
  return removed;
}
