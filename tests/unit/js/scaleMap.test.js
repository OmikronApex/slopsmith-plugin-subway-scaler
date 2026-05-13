import { describe, it, expect } from 'vitest';
import { inScaleCells, pitchClassesFromMidis } from '../../../static/game/scaleMap.js';

const GUITAR = {
  id: 'guitar-standard',
  stringCount: 6,
  tuning: [40, 45, 50, 55, 59, 64],
  maxFret: 24,
};

const BASS = {
  id: 'bass-4-standard',
  stringCount: 4,
  tuning: [28, 33, 38, 43],
  maxFret: 24,
};

// Pitch classes of C major: C(0) D(2) E(4) F(5) G(7) A(9) B(11)
const C_MAJOR_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

describe('scaleMap.pitchClassesFromMidis', () => {
  it('reduces MIDI to pitch class set', () => {
    const pcs = pitchClassesFromMidis([60, 62, 64, 65, 67, 69, 71, 72]); // C major C4..C5
    expect(pcs).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });

  it('handles empty input', () => {
    expect(pitchClassesFromMidis([])).toEqual(new Set());
  });

  it('is safe for any non-negative MIDI', () => {
    expect(pitchClassesFromMidis([12, 24, 36, 48])).toEqual(new Set([0]));
  });
});

describe('scaleMap.inScaleCells', () => {
  it('empty pitch-class set yields no cells', () => {
    expect(inScaleCells(new Set(), GUITAR, { lo: 0, hi: 12 })).toEqual([]);
  });

  it('full chromatic set yields every (string, fret) in range', () => {
    const allPcs = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const cells = inScaleCells(allPcs, GUITAR, { lo: 0, hi: 4 });
    // 6 strings × 5 frets = 30 cells
    expect(cells).toHaveLength(6 * 5);
  });

  it('C major + guitar frets 0-4: includes expected cells, excludes out-of-scale cells', () => {
    const cells = inScaleCells(C_MAJOR_PCS, GUITAR, { lo: 0, hi: 4 });
    const has = (s, f) => cells.some(c => c.stringIdx === s && c.fret === f);
    // string 0 (E2 open, pc 4) → fret 0 (E), 1 (F), 3 (G) all in C major
    expect(has(0, 0)).toBe(true);
    expect(has(0, 1)).toBe(true);
    expect(has(0, 3)).toBe(true);
    // out-of-scale: fret 2 (F# pc 6) and fret 4 (G# pc 8)
    expect(has(0, 2)).toBe(false);
    expect(has(0, 4)).toBe(false);
  });

  it('result is sorted by (stringIdx ASC, fret ASC)', () => {
    const cells = inScaleCells(C_MAJOR_PCS, GUITAR, { lo: 0, hi: 12 });
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1];
      const b = cells[i];
      expect(b.stringIdx > a.stringIdx || (b.stringIdx === a.stringIdx && b.fret > a.fret)).toBe(true);
    }
  });

  it('US3: same pitch classes yield different cell sets for guitar vs bass', () => {
    const g = inScaleCells(C_MAJOR_PCS, GUITAR, { lo: 0, hi: 12 });
    const b = inScaleCells(C_MAJOR_PCS, BASS, { lo: 0, hi: 12 });
    // Different stringCount alone proves the sets differ; spot-check counts.
    const gOnRow = (s) => g.filter(c => c.stringIdx === s).length;
    const bOnRow = (s) => b.filter(c => c.stringIdx === s).length;
    // Bass has only 4 strings, so guitar must have cells on strings 4 and 5
    expect(gOnRow(4)).toBeGreaterThan(0);
    expect(gOnRow(5)).toBeGreaterThan(0);
    // And bass has no string 4
    expect(bOnRow(4)).toBe(0);
  });

  it('US2: yields cells on every string for a 7-note diatonic scale', () => {
    const cells = inScaleCells(C_MAJOR_PCS, GUITAR, { lo: 0, hi: 12 });
    for (let s = 0; s < GUITAR.stringCount; s++) {
      expect(cells.some(c => c.stringIdx === s)).toBe(true);
    }
  });

  it('US1 queue-index invariant: per-row cells are fret-ascending so consumers can use array index as queue index', () => {
    const cells = inScaleCells(C_MAJOR_PCS, GUITAR, { lo: 0, hi: 12 });
    // Group by stringIdx, verify fret monotonically increases within each group.
    const byString = new Map();
    for (const c of cells) {
      if (!byString.has(c.stringIdx)) byString.set(c.stringIdx, []);
      byString.get(c.stringIdx).push(c.fret);
    }
    for (const [, frets] of byString) {
      for (let i = 1; i < frets.length; i++) expect(frets[i]).toBeGreaterThan(frets[i - 1]);
    }
  });

  it('clamps range to [0, maxFret] when input is out of bounds', () => {
    const cells = inScaleCells(C_MAJOR_PCS, BASS, { lo: -5, hi: 100 });
    expect(cells.every(c => c.fret >= 0 && c.fret <= BASS.maxFret)).toBe(true);
  });
});
