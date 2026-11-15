export interface RoomSession {
  matchID: string;
  playerID: string;
  credentials: string;
  playerName: string;
}

const sessionKey = (game: string, matchID: string) => `${game}-room:${matchID}`;
const nameKey = (game: string) => `${game}-player-name`;

function read(key: string): string | null {
  try {
    // localStorage survives a closed tab or a phone dropping the page; older versions
    // used sessionStorage, which is still read so seats taken before the change keep working.
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadRoomSession(game: string, matchID: string | null): RoomSession | null {
  if (!matchID) return null;
  try {
    const saved = read(sessionKey(game, matchID));
    return saved ? JSON.parse(saved) as RoomSession : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(game: string, session: RoomSession): void {
  try {
    localStorage.setItem(sessionKey(game, session.matchID), JSON.stringify(session));
    localStorage.setItem(nameKey(game), session.playerName);
  } catch {
    /* storage unavailable: the seat still works until the tab closes */
  }
}

export function savedPlayerName(game: string): string {
  return read(nameKey(game)) ?? '';
}

/** A token issued now, so a page left open for hours still credits the signed-in player. */
export async function freshGameToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json() as { gameToken?: string | null };
    return data.gameToken ?? null;
  } catch {
    return null;
  }
}

export function roomErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/\b404\b/.test(message)) return 'That room does not exist any more. Ask for a new invite link.';
  if (/\b429\b/.test(message)) return 'You have opened a lot of rooms. Try again in a few minutes.';
  if (/\b409\b/.test(message)) return 'That seat was just taken. Try the invite link again.';
  if (/HTTP status/.test(message) || !message) return fallback;
  return message;
}
