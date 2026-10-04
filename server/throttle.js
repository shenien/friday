// Runs `fn` over `items` with at most `limit` calls in flight, preserving order.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Gmail bills each call in "quota units" (messages.get = 5, threads.get = 10)
// against a per-user budget. Spending through one shared pacer keeps every
// analysis in this process under that budget instead of racing into the wall.
export function createBudget(unitsPerSecond) {
  let next = 0;
  return async (units = 1) => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + (units * 1000) / unitsPerSecond;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  };
}

export const gmailBudget = createBudget(50);

function isRateLimit(err) {
  const status = Number(err?.code ?? err?.status ?? err?.response?.status);
  const text = `${err?.message ?? ""} ${err?.response?.data?.error?.errors?.[0]?.reason ?? ""}`;
  return status === 429 || status === 503 || (status === 403 && /rate.?limit|quota/i.test(text));
}

// Gmail enforces per-user quotas; when we brush against them, waiting and
// retrying beats failing a whole analysis halfway through.
export async function withBackoff(fn, { retries = 6, baseMs = 2000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimit(err) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt + Math.random() * 300));
    }
  }
}
