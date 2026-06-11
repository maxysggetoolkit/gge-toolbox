# Discord feed → site (Prime Times & Announcements)

The homepage shows two Discord-sourced panels — **Prime Times** and **GGE
Announcements** — from [`assets/data/discord-feed.json`](../assets/data/discord-feed.json).

**Important:** a Discord *webhook* URL can only POST messages *into* a channel —
it cannot read them. So the webhooks you have can't feed the site directly.
Something has to **read** the announcement channels and **write** the JSON. That
"something" is a small reader bot (or a no-code automation).

## The data file

```json
{
  "updated": "2026-06-10",
  "announcements": [
    { "date": "10 Jun", "title": "Server maintenance", "body": "Back online ~14:00 UTC", "url": "" }
  ],
  "primeTimes": [
    { "date": "10 Jun", "title": "Ruby sale", "body": "+50% bonus rubies, 48h", "url": "" }
  ]
}
```

Newest first. Trim expired prime times so the panel stays current. `url` is
optional. The site shows the latest 6 of each.

## Wiring up the reader

You need a bot with **read access** (the *Message Content* intent) to the two
channels. On each new message it updates `discord-feed.json` in this repo. Two
ways to write the file:

### Option A — commit via the GitHub API (keeps it static)
The bot reads a message, then PUTs the updated JSON to the repo:

```
PUT https://api.github.com/repos/maxysggetoolkit/gge-toolbox/contents/assets/data/discord-feed.json
Authorization: Bearer <FINE_GRAINED_PAT with Contents: read & write>
Body: { "message": "feed: update", "content": "<base64 of the new JSON>", "sha": "<current file sha>" }
```

GitHub Pages redeploys automatically on commit, so the panel updates within a
minute or two.

### Option B — host the JSON elsewhere
The bot writes the JSON to any static host / gist / small API, and the site
fetches from there instead. Change the fetch URL in
[`assets/js/home-feed.js`](../assets/js/home-feed.js) (`discord-feed.json`).

## Mapping channels

- **GGE Announcements** channel → `announcements[]`
- **GGE Prime Times** channel → `primeTimes[]`

Parse each message into `{ date, title, body }`. Keep it short — the panels are
a glanceable summary, with a link out for detail.

## The webhooks you have (the other direction)

The webhook URLs you provided POST *into* Discord. They're useful in reverse: the
data-refresh Action (or any site event) can POST a notice like "new equipment
added" or "data refreshed" into those channels. That's optional and separate
from the read-path above.
