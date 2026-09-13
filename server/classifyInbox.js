// Classifies a batch of inbox messages in one call — far cheaper and faster
// than one call per message, and small inbox batches (<=25) fit comfortably
// in a single prompt.
export async function classifyMessages(anthropic, model, messages) {
  if (messages.length === 0) return [];

  const listing = messages
    .map((m, i) => `${i + 1}. id=${m.id}\nFrom: ${m.from}\nSubject: ${m.subject}\nSnippet: ${m.snippet}`)
    .join("\n\n");

  const res = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system:
      "Classify each email into exactly one category:\n" +
      '- "human": a real, personal message written specifically to the recipient by an actual person ' +
      "(not a bulk sender, not a no-reply address, not a company account acting on someone's behalf).\n" +
      '- "orders_deliveries": shipping/delivery notifications, order confirmations, "your order is out for ' +
      'delivery" style updates, receipts tied to a specific purchase.\n' +
      '- "important_other": automated but needs attention and isn\'t an order/delivery — security or account ' +
      "alerts, bills or invoices, appointment confirmations, credit/financial alerts.\n" +
      '- "marketing_or_political": promotional/sales emails, non-essential newsletters, or political ' +
      "campaign/fundraising/advocacy emails.\n" +
      '- "other_automated": any other automated email that doesn\'t fit the above (e.g. routine social/product ' +
      "notifications).\n\n" +
      'Reply with ONLY a JSON array like [{"id": "...", "category": "..."}] — one entry per email, ' +
      "in the same order given, using each email's exact id.",
    messages: [{ role: "user", content: listing }],
  });

  const text = res.content.find((b) => b.type === "text")?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);

  const VALID = new Set([
    "human",
    "orders_deliveries",
    "important_other",
    "marketing_or_political",
    "other_automated",
  ]);
  return parsed.filter((p) => p && typeof p.id === "string" && VALID.has(p.category));
}
