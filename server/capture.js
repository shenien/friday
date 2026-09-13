// Classifies a free-form "brain dump" into either a task (something actionable,
// with an implied priority) or a note (information worth keeping, not an action).
export async function classifyCapture(anthropic, model, text) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 200,
    system:
      "Classify the user's text as either a TASK (something they need to do or " +
      "be reminded to do) or a NOTE (information, an idea, or something to " +
      "remember that isn't an action item). Reply with ONLY JSON in this exact " +
      'shape: {"type": "task", "text": "...", "priority": "low"|"normal"|"high"} ' +
      'or {"type": "note", "text": "..."}. Rewrite "text" to be clean and concise ' +
      "if useful, but preserve the original meaning. Infer priority from urgency " +
      'language ("ASAP", "urgent" -> high; no urgency cues -> normal).',
    messages: [{ role: "user", content: text }],
  });

  const raw = res.content.find((b) => b.type === "text")?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not classify capture.");
  const parsed = JSON.parse(match[0]);

  if (parsed.type === "task") {
    return {
      type: "task",
      text: String(parsed.text || text),
      priority: ["low", "normal", "high"].includes(parsed.priority) ? parsed.priority : "normal",
    };
  }
  return { type: "note", text: String(parsed.text || text) };
}
