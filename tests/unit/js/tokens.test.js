import { describe, it, expect, beforeEach } from 'vitest';
import { COLORS, STRING_COLORS, colourForString, injectTokens } from '../../../static/game/ui/tokens.js';

describe('Design Token System', () => {
  describe('COLORS exports', () => {
    it('exports COLORS object', () => {
      expect(COLORS).toBeDefined();
      expect(typeof COLORS).toBe('object');
    });

    it('COLORS.BG_VOID equals 0x0D0D1A', () => {
      expect(COLORS.BG_VOID).toBe(0x0D0D1A);
    });

    it('COLORS.BG_STAGE equals 0x1A1A2E', () => {
      expect(COLORS.BG_STAGE).toBe(0x1A1A2E);
    });

    it('COLORS.BG_NEAR equals 0x252538', () => {
      expect(COLORS.BG_NEAR).toBe(0x252538);
    });

    it('COLORS.ACCENT equals 0xFFB800', () => {
      expect(COLORS.ACCENT).toBe(0xFFB800);
    });

    it('COLORS.TEXT_PRIMARY equals 0xE8E8F0', () => {
      expect(COLORS.TEXT_PRIMARY).toBe(0xE8E8F0);
    });

    it('COLORS.TEXT_DISABLED equals 0x555570', () => {
      expect(COLORS.TEXT_DISABLED).toBe(0x555570);
    });

    it('COLORS.EDGE equals 0x08080F', () => {
      expect(COLORS.EDGE).toBe(0x08080F);
    });

    it('COLORS has exactly 7 Night City palette properties', () => {
      const keys = Object.keys(COLORS);
      expect(keys).toHaveLength(7);
      expect(keys).toContain('BG_VOID');
      expect(keys).toContain('BG_STAGE');
      expect(keys).toContain('BG_NEAR');
      expect(keys).toContain('ACCENT');
      expect(keys).toContain('TEXT_PRIMARY');
      expect(keys).toContain('TEXT_DISABLED');
      expect(keys).toContain('EDGE');
    });
  });

  describe('STRING_COLORS (low→high pitch palette)', () => {
    it('is an array of 8 Rocksmith standard colors', () => {
      expect(Array.isArray(STRING_COLORS)).toBe(true);
      expect(STRING_COLORS).toHaveLength(8);
    });

    it('STRING_COLORS[0] is Red (lowest pitch)', () => {
      expect(STRING_COLORS[0]).toBe(0xCC0000);
    });

    it('STRING_COLORS[3] is Orange', () => {
      expect(STRING_COLORS[3]).toBe(0xCC6600);
    });

    it('STRING_COLORS[5] is Purple (highest pitch on 6-string)', () => {
      expect(STRING_COLORS[5]).toBe(0x9900CC);
    });
  });

  describe('colourForString', () => {
    const GUITAR = { stringCount: 6 };
    const BASS = { stringCount: 4 };

    it('returns the palette color at the given low→high index', () => {
      expect(colourForString(0, GUITAR)).toBe(0xCC0000);
      expect(colourForString(5, GUITAR)).toBe(0x9900CC);
    });

    it('clamps the index to instrument.stringCount - 1', () => {
      expect(colourForString(99, BASS)).toBe(0xCC6600); // bass max idx = 3 = orange
    });

    it('clamps negative indices to 0', () => {
      expect(colourForString(-1, GUITAR)).toBe(0xCC0000);
    });

    it('falls back to the full palette when instrument is null', () => {
      expect(colourForString(5, null)).toBe(0x9900CC);
    });
  });

  describe('injectTokens() function', () => {
    let mockRoot;

    beforeEach(() => {
      mockRoot = {
        style: {
          properties: {},
          setProperty(name, value) {
            this.properties[name] = value;
          },
        },
      };
      global.document = { documentElement: mockRoot };
    });

    it('exports injectTokens function', () => {
      expect(injectTokens).toBeDefined();
      expect(typeof injectTokens).toBe('function');
    });

    it('sets Night City CSS variables', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-bg-void']).toBe('#0D0D1A');
      expect(mockRoot.style.properties['--color-bg-stage']).toBe('#1A1A2E');
      expect(mockRoot.style.properties['--color-bg-near']).toBe('#252538');
      expect(mockRoot.style.properties['--color-accent']).toBe('#FFB800');
      expect(mockRoot.style.properties['--color-text-primary']).toBe('#E8E8F0');
      expect(mockRoot.style.properties['--color-text-disabled']).toBe('#555570');
      expect(mockRoot.style.properties['--color-edge']).toBe('#08080F');
    });

    it('sets one CSS variable per palette string (0..N-1)', () => {
      injectTokens();
      for (let i = 0; i < STRING_COLORS.length; i++) {
        const hex = '#' + STRING_COLORS[i].toString(16).padStart(6, '0').toUpperCase();
        expect(mockRoot.style.properties[`--color-string-${i}`]).toBe(hex);
      }
    });
  });
});
