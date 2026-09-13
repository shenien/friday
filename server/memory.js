import { readJson, writeJson } from "./store.js";

const FILE = "memory.json";

export async function getFacts() {
  const data = await readJson(FILE, { facts: [] });
  return data.facts;
}

export async function addFacts(newFacts) {
  if (!newFacts.length) return getFacts();
  const data = await readJson(FILE, { facts: [] });
  const existing = new Set(data.facts.map((f) => f.toLowerCase()));
  for (const fact of newFacts) {
    const trimmed = fact.trim();
    if (trimmed && !existing.has(trimmed.toLowerCase())) {
      data.facts.push(trimmed);
      existing.add(trimmed.toLowerCase());
    }
  }
  await writeJson(FILE, data);
  return data.facts;
}

export async function removeFact(index) {
  const data = await readJson(FILE, { facts: [] });
  if (index < 0 || index >= data.facts.length) throw new Error("Fact not found.");
  data.facts.splice(index, 1);
  await writeJson(FILE, data);
  return data.facts;
}

// Best-effort extraction of durable, personal facts worth remembering long-term
// (preferences, people, ongoing projects) — distinct from one-off chat content.
export async function extractFacts(anthropic, model, userMessage, assistantReply) {
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 256,
      system:
        "Extract any new, durable personal facts ABOUT THE USER (not about the " +
        "assistant, and not facts the user already knows the assistant knows) from " +
        "this exchange — preferences, people in their life, ongoing projects, " +
        "recurring habits, identifying details. Ignore one-off questions, trivia, " +
        "small talk, and anything about the assistant itself (its name, persona, " +
        "or how it addresses the user). Reply with ONLY a JSON array of short fact " +
        'strings, e.g. ["Works as a software engineer", "Has a dog named Rex"]. ' +
        "If nothing durable was revealed, reply with [].",
      messages: [
        {
          role: "user",
          content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantReply}"`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const facts = JSON.parse(match[0]);
    return Array.isArray(facts) ? facts.filter((f) => typeof f === "string") : [];
  } catch (err) {
    console.error("extractFacts failed:", err);
    return [];
  }
}
