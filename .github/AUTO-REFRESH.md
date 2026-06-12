# Automatic data refresh

All tool data (equipment, gacha pools, rift bosses, decorations, …) is generated
directly from Goodgame Studios' own public game files — the same item DB, language
bundle and client DLL the game itself loads. `tools/_srcdata/pull.sh` resolves the
current versions and downloads them verbatim; each tool's `build.sh` extracts from
that local copy. No third-party data source is involved.

The [`refresh-data`](workflows/refresh-data.yml) workflow regenerates everything
and commits any changes. It runs:

1. **Daily** on a schedule (07:00 UTC) — a safety net.
2. **Manually** — the "Run workflow" button on the **Actions** tab.
3. **On demand** via `repository_dispatch` — so a Discord maintenance
   announcement can trigger an immediate refresh.

To refresh by hand locally instead: `bash tools/refresh-all.sh`.

---

## Wiring the Discord maintenance bot to a refresh

The official GGE Discord posts an announcement when maintenance happens. To make
that fire a refresh, something needs to watch that channel and POST to GitHub.
GitHub itself can't read Discord, so you need a small bridge. Two easy options:

### Option A — Zapier / Make (no code)
1. Trigger: **Discord → New Message Posted in Channel** (the announcements channel).
2. (Optional) Filter: only when the message contains "maintenance".
3. Action: **Webhooks → Custom Request**
   - Method: `POST`
   - URL: `https://api.github.com/repos/chemiestoolkit/gge-toolbox/dispatches`
   - Headers:
     - `Accept: application/vnd.github+json`
     - `Authorization: Bearer <GITHUB_TOKEN>`
     - `X-GitHub-Api-Version: 2022-11-28`
   - Body: `{ "event_type": "maintenance-done" }`

### Option B — tiny Discord bot
A bot with the **Message Content** intent, listening on the announcements
channel, that calls the same endpoint:

```js
// on each announcement message:
await fetch("https://api.github.com/repos/chemiestoolkit/gge-toolbox/dispatches", {
  method: "POST",
  headers: {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  },
  body: JSON.stringify({ event_type: "maintenance-done" }),
});
```

### The GitHub token
Create a **fine-grained personal access token** (GitHub → Settings → Developer
settings) scoped to **only** `chemiestoolkit/gge-toolbox` with **Contents: read &
write**. That's the `<GITHUB_TOKEN>` above. Treat it like a password — store it
in the Zapier/bot secret store, never in the repo.

A maintenance announcement then triggers `refresh-data`, which pulls the new
game data and commits it within a couple of minutes — no manual step.

---

## What still needs a human

The workflow refreshes **game data** automatically. Two things it can't infer:

- **What's New / changelog** (`assets/data/site-feed.json` → `changelog`) — write
  a line when you ship a feature. (The data refresh doesn't touch this.)
- **Events plan** (`assets/data/site-feed.json` → `events`) — update monthly from
  the [GGS event plan](https://communityhub.goodgamestudios.com/newshube4k/).
  New event art can be dropped in as `icon` paths.
