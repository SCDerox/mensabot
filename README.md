# mensabot

Posts the daily menu of the Mensa Uni Passau (from stwno.de) to a Discord webhook using Components V2:
one coloured container per category, dish photos as thumbnails, student prices only.

## Setup

1. Create a Discord webhook and add it as the repository secret `DISCORD_WEBHOOK_URL`
   (Settings → Secrets and variables → Actions).
2. That's it. The workflow in `.github/workflows/mensa.yml` posts on weekdays at 10:00 Europe/Berlin.

Scheduled runs post at most once per day (a cache marker guards against the DST double trigger and
delayed runs). Run it manually from the Actions tab with "Run workflow"; manual runs always post.

## Local

```sh
DISCORD_WEBHOOK_URL=… npm start          # today's menu
DATE=2026-10-13 DISCORD_WEBHOOK_URL=… npm start
npm test
```

Days without a menu (weekends, holidays) are skipped without posting. Excluded categories and dishes
(soups, salad bar) are set in `src/index.js`; colours and emojis in `src/discord.js`.
