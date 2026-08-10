import type { Express, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';
import { prisma } from './prisma.js';

const sessionCookie = 'alkval_games_session';
const signingKey = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionClaims {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

async function createToken(claims: SessionClaims, audience: 'web' | 'game'): Promise<string> {
  return new SignJWT({
    email: claims.email,
    displayName: claims.displayName,
    avatarUrl: claims.avatarUrl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer('games.alkval.com')
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(audience === 'web' ? '7d' : '6h')
    .sign(signingKey);
}

export async function readSession(request: Request): Promise<SessionClaims | null> {
  const token = request.cookies?.[sessionCookie] as string | undefined;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingKey, {
      issuer: 'games.alkval.com',
      audience: 'web',
    });

    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.displayName !== 'string') {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : null,
    };
  } catch {
    return null;
  }
}

export async function verifyGameToken(token: unknown): Promise<string | null> {
  if (typeof token !== 'string') return null;

  try {
    const { payload } = await jwtVerify(token, signingKey, {
      issuer: 'games.alkval.com',
      audience: 'game',
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function profileName(profile: Profile): string {
  return profile.displayName || [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(' ') || 'Player';
}

export function configureAuth(app: Express): void {
  const googleIsConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  app.use(passport.initialize());

  if (googleIsConfigured) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google did not return an email address'));

            const user = await prisma.user.upsert({
              where: { googleId: profile.id },
              update: {
                email,
                displayName: profileName(profile),
                avatarUrl: profile.photos?.[0]?.value,
              },
              create: {
                googleId: profile.id,
                email,
                displayName: profileName(profile),
                avatarUrl: profile.photos?.[0]?.value,
              },
            });
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        },
      ),
    );

    app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
    app.get(
      '/api/auth/google/callback',
      passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' }),
      async (request, response, next) => {
        try {
          const user = request.user as {
            id: string;
            email: string;
            displayName: string;
            avatarUrl: string | null;
          };
          const token = await createToken({ userId: user.id, ...user }, 'web');
          response.cookie(sessionCookie, token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          response.redirect('/');
        } catch (error) {
          next(error);
        }
      },
    );
  } else {
    app.get('/api/auth/google', (_request, response) => {
      response.status(503).json({ error: 'Google sign-in is not configured yet' });
    });
  }

  app.get('/api/auth/me', async (request: Request, response: Response) => {
    const session = await readSession(request);
    if (!session) {
      response.json({ user: null, gameToken: null, googleIsConfigured });
      return;
    }

    response.json({
      user: session,
      gameToken: await createToken(session, 'game'),
      googleIsConfigured,
    });
  });

  app.post('/api/auth/logout', (_request, response) => {
    response.clearCookie(sessionCookie, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    response.status(204).end();
  });
}

