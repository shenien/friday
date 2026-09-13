// Looks for flight/hotel/rental-car/reservation confirmations among an
// already-classified batch of "orders" emails, and extracts enough structure
// to offer creating a calendar event — the user still has to approve it.
export async function extractTravel(anthropic, model, messages) {
  if (messages.length === 0) return [];

  const listing = messages
    .map((m, i) => `${i + 1}. id=${m.id}\nSubject: ${m.subject}\nSnippet: ${m.snippet}\nDate received: ${m.date}`)
    .join("\n\n");

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    system:
      "Some of these are travel/reservation confirmations (flight, hotel, rental car, " +
      "restaurant reservation, event ticket) with a specific date the thing happens. " +
      "Others are unrelated orders (packages, retail purchases) — ignore those. For each " +
      "email that IS a travel/reservation confirmation with an extractable date, reply " +
      "with an entry; skip emails that aren't. Reply with ONLY a JSON array like " +
      '[{"id": "...", "title": "Flight to SFO", "date": "2026-10-02", "endDate": null, ' +
      '"location": "San Francisco"}] — "date" in YYYY-MM-DD format (or YYYY-MM-DDTHH:mm:ss ' +
      'if a specific time is known), "endDate" only for multi-day stays (hotel checkout), ' +
      "else null. If nothing qualifies, reply with [].",
    messages: [{ role: "user", content: listing }],
  });

  const text = res.content.find((b) => b.type === "text")?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return parsed.filter((p) => p && typeof p.id === "string" && typeof p.date === "string");
}
