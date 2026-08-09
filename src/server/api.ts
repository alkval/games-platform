import type { Express } from 'express';
import { prisma } from './prisma.js';

export function configureApi(app: Express): void {
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

