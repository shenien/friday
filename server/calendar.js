import { google } from "googleapis";

// The user's personal calendar is mostly trips/vacations, not daily
// meetings — a "today" view is nearly always empty. Look ahead a month
// instead so it actually surfaces what's coming up.
export async function getUpcomingEvents(authClient, daysAhead = 30) {
  const calendar = google.calendar({ version: "v3", auth: authClient });

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return (data.items || [])
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: event.id,
      title: event.summary || "(untitled event)",
      start: event.start?.dateTime || event.start?.date || null,
      end: event.end?.dateTime || event.end?.date || null,
      allDay: !event.start?.dateTime,
      location: event.location || null,
    }));
}

// Creates a calendar event — used for travel confirmations detected in
// Gmail. Only ever called after the user explicitly approves a specific
// candidate; never automatically. Dates without a time create an all-day
// event; a specific time creates a 1-hour timed event.
export async function createEvent(authClient, { title, date, endDate, location }) {
  const calendar = google.calendar({ version: "v3", auth: authClient });
  const hasTime = date.includes("T");

  const start = hasTime ? { dateTime: date } : { date };
  const end = hasTime
    ? { dateTime: new Date(new Date(date).getTime() + 3600000).toISOString() }
    : { date: endDate || date };

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    requestBody: { summary: title, location: location || undefined, start, end },
  });
  return data;
}
