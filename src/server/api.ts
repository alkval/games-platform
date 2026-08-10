import type { Express } from 'express';
import { readSession } from './auth.js';
import { prisma } from './prisma.js';

type StoredResult = { winner?: string; draw?: boolean };

function parseResult(value: string): StoredResult {
  try {
    return JSON.parse(value) as StoredResult;
  } catch {
    return {};
  }
}

export function configureApi(app: Express): void {
  app.get('/api/profile', async (request, response, next) => {
    try {
      const session = await readSession(request);
      if (!session) {
        response.status(401).json({ error: 'Sign in to view your profile' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          displayName: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
          stats: { orderBy: [{ played: 'desc' }, { gameId: 'asc' }] },
          matchPlayers: {
            take: 10,
            orderBy: { match: { endedAt: 'desc' } },
            select: {
              playerId: true,
              playerName: true,
              score: true,
              placement: true,
              match: {
                select: {
                  id: true,
                  gameId: true,
                  endedAt: true,
                  resultJson: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        response.status(404).json({ error: 'Profile not found' });
        return;
      }

      const totals = user.stats.reduce(
        (summary, stat) => ({
          played: summary.played + stat.played,
          won: summary.won + stat.won,
          lost: summary.lost + stat.lost,
          draws: summary.draws + stat.draws,
        }),
        { played: 0, won: 0, lost: 0, draws: 0 },
      );

      response.set('Cache-Control', 'private, no-store');
      response.json({
        profile: {
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          memberSince: user.createdAt,
        },
        totals: {
          ...totals,
          winRate: totals.played ? Math.round((totals.won / totals.played) * 100) : 0,
        },
        byGame: user.stats.map(({ gameId, played, won, lost, draws }) => ({ gameId, played, won, lost, draws })),
        recentMatches: user.matchPlayers.map((player) => {
          const result = parseResult(player.match.resultJson);
          const outcome = result.draw ? 'draw' : result.winner === player.playerId ? 'win' : 'loss';
          return {
            id: player.match.id,
            gameId: player.match.gameId,
            playerName: player.playerName,
            score: player.score,
            placement: player.placement,
            outcome,
            endedAt: player.match.endedAt,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/leaderboard', async (request, response, next) => {
    try {
      const gameId = typeof request.query.game === 'string' ? request.query.game : 'war';
      const rows = await prisma.playerStat.findMany({
        where: { gameId },
        orderBy: [{ won: 'desc' }, { played: 'asc' }],
        take: 20,
        include: { user: { select: { displayName: true, avatarUrl: true } } },
      });
      response.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/matches/recent', async (request, response, next) => {
    try {
      const gameId = typeof request.query.game === 'string' ? request.query.game : undefined;
      const matches = await prisma.match.findMany({
        where: { gameId },
        orderBy: { endedAt: 'desc' },
        take: 12,
        include: { players: { orderBy: { placement: 'asc' } } },
      });
      response.json(matches.map((match) => ({ ...match, result: JSON.parse(match.resultJson), resultJson: undefined })));
    } catch (error) {
      next(error);
    }
  });
}

