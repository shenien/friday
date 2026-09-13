import { readJson, writeJson } from "./store.js";

const FILE = "trip-packing.json";

export async function getPackingList(eventId) {
  const data = await readJson(FILE, {});
  return data[eventId] || null;
}

export async function generatePackingList(anthropic, model, eventId, { title, nights, location, weatherSummary }) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system:
      "Generate a concise packing list for a trip. Consider the trip length and " +
      "weather if given. Reply with ONLY a JSON array of short item strings, " +
      '10-16 items, e.g. ["Passport", "Phone charger", "Light jacket"]. Be specific ' +
      "to the trip, not generic filler.",
    messages: [
      {
        role: "user",
        content: `Trip: "${title}"\nNights: ${nights}\nLocation: ${location || "unspecified"}\nWeather: ${weatherSummary || "unknown"}`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text")?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  const items = match ? JSON.parse(match[0]) : [];

  const data = await readJson(FILE, {});
  data[eventId] = {
    generatedAt: new Date().toISOString(),
    items: items.filter((i) => typeof i === "string").map((text) => ({ text, checked: false })),
  };
  await writeJson(FILE, data);
  return data[eventId];
}

export async function toggleItem(eventId, index, checked) {
  const data = await readJson(FILE, {});
  const list = data[eventId];
  if (!list || !list.items[index]) throw new Error("Packing item not found.");
  list.items[index].checked = checked;
  await writeJson(FILE, data);
  return list;
}
