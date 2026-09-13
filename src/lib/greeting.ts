export interface GreetingLine {
  id: string;
  text: string;
  period: "morning" | "afternoon" | "evening";
}

// This is the fixed script Friday can say — kept small and static on purpose,
// so the voice clips only ever need to be generated once (see scripts/generate-voice.mjs).
export const GREETING_LINES: GreetingLine[] = [
  { id: "morning-1", text: "Good morning, Boss.", period: "morning" },
  { id: "morning-2", text: "Morning, Boss.", period: "morning" },
  { id: "afternoon-1", text: "Good afternoon, Boss.", period: "afternoon" },
  { id: "afternoon-2", text: "Hey, Boss.", period: "afternoon" },
  { id: "evening-1", text: "Good evening, Boss.", period: "evening" },
  { id: "evening-2", text: "Hey, Boss.", period: "evening" },
];

export function currentPeriod(date = new Date()): GreetingLine["period"] {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function pickGreeting(date = new Date()): GreetingLine {
  const period = currentPeriod(date);
  const candidates = GREETING_LINES.filter((line) => line.period === period);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
