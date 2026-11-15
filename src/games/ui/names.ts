/**
 * Game rules describe events with seat numbers ("Player 2 collected the trick.") because
 * they do not know who is sitting where. Boards show the real names instead.
 */
export function withPlayerNames(text: string, playerName: (id: string) => string): string {
  return text
    .replace(/Player (\d+)/g, (_match, seat: string) => playerName(String(Number(seat) - 1)))
    .replace(/\bYou (leads|starts)\b/g, (_match, verb: string) => `You ${verb.slice(0, -1)}`);
}

/** True once every seat has a named player. Practice tables and tests pass no seat data and count as ready. */
export function allSeatsTaken(matchData: Array<{ name?: string }> | undefined): boolean {
  return !matchData?.length || matchData.every((player) => Boolean(player.name));
}
