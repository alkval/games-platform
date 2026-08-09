import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { Client } = require('boardgame.io/client');
const { SocketIO } = require('boardgame.io/multiplayer');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3101';
process.env.APP_URL = process.env.APP_URL ?? `http://localhost:${process.env.PORT}`;
process.env.GOOGLE_CALLBACK_URL = `${process.env.APP_URL}/api/auth/google/callback`;

const serverUrl = process.env.APP_URL;

async function waitFor(check, message, timeout = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(message);
}

async function post(path, body) {
  const response = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  return JSON.parse(text);
}

async function run() {
  const [{ startServer }, { WarGame }] = await Promise.all([
    import('../dist-server/server/server.js'),
    import('../dist-server/games/cardgames/war/game.js'),
  ]);

  const stopServer = await startServer();
  const clients = [];

  try {
    const { matchID } = await post('/games/war/create', { numPlayers: 2 });
    const first = await post(`/games/war/${matchID}/join`, { playerID: '0', playerName: 'Alice' });
    const second = await post(`/games/war/${matchID}/join`, { playerID: '1', playerName: 'Bob' });

    clients.push(
      ...[first, second].map((joined, playerID) =>
        Client({
          game: WarGame,
          multiplayer: SocketIO({ server: serverUrl }),
          matchID,
          playerID: String(playerID),
          credentials: joined.playerCredentials,
        }),
      ),
    );

    clients.forEach((client) => client.start());
    await waitFor(() => clients.every((client) => client.getState()?.isConnected), 'Clients did not connect');

    for (let move = 0; move < 52; move += 1) {
      const currentPlayer = clients[0].getState().ctx.currentPlayer;
      const activeClient = clients[Number(currentPlayer)];
      const previousStateIDs = clients.map((client) => client.getState()._stateID);
      activeClient.moves.playCard(0);
      await waitFor(
        () => clients.every((client, index) => client.getState()?._stateID > previousStateIDs[index]),
        `Move ${move + 1} did not reach both players`,
      );
    }

    await waitFor(() => Boolean(clients[0].getState()?.ctx.gameover), 'The match did not finish');
    await waitFor(async () => {
      const response = await fetch(`${serverUrl}/api/matches/recent?game=war`);
      const matches = await response.json();
      return matches.some((match) => match.id === matchID);
    }, 'Completed match was not saved');

    console.log(`Multiplayer match ${matchID} completed and was saved`);
  } finally {
    clients.forEach((client) => client.stop());
    await new Promise((resolve) => setTimeout(resolve, 500));
    await stopServer();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
