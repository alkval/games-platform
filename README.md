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

## Data model

- `User`: Google identity, private email, display name, avatar
- `GameState`: serialized active state, metadata, and move log
- `Match`: permanent completed-game summary
- `MatchPlayer`: each participant's score and placement
- `PlayerStat`: per-user, per-game win/loss/draw totals

Online matches survive container restarts. Practice matches are deliberately local and ephemeral.

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
