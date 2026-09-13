export type Priority = "low" | "normal" | "high";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  recurrence: Recurrence;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  gmailUrl: string;
}

export interface UnsubscribeCandidate extends EmailSummary {
  unsubscribeUrl: string;
  status: "pending" | "unsubscribed" | "dismissed" | "failed";
}

export interface TravelCandidate extends EmailSummary {
  title: string;
  date: string;
  endDate: string | null;
  location: string | null;
  status: "pending" | "added" | "skipped" | "failed";
}

export interface InboxReview {
  scannedAt: string | null;
  stats: { scanned: number; human: number; markedRead: number };
  people: EmailSummary[];
  orders: EmailSummary[];
  other: EmailSummary[];
  unsubscribeCandidates: UnsubscribeCandidate[];
  travelCandidates: TravelCandidate[];
}
