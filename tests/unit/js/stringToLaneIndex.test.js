import { describe, it, expect } from 'vitest';
import { stringToLaneIndex } from '../../../static/game/ui/tokens.js';

describe('stringToLaneIndex', () => {
  it('6-string: string 1 (high E, tabulator 1-based) → lane 5 (0-based low→high)', () => {
    expect(stringToLaneIndex(1, 6)).toBe(5);
  });

  it('6-string: string 6 (low E, tabulator) → lane 0 (bottom)', () => {
    expect(stringToLaneIndex(6, 6)).toBe(0);
  });

  it('4-string: string 1 (high) → lane 3', () => {
    expect(stringToLaneIndex(1, 4)).toBe(3);
  });

  it('4-string: string 4 (low) → lane 0', () => {
    expect(stringToLaneIndex(4, 4)).toBe(0);
  });

  it('null string returns 0 (safe fallback)', () => {
    expect(stringToLaneIndex(null, 6)).toBe(0);
  });

  it('undefined string returns 0 (safe fallback)', () => {
    expect(stringToLaneIndex(undefined, 6)).toBe(0);
  });

  it('string=0 returns stringCount (out-of-range high result)', () => {
    expect(stringToLaneIndex(0, 6)).toBe(6);
  });

  it('stringCount=6, string=6 returns 0 (lowest lane)', () => {
    expect(stringToLaneIndex(6, 6)).toBe(0);
  });

  it('clamps negative result to 0', () => {
    expect(stringToLaneIndex(7, 6)).toBe(0);
  });
});