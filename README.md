# Friday

Personal AI assistant/command HUD. Standalone app, linked as a tile from [Jarvis](https://github.com/shenien/jarvis).

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm run dev
```

Dev server: Vite on `:5176`, Express API on `:3003` (proxied via `/api`).

To connect Gmail/Calendar, also fill in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (from a Google Cloud OAuth client) and click "Connect Google" in the app.

## Deploy

Render Web Service via `render.yaml` (same shape as [fretboard](https://github.com/shenien/fretboard)). Set `ANTHROPIC_API_KEY` (and the `GOOGLE_*` vars, if using Gmail/Calendar) in the Render dashboard.

## v1 scope

Shipped: HUD shell with a time-aware text greeting, live weather + 7-day forecast, a month-ahead calendar view, task/note capture (auto-sorted by a floating capture button), "Ask Friday" chat with a growing memory of durable facts about you (`server/data/memory.json`), and Gmail triage (People/Orders/Other tabs, mark read/spam, review-and-approve unsubscribe queue).

No spoken voice — decided against it (ElevenLabs' free tier doesn't support API access to voices, and a paid TTS service wasn't worth it for this).
