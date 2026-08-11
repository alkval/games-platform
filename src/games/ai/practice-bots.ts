import type { PlayerID, State } from 'boardgame.io';
import { MCTSBot, RandomBot } from 'boardgame.io/ai';

export type Difficulty = 'easy' | 'normal' | 'hard';
type BotOptions = ConstructorParameters<typeof MCTSBot>[0];

function botDelay(gameName?: string): number {
  return gameName === 'war' ? 900 : gameName === 'mattis' ? 1650 : 450;
}

async function holdForReveal(startedAt: number, delay: number): Promise<void> {
  const remaining = delay - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export class EasyBot extends RandomBot {
  private readonly delay: number;
  constructor(options: BotOptions) { super(options); this.delay = botDelay(options.game.name); }
  async play(state: State, playerID: PlayerID) { const started = Date.now(); const result = await super.play(state, playerID); await holdForReveal(started, this.delay); return result; }
}

export class NormalBot extends MCTSBot {
  private readonly delay: number;
  constructor(options: BotOptions) { super({ ...options, iterations: 60, playoutDepth: 24 }); this.delay = botDelay(options.game.name); this.setOpt('async', true); }
  async play(state: State, playerID: PlayerID) { const started = Date.now(); const result = await super.play(state, playerID); await holdForReveal(started, this.delay); return result; }
}

export class HardBot extends MCTSBot {
  private readonly delay: number;
  constructor(options: BotOptions) { super({ ...options, iterations: 180, playoutDepth: 45 }); this.delay = botDelay(options.game.name); this.setOpt('async', true); }
  async play(state: State, playerID: PlayerID) { const started = Date.now(); const result = await super.play(state, playerID); await holdForReveal(started, this.delay); return result; }
}

export function practiceBot(difficulty: Difficulty) {
  return difficulty === 'easy' ? EasyBot : difficulty === 'normal' ? NormalBot : HardBot;
}
