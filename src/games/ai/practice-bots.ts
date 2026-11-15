import type { PlayerID, State } from 'boardgame.io';
import { MCTSBot, RandomBot } from 'boardgame.io/ai';
import { chooseChessMove } from '../boardgames/chess/engine';

export type Difficulty = 'easy' | 'normal' | 'hard';
type BotOptions = ConstructorParameters<typeof MCTSBot>[0];
type BotAction = { payload: { args?: unknown[] } };

function botDelay(gameName?: string): number {
  return gameName === 'war' ? 900 : gameName === 'mattis' ? 1650 : 450;
}

async function holdForReveal(startedAt: number, delay: number): Promise<void> {
  const remaining = delay - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

/**
 * The games keep every player "active" so anyone can resign or give up on another
 * player's turn. boardgame.io's bots do not cope with that on their own:
 *  - the local master asks only the first bot seat to play, whoever's turn it is, and
 *  - the search bot's playouts follow the first active player instead of the one to move.
 * So one bot plays for whichever computer seat is actually to move (seat 0 is always the
 * human in practice), waits when it is the human's turn, and searches on a copy of the
 * game and state without the "everyone is active" setting.
 */
function searchGame(game: BotOptions['game']): BotOptions['game'] {
  return { ...game, turn: { ...game.turn, activePlayers: undefined } };
}

function searchState(state: State): State {
  return { ...state, ctx: { ...state.ctx, activePlayers: null } };
}

async function playTurn<BotPlay>(
  bot: RandomBot | MCTSBot,
  fallback: (state: State, playerID: PlayerID) => Promise<BotPlay>,
  state: State,
  askedSeat: PlayerID,
  gameName: string | undefined,
  chessDepth: number,
): Promise<BotPlay> {
  const seats = [askedSeat, ...Object.keys(state.ctx.activePlayers ?? {}).filter((seat) => seat !== askedSeat && seat !== '0')];
  let playerID = askedSeat;
  let actions: BotAction[] = [];
  for (const seat of seats) {
    actions = bot.enumerate(state.G, state.ctx, seat) as unknown as BotAction[];
    if (actions.length) { playerID = seat; break; }
  }
  // Not a computer seat's turn: wait. The next state update asks again.
  if (!actions.length) return new Promise<BotPlay>(() => {});

  const startedAt = Date.now();
  let result: BotPlay;
  // Chess above Easy uses a real search; random playouts were slow and could not tell good moves from bad.
  const chessMove = gameName === 'chess' && chessDepth > 0
    ? (await new Promise((resolve) => setTimeout(resolve, 0)), chooseChessMove((state.G as { fen: string }).fen, chessDepth, chessDepth >= 3 ? 1200 : 500))
    : null;
  if (chessMove) {
    const action = actions.find(({ payload }) => payload.args?.[0] === chessMove.from && payload.args?.[1] === chessMove.to && payload.args?.[2] === (chessMove.promotion ?? 'q')) ?? actions[0];
    result = { action } as unknown as BotPlay;
  } else {
    result = await fallback(searchState(state), playerID);
  }
  await holdForReveal(startedAt, botDelay(gameName));
  return result;
}

export class EasyBot extends RandomBot {
  private readonly gameName?: string;
  constructor(options: BotOptions) { super(options); this.gameName = options.game.name; }
  async play(state: State, playerID: PlayerID) { return playTurn(this, (s, id) => super.play(s, id), state, playerID, this.gameName, 0); }
}

export class NormalBot extends MCTSBot {
  private readonly gameName?: string;
  constructor(options: BotOptions) { super({ ...options, game: searchGame(options.game), iterations: 60, playoutDepth: 24 }); this.gameName = options.game.name; this.setOpt('async', true); }
  async play(state: State, playerID: PlayerID) { return playTurn(this, (s, id) => super.play(s, id), state, playerID, this.gameName, 2); }
}

export class HardBot extends MCTSBot {
  private readonly gameName?: string;
  constructor(options: BotOptions) { super({ ...options, game: searchGame(options.game), iterations: 180, playoutDepth: 45 }); this.gameName = options.game.name; this.setOpt('async', true); }
  async play(state: State, playerID: PlayerID) { return playTurn(this, (s, id) => super.play(s, id), state, playerID, this.gameName, 3); }
}

export function practiceBot(difficulty: Difficulty) {
  return difficulty === 'easy' ? EasyBot : difficulty === 'normal' ? NormalBot : HardBot;
}
