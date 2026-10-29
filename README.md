# mensabot

Posts the daily menu of the Mensa Uni Passau (from stwno.de) to a Discord webhook using Components V2:
one coloured container per category, dish photos as thumbnails, student prices only.

## Setup

1. Create a Discord webhook and add it as the repository secret `DISCORD_WEBHOOK_URL`
   (Settings → Secrets and variables → Actions).
2. That's it. The workflow in `.github/workflows/mensa.yml` has no schedule of its own; trigger it via `workflow_dispatch`
   (e.g. cronjob.com calling the GitHub API every 15–30 min). It posts from 9:00 Europe/Berlin on.

The first run of the day posts the menu once all categories (Hauptgerichte, Beilagen, Nachspeisen) are
there, or at 12:00 Berlin time at the latest. Every later run re-fetches it and, if the Mensa changed something,
edits the original messages: dishes that disappeared stay in place struck through and marked "Entfällt"
(photo as spoiler), new dishes are appended with "Neu", and the header shows "Aktualisiert HH:MM". Unchanged
menus are a no-op. What was posted is remembered in the Actions cache (`STATE_FILE`, see `src/index.js`), which
also keeps double triggers (DST, delayed runs, cronjob.com) from posting twice. For updates to happen something
has to trigger the workflow repeatedly (e.g. cronjob.com via `workflow_dispatch`). Triggers only count between
9:00 and 14:00 Berlin time unless they pass a date. A run with an explicit date always
posts a new message and keeps no state. Use "Run workflow" in the Actions tab (optionally with a date), or

```sh
gh workflow run mensa.yml -R SCDerox/mensabot            # today
gh workflow run mensa.yml -R SCDerox/mensabot -f date=2026-10-14
```

## Local

```sh
DISCORD_WEBHOOK_URL=… npm start          # today's menu
DATE=2026-10-13 DISCORD_WEBHOOK_URL=… npm start
npm test
```

Days without a menu (weekends, holidays) are skipped without posting. Excluded categories and dishes
(soups, salad bar) are set in `src/index.js`; colours and emojis in `src/discord.js`.
