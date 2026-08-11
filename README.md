# Alexander Games

A self-hosted multiplayer card and board game platform for [games.alkval.com](https://games.alkval.com).

## Features

- Online invite rooms over Socket.IO
- War, Norwegian Mattis (2-6 players), and complete standard chess
- Local computer practice with Easy, Normal, and Hard boardgame.io bots
- Up to five named Mattis bots: Craig, Hubert, Eugene, Montgomery, and Cornelius
- Google OAuth sign-in with guest play remaining available
- Private owner-only email data and public player profiles
- Global and per-game leaderboards
- Administrator-only account, match, and active-room management
- Automatic cleanup of empty rooms after 24 hours and joined-but-abandoned rooms after 30 inactive days
- Persistent online game state, completed matches, and player statistics
- Light, dark, and system colour themes
- Route-level code splitting so game implementations load only when needed

Practice games run inside the browser and never affect player statistics or leaderboards.

## Architecture

```text
Cloudflare Edge
  -> Cloudflare Tunnel
    -> games container :3000
       |- Express: REST API, Google OAuth, static React app
       |- boardgame.io: rooms, authoritative rules, Socket.IO
       `- Prisma -> SQLite persistent Docker volume
```

There are no host port mappings and no router ports to open. The container joins the existing external `portfolio_default` network used by the public Cloudflare Tunnel.

## Technology

- React 18, React Router, TypeScript, Tailwind CSS 4, Framer Motion
- Vite with lazy route chunks
- Node.js 24 and Express 5
- boardgame.io 0.50 with Socket.IO multiplayer and local Random/MCTS bots
- chess.js for legal chess rules and game-over detection
- Passport Google OAuth, signed JWT cookies, and JOSE
- Prisma 6 with SQLite
- Vitest plus a real two-client multiplayer integration script
- Multi-stage Docker build running as an unprivileged user

## Repository layout

```text
src/client/              React routes, authentication context, and shared UI
src/games/               Game rules, boards, AI enumeration, registry, and tests
src/server/              Express, OAuth, APIs, boardgame.io, and Prisma storage
prisma/                  SQLite schema and migrations
scripts/                 End-to-end multiplayer and privacy checks
public/                  Favicons and static assets
```

Each game registers metadata, a boardgame.io rules object, a React board, player limits, and legal AI actions. Online game state is server-authoritative. `playerView` removes hidden cards before state is sent to another player.

## Authentication and privacy

Google sign-in requests the `profile` and `email` scopes. A seven-day HTTP-only, secure, SameSite=Lax JWT cookie holds the web session. A separate six-hour game token associates a signed-in user with a multiplayer seat.

Emails are returned only from the signed-in owner's private profile endpoint. Public leaderboards and profiles expose display name, avatar, join date, and game statistics only.

The `/admin` route and every `/api/admin/*` operation are restricted server-side to `alexanderogtore@gmail.com`. The navigation link is shown only to that account, but authorization never relies on the hidden link. Destructive controls require confirmation, the active administrator cannot delete their own account, and deleting a completed match rebuilds aggregate player statistics so profiles and leaderboards remain consistent. Deleting an account removes its identity and statistics while retaining the match as anonymized history.

## Data model

- `User`: Google identity, private email, display name, avatar
- `GameState`: serialized active state, metadata, and move log
- `Match`: permanent completed-game summary
- `MatchPlayer`: each participant's score and placement
- `PlayerStat`: per-user, per-game win/loss/draw totals

Online matches survive container restarts. Practice matches are deliberately local and ephemeral.

Created online rooms with no joined players expire after 24 hours. Rooms with at least one joined player expire after 30 days without any room activity. Cleanup runs when the server starts and once per hour thereafter; completed match history and leaderboard records are not affected. These durations are configurable through `EMPTY_ROOM_TTL_HOURS`, `STALE_ROOM_TTL_DAYS`, and `ROOM_CLEANUP_INTERVAL_MINUTES`.

## Local development

```bash
cp .env.example .env
npm install
npm run db:migrate -- --name initial
npm run dev
```

Vite runs on `5173` and proxies API and WebSocket requests to the Node server on `3000`.

Required production values include a strong `AUTH_SECRET`, Google client credentials, the public app URL, and the Google callback URL:

```text
https://games.alkval.com/api/auth/google/callback
```

## Validation

```bash
npm run typecheck
npm test
npm run build
npm run test:integration
```

The integration check starts the real server, connects independent Socket.IO clients, completes War, Mattis, and Chess matches, verifies persistence, and asserts that public APIs do not expose email addresses.

## Production

```bash
docker compose up -d --build
```

The container runs database migrations before starting the application. Its health check calls `/api/health`, it restarts unless stopped, and SQLite is stored in the `games_data` named volume.

### Automatic deployment

Production polls the GitHub `main` branch every minute through the included systemd timer. A deployment runs only when the commit changes, allows only one deployment at a time, preserves the untracked production `.env` and Docker volume, waits for the replacement container to become healthy, and rolls back to the previous commit if the release fails.

The public `/api/health` response includes the deployed Git revision, allowing a release to be verified without server or SSH access.

Install it once on the Pop!_OS host as the regular `alkval` user:

```bash
cd /DATA/AppData/games-platform
bash scripts/install-autodeploy.sh
```

The installer requests `sudo` only when installing and enabling the two systemd units. After that, pushing to `main` is sufficient; no SSH key is needed by the development machine. Production source files are managed by Git after installation, so permanent server-specific values belong in the ignored `.env` file rather than tracked files.

Useful status commands:

```bash
systemctl status games-platform-autodeploy.timer
journalctl -u games-platform-autodeploy.service -n 50 --no-pager
```
