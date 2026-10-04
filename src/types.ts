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

export type TriageBucket = "reply" | "action" | "updates" | "newsletter" | "noise";

export interface TriageItem {
  threadId: string;
  lastMessageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string;
  ageDays: number;
  unread: boolean;
  messageCount: number;
  snippet: string;
  bucket: TriageBucket;
  urgency: "high" | "normal" | "low";
  reason: string;
  nextStep: string;
  due: string | null;
  vip: boolean;
  gmailUrl: string;
  canUnsubscribe: boolean;
  unsubscribedAt: string | null;
  dismissed: boolean;
}

export interface TriageState {
  generatedAt: string | null;
  windowDays: number;
  stats: { threads: number; handled: number };
  items: TriageItem[];
}

export interface JobStatus {
  running: boolean;
  phase: string | null;
  done: number;
  total: number;
  error: { code: "reauth" | "failed"; message: string } | null;
}

export type SenderRule = "vip" | "mute";

export interface SenderStat {
  email: string;
  domain: string;
  name: string;
  count: number;
  perMonth: number;
  unread: number;
  kind: "person" | "newsletter" | "automated";
  lastDate: string;
  recentSubjects: string[];
  canUnsubscribe: boolean;
  highVolume: boolean;
  unsubscribedAt: string | null;
}

export interface SenderStats {
  generatedAt: string | null;
  windowDays: number;
  sampled: number;
  spanDays: number;
  totals: {
    messages: number;
    uniqueSenders: number;
    unread: number;
    automatedShare: number;
    topTenShare: number;
  } | null;
  senders: SenderStat[];
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
