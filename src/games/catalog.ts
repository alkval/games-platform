import { MattisBoard } from './cardgames/mattis/MattisBoard';
import { MattisGame } from './cardgames/mattis/game';
import { WarBoard } from './cardgames/war/WarBoard';
import { WarGame } from './cardgames/war/game';
import { getGame, registerGame } from './registry';

if (!getGame('war')) {
  registerGame({
    id: 'war',
    name: 'War',
    category: 'card',
    description: 'Pick a card. Highest rank takes the trick. Most tricks wins.',
    minPlayers: 2,
    maxPlayers: 2,
    game: WarGame,
    board: WarBoard,
  });
}

if (!getGame('mattis')) {
  registerGame({
    id: 'mattis',
    name: 'Mattis',
    category: 'card',
    description: 'Collect strong cards, reveal trump, then race to shed your hand.',
    minPlayers: 2,
    maxPlayers: 6,
    game: MattisGame,
    board: MattisBoard,
  });
}
