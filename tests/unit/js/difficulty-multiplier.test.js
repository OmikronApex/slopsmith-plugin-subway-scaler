import { describe, it, expect } from 'vitest';
import { DIFFICULTY_MULTIPLIERS, BASE_SCORE } from '../../../static/game/GameState.js';

describe('DIFFICULTY_MULTIPLIERS', () => {
  it('easy = 1.0', () => {
    expect(DIFFICULTY_MULTIPLIERS.easy).toBe(1.0);
  });

  it('medium = 2.0', () => {
    expect(DIFFICULTY_MULTIPLIERS.medium).toBe(2.0);
  });

  it('hard = 3.0', () => {
    expect(DIFFICULTY_MULTIPLIERS.hard).toBe(3.0);
  });

  it('BASE_SCORE = 10', () => {
    expect(BASE_SCORE).toBe(10);
  });

  it.each([
    ['easy', 10],
    ['medium', 20],
    ['hard', 30],
  ])('%s awards %i per correct note', (difficulty, expected) => {
    const increment = Math.round(BASE_SCORE * DIFFICULTY_MULTIPLIERS[difficulty]);
    expect(increment).toBe(expected);
  });
});
