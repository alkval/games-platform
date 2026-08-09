# Alexander Games

Small card and board games for `games.alkval.com`.

War is the first playable game. Two people can join a private room, play over WebSockets, and save the result to SQLite. Mattis has a reserved route and will be added next.

## What is in the repo

- `src/client` contains the React app and page routes
- `src/server` contains Express APIs, Google sign-in, and the boardgame.io server
- `src/games` contains game rules, boards, tests, and the shared registry
- `prisma` contains the SQLite schema and migrations
- `scripts/check-multiplayer.mjs` runs a full two-client match check

The app and boardgame.io share port `3000`. Express handles the site, REST endpoints, and sign-in. boardgame.io handles room endpoints and Socket.IO connections.

## Local setup

1. Copy `.env.example` to `.env`
2. Change `APP_URL` and `GOOGLE_CALLBACK_URL` to `http://localhost:3000`
3. Change `DATABASE_URL` to `file:./dev.db`
4. Install packages with `npm install`
5. Run `npm run db:migrate -- --name initial`
6. Start both development servers with `npm run dev`

Vite runs on port `5173` during development and proxies API and WebSocket traffic to port `3000`.

## Checks

```bash
npm run typecheck
npm test
npm run build
DATABASE_URL=file:./dev.db npm run test:integration
```

The integration check creates two WebSocket clients, plays a complete War match, and confirms the result was saved.

## Google sign-in

Create a Google OAuth web client and add this redirect URI:

```text
https://games.alkval.com/api/auth/google/callback
```

Put the client ID and secret in `.env`. Guest play stays available when Google sign-in is not configured. Signed-in players get match statistics.

Generate the auth secret on Pop!_OS with:

```bash
openssl rand -hex 32
```

## Docker and Cloudflare Tunnel

There are no host port mappings in `docker-compose.yml`. The `games` container joins its private application network and the external `portfolio_default` network used by the existing `alkval-public` Cloudflare Tunnel.

1. Copy `.env.example` to `.env` and fill in the values
2. Keep `PUBLIC_TUNNEL_NETWORK=portfolio_default`, unless the existing tunnel uses a different Docker network
3. In the `alkval-public` tunnel, add the public hostname `games.alkval.com`
4. Set its service to `http://games:3000`
5. Run `docker compose up -d --build`

The game stack does not store another tunnel token or publish a host port. The existing tunnel container reaches `games` through the shared external Docker network.
