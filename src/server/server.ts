import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WarGame } from '../games/cardgames/war/game.js';
import { MattisGame } from '../games/cardgames/mattis/game.js';
import { ChessGame } from '../games/boardgames/chess/game.js';
import { configureApi } from './api.js';
import { configureAuth } from './auth.js';
import { env } from './env.js';
import { PrismaGameStorage } from './game-storage.js';
import { prisma } from './prisma.js';
import { cleanupExpiredRooms, startRoomCleanup } from './room-cleanup.js';

const require = createRequire(import.meta.url);
const { Server } = require('boardgame.io/server') as typeof import('boardgame.io/server');

export function createExpressApp(): Express {
  const app = express();
  const clientDirectory = resolve(process.cwd(), 'dist');

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'alkval-games', revision: env.APP_REVISION, time: new Date().toISOString() });
  });

  configureAuth(app);
  configureApi(app);

  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory, { index: false, maxAge: env.NODE_ENV === 'production' ? '1h' : 0 }));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next();
      response.sendFile(resolve(clientDirectory, 'index.html'));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

function passToExpress(app: Express, context: Parameters<Parameters<ReturnType<typeof Server>['app']['use']>[0]>[0]): Promise<void> {
  context.status = 200;
  context.respond = false;

  return new Promise((resolvePromise, reject) => {
    let complete = false;
    const finish = (error?: unknown) => {
      if (complete) return;
      complete = true;
      context.res.off('finish', finish);
      context.res.off('close', finish);
      if (error) reject(error);
      else resolvePromise();
    };

    context.res.once('finish', finish);
    context.res.once('close', finish);
    app(
      context.req as unknown as express.Request,
      context.res as unknown as express.Response,
      (error) => finish(error),
    );
  });
}

export async function startServer(): Promise<() => Promise<void>> {
  const expressApp = createExpressApp();
  const storage = new PrismaGameStorage();
  const allowedOrigins = [env.APP_URL, /^http:\/\/localhost:\d+$/];
  const gameServer = Server({
    games: [WarGame, MattisGame, ChessGame],
    db: storage as never,
    origins: allowedOrigins,
    apiOrigins: allowedOrigins,
  });

  try {
    const expiredRooms = await cleanupExpiredRooms();
    if (expiredRooms) console.log(`Expired ${expiredRooms} abandoned game room${expiredRooms === 1 ? '' : 's'} on startup`);
  } catch (error) {
    console.error('Could not clean up expired game rooms on startup', error);
  }
  const stopRoomCleanup = startRoomCleanup();

  gameServer.app.use(async (context, next) => {
    if (context.path.startsWith('/api/')) {
      await passToExpress(expressApp, context);
      return;
    }

    await next();
    if (context.status === 404 && !context.body) {
      await passToExpress(expressApp, context);
    }
  });

  const runningServers = await gameServer.run(env.PORT, () => {
    console.log(`Games server listening on ${env.PORT}`);
  });

  return async () => {
    stopRoomCleanup();
    gameServer.kill(runningServers);
    await prisma.$disconnect();
  };
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMainModule) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
