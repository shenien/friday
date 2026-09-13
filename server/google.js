import { google } from "googleapis";
import { readJson, writeJson } from "./store.js";

const FILE = "google-tokens.json";

// Least-privilege scopes: gmail.modify covers reading messages + changing
// labels (mark-as-read) without granting send/delete. calendar.events (not
// the broader "calendar" scope) allows creating events from detected travel
// confirmations without granting calendar-settings access.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function makeOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return null;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function isConfigured() {
  return makeOAuthClient() !== null;
}

export function getAuthUrl() {
  const client = makeOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured on the server.");
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleCallback(code) {
  const client = makeOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured on the server.");
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get();

  await writeJson(FILE, { tokens, email: data.email });
  return data.email;
}

export async function getStatus() {
  if (!isConfigured()) return { configured: false, connected: false };
  const data = await readJson(FILE, { tokens: null, email: null });
  return { configured: true, connected: Boolean(data.tokens), email: data.email };
}

export async function getConnectedEmail() {
  const data = await readJson(FILE, { tokens: null, email: null });
  return data.email;
}

export async function disconnect() {
  await writeJson(FILE, { tokens: null, email: null });
}

// Returns an OAuth2 client with stored credentials loaded, auto-persisting
// refreshed tokens back to disk (refresh tokens are long-lived but access
// tokens expire hourly).
export async function getAuthorizedClient() {
  const client = makeOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured on the server.");

  const data = await readJson(FILE, { tokens: null, email: null });
  if (!data.tokens) throw new Error("Google account is not connected yet.");

  client.setCredentials(data.tokens);
  client.on("tokens", async (newTokens) => {
    const merged = { ...data.tokens, ...newTokens };
    await writeJson(FILE, { tokens: merged, email: data.email });
  });

  return client;
}
