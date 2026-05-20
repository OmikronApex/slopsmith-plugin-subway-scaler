// Red-phase ATDD scaffold — Story 1.3: Design Token System

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { COLORS, STRING_COLORS, injectTokens } from '../../../static/game/ui/tokens.js';

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

  describe('STRING_COLORS exports', () => {
    it('exports STRING_COLORS object', () => {
      expect(STRING_COLORS).toBeDefined();
      expect(typeof STRING_COLORS).toBe('object');
    });

    it('STRING_COLORS[1] equals 0xFF3333', () => {
      expect(STRING_COLORS[1]).toBe(0xFF3333);
    });

    it('STRING_COLORS[2] equals 0xFFDD00', () => {
      expect(STRING_COLORS[2]).toBe(0xFFDD00);
    });

    it('STRING_COLORS[3] equals 0x3366FF', () => {
      expect(STRING_COLORS[3]).toBe(0x3366FF);
    });

    it('STRING_COLORS[4] equals 0xFF8800', () => {
      expect(STRING_COLORS[4]).toBe(0xFF8800);
    });

    it('STRING_COLORS[5] equals 0x33AA33', () => {
      expect(STRING_COLORS[5]).toBe(0x33AA33);
    });

    it('STRING_COLORS[6] equals 0x9933CC', () => {
      expect(STRING_COLORS[6]).toBe(0x9933CC);
    });

    it('STRING_COLORS[7] equals 0xFF66AA', () => {
      expect(STRING_COLORS[7]).toBe(0xFF66AA);
    });

    it('STRING_COLORS has exactly 7 string colors (indices 1-7)', () => {
      const keys = Object.keys(STRING_COLORS).map(Number);
      expect(keys).toHaveLength(7);
      for (let i = 1; i <= 7; i++) {
        expect(keys).toContain(i);
      }
    });
  });

  describe('injectTokens() function', () => {
    let mockRoot;

    beforeEach(() => {
      // Mock document.documentElement with a simple object for testing
      mockRoot = {
        style: {
          properties: {},
          setProperty(name, value) {
            this.properties[name] = value;
          },
        },
      };

      // Temporarily replace document.documentElement for testing
      global.document = {
        documentElement: mockRoot,
      };
    });

    it('exports injectTokens function', () => {
      expect(injectTokens).toBeDefined();
      expect(typeof injectTokens).toBe('function');
    });

    it('injectTokens() sets --color-bg-void', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-bg-void']).toBe('#0D0D1A');
    });

    it('injectTokens() sets --color-bg-stage', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-bg-stage']).toBe('#1A1A2E');
    });

    it('injectTokens() sets --color-bg-near', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-bg-near']).toBe('#252538');
    });

    it('injectTokens() sets --color-accent', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-accent']).toBe('#FFB800');
    });

    it('injectTokens() sets --color-text-primary', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-text-primary']).toBe('#E8E8F0');
    });

    it('injectTokens() sets --color-text-disabled', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-text-disabled']).toBe('#555570');
    });

    it('injectTokens() sets --color-edge', () => {
      injectTokens();
      expect(mockRoot.style.properties['--color-edge']).toBe('#08080F');
    });

    it('injectTokens() sets all 7 string color custom properties (1-7)', () => {
      injectTokens();
      const expectedColors = {
        1: '#FF3333',
        2: '#FFDD00',
        3: '#3366FF',
        4: '#FF8800',
        5: '#33AA33',
        6: '#9933CC',
        7: '#FF66AA',
      };

      for (let i = 1; i <= 7; i++) {
        expect(mockRoot.style.properties[`--color-string-${i}`]).toBe(expectedColors[i]);
      }
    });

    it('injectTokens() custom properties match COLORS hex values', () => {
      injectTokens();

      const checks = [
        { prop: '--color-bg-void', expected: '#0D0D1A' },
        { prop: '--color-bg-stage', expected: '#1A1A2E' },
        { prop: '--color-bg-near', expected: '#252538' },
        { prop: '--color-accent', expected: '#FFB800' },
        { prop: '--color-text-primary', expected: '#E8E8F0' },
        { prop: '--color-text-disabled', expected: '#555570' },
        { prop: '--color-edge', expected: '#08080F' },
      ];

      checks.forEach(({ prop, expected }) => {
        expect(mockRoot.style.properties[prop]).toBe(expected);
      });
    });
  });
});
