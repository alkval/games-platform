export const botNames = ['Craig', 'Hubert', 'Eugene', 'Montgomery', 'Cornelius'] as const;

export function practicePlayerName(playerID: number): string {
  return playerID === 0 ? 'You' : botNames[playerID - 1] ?? `Computer ${playerID}`;
}

