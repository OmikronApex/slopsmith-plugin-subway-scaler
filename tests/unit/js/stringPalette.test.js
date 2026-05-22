import { describe, it, expect } from 'vitest';
import { STRING_COLOURS, colourForString } from '../../../static/game/stringPalette.js';

const GUITAR = { id: 'guitar-standard', stringCount: 6 };
const BASS = { id: 'bass-4-standard', stringCount: 4 };

describe('stringPalette.STRING_COLOURS', () => {
  it('has 8 entries in low→high order (Red, Yellow, Blue, Orange, Green, Purple, Magenta, Teal)', () => {
    expect(STRING_COLOURS).toHaveLength(8);
    expect(STRING_COLOURS[0]).toBe(0xCC0000); // Red
    expect(STRING_COLOURS[1]).toBe(0xCCA800); // Yellow
    expect(STRING_COLOURS[2]).toBe(0x0066CC); // Blue
    expect(STRING_COLOURS[3]).toBe(0xCC6600); // Orange
    expect(STRING_COLOURS[4]).toBe(0x00CC66); // Green
    expect(STRING_COLOURS[5]).toBe(0x9900CC); // Purple
    expect(STRING_COLOURS[6]).toBe(0xCC00AA); // Magenta
    expect(STRING_COLOURS[7]).toBe(0x00CCCC); // Teal
  });
});

describe('stringPalette.colourForString', () => {
  it('guitar: string 0 → Red, string 5 → Purple', () => {
    expect(colourForString(0, GUITAR)).toBe(0xCC0000);
    expect(colourForString(5, GUITAR)).toBe(0x9900CC);
  });

  it('bass: string 0 → Red, string 3 → Orange (last valid)', () => {
    expect(colourForString(0, BASS)).toBe(0xCC0000);
    expect(colourForString(3, BASS)).toBe(0xCC6600);
  });

  it('bass: stringIdx > 3 clamps to last valid bass index (Orange)', () => {
    expect(colourForString(5, BASS)).toBe(0xCC6600);
    expect(colourForString(99, BASS)).toBe(0xCC6600);
  });

  it('guitar: stringIdx > 5 clamps to last valid (Purple)', () => {
    expect(colourForString(99, GUITAR)).toBe(0x9900CC);
  });

  it('negative stringIdx clamps to 0 (Red)', () => {
    expect(colourForString(-1, GUITAR)).toBe(0xCC0000);
  });

  it('null instrument falls back to full palette length (index 5 → Purple)', () => {
    expect(colourForString(5, null)).toBe(0x9900CC);
  });
});
