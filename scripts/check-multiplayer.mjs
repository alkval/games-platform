import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';

const require = createRequire(import.meta.url);
const { Client } = require('boardgame.io/client');
const { SocketIO } = require('boardgame.io/multiplayer');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3101';
process.env.APP_URL = process.env.APP_URL ?? `http://localhost:${process.env.PORT}`;
process.env.GOOGLE_CALLBACK_URL = `${process.env.APP_URL}/api/auth/google/callback`;
process.env.AUTH_SECRET = 'integration-secret-that-is-at-least-32-characters';
const integrationDatabase = `integration-${process.pid}.db`;
process.env.DATABASE_URL = process.env.DATABASE_URL ?? `file:./${integrationDatabase}`;

if (process.env.DATABASE_URL === `file:./${integrationDatabase}`) {
  copyFileSync(
    fileURLToPath(new URL('../prisma/dev.db', import.meta.url)),
    fileURLToPath(new URL(`../prisma/${integrationDatabase}`, import.meta.url)),
  );
}

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
  const [{ startServer }, { WarGame }, { MattisGame, canBeat }, { ChessGame }, { prisma }, { cleanupExpiredRooms }] = await Promise.all([
    import('../dist-server/server/server.js'),
    import('../dist-server/games/cardgames/war/game.js'),
    import('../dist-server/games/cardgames/mattis/game.js'),
    import('../dist-server/games/boardgames/chess/game.js'),
    import('../dist-server/server/prisma.js'),
    import('../dist-server/server/room-cleanup.js'),
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

    const mattisRoom = await post('/games/mattis/create', { numPlayers: 2 });
    const mattisFirst = await post(`/games/mattis/${mattisRoom.matchID}/join`, { playerID: '0', playerName: 'Alice' });
    const mattisSecond = await post(`/games/mattis/${mattisRoom.matchID}/join`, { playerID: '1', playerName: 'Bob' });
    const mattisClients = [mattisFirst, mattisSecond].map((joined, playerID) =>
      Client({
        game: MattisGame,
        multiplayer: SocketIO({ server: serverUrl }),
        matchID: mattisRoom.matchID,
        playerID: String(playerID),
        credentials: joined.playerCredentials,
      }),
    );
    clients.push(...mattisClients);
    mattisClients.forEach((client) => client.start());
    await waitFor(() => mattisClients.every((client) => client.getState()?.isConnected), 'Mattis clients did not connect');

    for (let move = 0; move < 2500 && !mattisClients[0].getState()?.ctx.gameover; move += 1) {
      const currentPlayer = mattisClients[0].getState().ctx.currentPlayer;
      const activeClient = mattisClients[Number(currentPlayer)];
      const state = activeClient.getState();
      const previousStateIDs = mattisClients.map((client) => client.getState()._stateID);

      if (state.G.phase === 'collecting') {
        activeClient.moves.playCard(0);
      } else {
        const hand = state.G.hands[currentPlayer];
        const top = state.G.trick.at(-1)?.card;
        const legalIndex = state.G.mustPickUp[currentPlayer]
          ? -1
          : hand.findIndex((card) => !top || (state.G.trumpSuit && canBeat(card, top, state.G.trumpSuit)));
        if (legalIndex >= 0) activeClient.moves.playCard(legalIndex);
        else activeClient.moves.pickUpOldest();
      }

      await waitFor(
        () => mattisClients.every((client, index) => client.getState()?._stateID > previousStateIDs[index]),
        `Mattis move ${move + 1} did not reach both players`,
      );
    }

    await waitFor(() => Boolean(mattisClients[0].getState()?.ctx.gameover), 'The Mattis match did not finish');
    await waitFor(async () => {
      const response = await fetch(`${serverUrl}/api/matches/recent?game=mattis`);
      const matches = await response.json();
      return matches.some((match) => match.id === mattisRoom.matchID);
    }, 'Completed Mattis match was not saved');

    console.log(`Mattis match ${mattisRoom.matchID} completed and was saved`);

    const chessRoom = await post('/games/chess/create', { numPlayers: 2 });
    const chessFirst = await post(`/games/chess/${chessRoom.matchID}/join`, { playerID: '0', playerName: 'Alice' });
    const chessSecond = await post(`/games/chess/${chessRoom.matchID}/join`, { playerID: '1', playerName: 'Bob' });
    const chessClients = [chessFirst, chessSecond].map((joined, playerID) => Client({ game: ChessGame, multiplayer: SocketIO({ server: serverUrl }), matchID: chessRoom.matchID, playerID: String(playerID), credentials: joined.playerCredentials }));
    clients.push(...chessClients);
    chessClients.forEach((client) => client.start());
    await waitFor(() => chessClients.every((client) => client.getState()?.isConnected), 'Chess clients did not connect');
    for (const [player, from, to] of [[0, 'f2', 'f3'], [1, 'e7', 'e5'], [0, 'g2', 'g4'], [1, 'd8', 'h4']]) {
      const before = chessClients.map((client) => client.getState()._stateID);
      chessClients[player].moves.makeMove(from, to);
      await waitFor(() => chessClients.every((client, index) => client.getState()?._stateID > before[index]), `Chess move ${from}-${to} did not reach both players`);
    }
    await waitFor(() => chessClients[0].getState()?.ctx.gameover?.winner === '1', 'Chess checkmate was not detected');
    await waitFor(async () => (await (await fetch(`${serverUrl}/api/matches/recent?game=chess`)).json()).some((match) => match.id === chessRoom.matchID), 'Completed chess match was not saved');
    console.log(`Chess match ${chessRoom.matchID} completed and was saved`);

    const privateEmail = `private-${process.pid}@example.test`;
    const privacyUser = await prisma.user.create({ data: { googleId: `privacy-${process.pid}`, email: privateEmail, displayName: 'Privacy Test Player', stats: { create: { gameId: 'chess', played: 2, won: 1, lost: 0, draws: 1 } } } });
    for (const path of ['/api/leaderboard?game=all', `/api/players/${privacyUser.id}`, '/api/matches/recent']) {
      const response = await fetch(`${serverUrl}${path}`);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.equal(body.includes(privateEmail), false, `Public endpoint ${path} exposed a private email`);
    }
    console.log('Public leaderboard, player profile, and recent-match APIs do not expose email addresses');

    const adminOverview = await fetch(`${serverUrl}/api/admin/overview`);
    assert.equal(adminOverview.status, 401, 'Unauthenticated requests must not access administration');
    const adminDelete = await fetch(`${serverUrl}/api/admin/users/${privacyUser.id}`, { method: 'DELETE' });
    assert.equal(adminDelete.status, 401, 'Unauthenticated requests must not use destructive administration endpoints');
    console.log('Administration endpoints reject unauthenticated reads and deletes');

    const adminUser = await prisma.user.create({ data: { googleId: `admin-${process.pid}`, email: 'alexanderogtore@gmail.com', displayName: 'Alexander' } });
    const adminToken = await new SignJWT({ email: adminUser.email, displayName: adminUser.displayName, avatarUrl: null })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(adminUser.id)
      .setIssuer('games.alkval.com')
      .setAudience('web')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const adminHeaders = { cookie: `alkval_games_session=${adminToken}` };
    assert.equal((await fetch(`${serverUrl}/api/admin/overview`, { headers: adminHeaders })).status, 200);
    assert.equal((await fetch(`${serverUrl}/api/admin/users/${adminUser.id}`, { method: 'DELETE', headers: adminHeaders })).status, 400, 'The active administrator must not be deletable');

    const statsUser = await prisma.user.create({ data: { googleId: `stats-${process.pid}`, email: `stats-${process.pid}@example.test`, displayName: 'Stats Test Player' } });
    for (const id of ['admin-stats-one', 'admin-stats-two']) {
      await prisma.match.create({ data: { id: `${id}-${process.pid}`, gameId: 'chess', playerCount: 2, resultJson: JSON.stringify({ winner: '0' }), players: { create: [{ playerId: '0', playerName: statsUser.displayName, userId: statsUser.id, placement: 1 }, { playerId: '1', playerName: 'Guest', placement: 2 }] } } });
    }
    await prisma.playerStat.create({ data: { userId: statsUser.id, gameId: 'chess', played: 2, won: 2 } });
    const deletedMatchId = `admin-stats-one-${process.pid}`;
    assert.equal((await fetch(`${serverUrl}/api/admin/matches/${deletedMatchId}`, { method: 'DELETE', headers: adminHeaders })).status, 204);
    assert.equal(await prisma.match.findUnique({ where: { id: deletedMatchId } }), null);
    assert.deepEqual(await prisma.playerStat.findUnique({ where: { userId_gameId: { userId: statsUser.id, gameId: 'chess' } }, select: { played: true, won: true, lost: true, draws: true } }), { played: 1, won: 1, lost: 0, draws: 0 });
    assert.equal((await fetch(`${serverUrl}/api/admin/users/${statsUser.id}`, { method: 'DELETE', headers: adminHeaders })).status, 204);
    assert.equal(await prisma.user.findUnique({ where: { id: statsUser.id } }), null);
    console.log('Authorized administration protects the owner and keeps statistics consistent after deletions');

    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const recentDate = new Date();
    const roomBase = { gameName: 'war', stateJson: '{}', initialStateJson: '{}', logJson: '[]' };
    await prisma.gameState.createMany({ data: [
      { ...roomBase, id: `expired-empty-${process.pid}`, metadataJson: JSON.stringify({ players: { 0: { id: 0 }, 1: { id: 1 } } }), createdAt: staleDate, updatedAt: recentDate },
      { ...roomBase, id: `expired-joined-${process.pid}`, metadataJson: JSON.stringify({ players: { 0: { id: 0, name: 'Alice' }, 1: { id: 1 } } }), createdAt: staleDate, updatedAt: staleDate },
      { ...roomBase, id: `recent-empty-${process.pid}`, metadataJson: JSON.stringify({ players: { 0: { id: 0 }, 1: { id: 1 } } }), createdAt: recentDate, updatedAt: recentDate },
    ] });
    assert.equal(await cleanupExpiredRooms(recentDate), 2);
    assert.equal(await prisma.gameState.findUnique({ where: { id: `expired-empty-${process.pid}` } }), null);
    assert.equal(await prisma.gameState.findUnique({ where: { id: `expired-joined-${process.pid}` } }), null);
    assert.notEqual(await prisma.gameState.findUnique({ where: { id: `recent-empty-${process.pid}` } }), null);
    console.log('Room cleanup removes expired empty and abandoned rooms while preserving recent rooms');
  } finally {
    clients.forEach((client) => client.stop());
    await new Promise((resolve) => setTimeout(resolve, 500));
    await stopServer();
    if (process.env.DATABASE_URL === `file:./${integrationDatabase}`) {
      rmSync(fileURLToPath(new URL(`../prisma/${integrationDatabase}`, import.meta.url)), { force: true });
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
