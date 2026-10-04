import type {
  CalendarEvent,
  ChatMessage,
  InboxReview,
  JobStatus,
  Note,
  SenderRule,
  SenderStats,
  Task,
  TravelCandidate,
  TriageBucket,
  TriageState,
  UnsubscribeCandidate,
} from "../types";

export interface PackingList {
  generatedAt: string;
  items: { text: string; checked: boolean }[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listTasks: () => fetch("/api/tasks").then((r) => json<{ tasks: Task[] }>(r)),

  addTask: (input: { text: string; priority: Task["priority"]; dueDate: string | null }) =>
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<{ task: Task }>(r)),

  updateTask: (
    id: string,
    patch: Partial<Pick<Task, "done" | "text" | "priority" | "dueDate" | "recurrence">>,
  ) =>
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<{ task: Task }>(r)),

  deleteTask: (id: string) =>
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  listNotes: () => fetch("/api/notes").then((r) => json<{ notes: Note[] }>(r)),

  addNote: (text: string) =>
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => json<{ note: Note }>(r)),

  deleteNote: (id: string) =>
    fetch(`/api/notes/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  capture: (text: string) =>
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => json<{ type: "task"; task: Task } | { type: "note"; note: Note }>(r)),

  googleStatus: () =>
    fetch("/api/auth/google/status").then((r) =>
      json<{ configured: boolean; connected: boolean; email?: string }>(r),
    ),

  googleDisconnect: () =>
    fetch("/api/auth/google/disconnect", { method: "POST" }).then((r) => json<{ ok: true }>(r)),

  agenda: () => fetch("/api/calendar/agenda").then((r) => json<{ events: CalendarEvent[] }>(r)),

  inboxReview: () => fetch("/api/gmail/review").then((r) => json<InboxReview>(r)),

  scanInbox: () => fetch("/api/gmail/scan", { method: "POST" }).then((r) => json<InboxReview>(r)),

  approveUnsubscribe: (id: string) =>
    fetch(`/api/gmail/unsubscribe/${id}`, { method: "POST" }).then((r) =>
      json<{ candidate: UnsubscribeCandidate }>(r),
    ),

  dismissUnsubscribe: (id: string) =>
    fetch(`/api/gmail/dismiss/${id}`, { method: "POST" }).then((r) =>
      json<{ candidate: UnsubscribeCandidate }>(r),
    ),

  markItemRead: (id: string) =>
    fetch(`/api/gmail/item/${id}/read`, { method: "POST" }).then((r) => json<InboxReview>(r)),

  markItemSpam: (id: string) =>
    fetch(`/api/gmail/item/${id}/spam`, { method: "POST" }).then((r) => json<InboxReview>(r)),

  listFacts: () => fetch("/api/memory").then((r) => json<{ facts: string[] }>(r)),

  addFact: (fact: string) =>
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    }).then((r) => json<{ facts: string[] }>(r)),

  removeFact: (index: number) =>
    fetch(`/api/memory/${index}`, { method: "DELETE" }).then((r) => json<{ facts: string[] }>(r)),

  getTriage: () => fetch("/api/triage").then((r) => json<{ state: TriageState; job: JobStatus }>(r)),

  runTriage: () => fetch("/api/triage/run", { method: "POST" }).then((r) => json<{ job: JobStatus }>(r)),

  dismissTriage: (threadId: string, messageId: string) =>
    fetch("/api/triage/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, messageId }),
    }).then((r) => json<{ state: TriageState }>(r)),

  markThreadRead: (threadId: string) =>
    fetch(`/api/triage/thread/${threadId}/read`, { method: "POST" }).then((r) => json<{ state: TriageState }>(r)),

  markThreadSpam: (threadId: string) =>
    fetch(`/api/triage/thread/${threadId}/spam`, { method: "POST" }).then((r) => json<{ state: TriageState }>(r)),

  markBucketRead: (bucket: TriageBucket) =>
    fetch(`/api/triage/bucket/${bucket}/read`, { method: "POST" }).then((r) =>
      json<{ state: TriageState; marked: number }>(r),
    ),

  unsubscribeThread: (threadId: string) =>
    fetch(`/api/triage/thread/${threadId}/unsubscribe`, { method: "POST" }).then((r) =>
      json<{ ok: boolean; state: TriageState }>(r),
    ),

  getSenders: () =>
    fetch("/api/senders").then((r) =>
      json<{ stats: SenderStats; rules: Record<string, SenderRule>; job: JobStatus }>(r),
    ),

  analyzeSenders: () => fetch("/api/senders/analyze", { method: "POST" }).then((r) => json<{ job: JobStatus }>(r)),

  setSenderRule: (email: string, rule: SenderRule | null) =>
    fetch("/api/senders/rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, rule }),
    }).then((r) => json<{ rules: Record<string, SenderRule> }>(r)),

  unsubscribeSender: (email: string) =>
    fetch("/api/senders/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then((r) => json<{ ok: boolean }>(r)),

  approveTravel: (id: string) =>
    fetch(`/api/gmail/travel/${id}/approve`, { method: "POST" }).then((r) =>
      json<{ candidate: TravelCandidate }>(r),
    ),

  skipTravel: (id: string) =>
    fetch(`/api/gmail/travel/${id}/skip`, { method: "POST" }).then((r) =>
      json<{ candidate: TravelCandidate }>(r),
    ),

  getPackingList: (eventId: string) =>
    fetch(`/api/trips/${eventId}/packing`).then((r) => json<{ list: PackingList | null }>(r)),

  generatePackingList: (eventId: string, input: { title: string; nights: number; location: string | null; weatherSummary?: string }) =>
    fetch(`/api/trips/${eventId}/packing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<{ list: PackingList }>(r)),

  toggleItem: (eventId: string, index: number, checked: boolean) =>
    fetch(`/api/trips/${eventId}/packing/${index}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    }).then((r) => json<{ list: PackingList }>(r)),

  chat: (messages: ChatMessage[]) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }).then((r) => json<{ reply: string }>(r)),
};
