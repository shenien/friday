import crypto from "node:crypto";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

function digest(value) {
  return crypto.createHash("sha256").update(value).digest();
}

function matches(supplied, expected) {
  return crypto.timingSafeEqual(digest(supplied), digest(expected));
}

// Friday exposes personal email, tasks, and the Anthropic key's spend, so a
// public deployment must never be open. Locally (no dist build, no password)
// it stays open for development; in production it refuses to serve anything
// until FRIDAY_PASSWORD is set. The browser's built-in Basic-auth prompt
// handles login and then attaches the credentials to every API call.
export function passwordGate({ isProduction }) {
  return (req, res, next) => {
    if (req.path === "/api/health") return next();

    const password = process.env.FRIDAY_PASSWORD;
    if (!password) {
      if (!isProduction) return next();
      return res
        .status(503)
        .type("text/plain")
        .send("Friday is locked until FRIDAY_PASSWORD is set on the server.");
    }

    const now = Date.now();
    const record = failures.get(req.ip);
    if (record && record.resetAt > now && record.count >= MAX_FAILURES) {
      return res.status(429).type("text/plain").send("Too many attempts. Try again later.");
    }

    const [scheme, encoded] = (req.headers.authorization || "").split(" ");
    if (scheme === "Basic" && encoded) {
      const supplied = Buffer.from(encoded, "base64").toString("utf8");
      const colon = supplied.indexOf(":");
      if (colon >= 0 && matches(supplied.slice(colon + 1), password)) {
        failures.delete(req.ip);
        return next();
      }
      const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + WINDOW_MS };
      current.count += 1;
      failures.set(req.ip, current);
    }

    res.set("WWW-Authenticate", 'Basic realm="Friday", charset="UTF-8"');
    res.status(401).type("text/plain").send("Authentication required.");
  };
}
