// ===== COLORS EXPORT (JS hex integers for Three.js) =====
export const COLORS = {
  // Night City Palette (7 colors)
  BG_VOID:       0x0D0D1A,
  BG_STAGE:      0x1A1A2E,
  BG_NEAR:       0x252538,
  ACCENT:        0xFFB800,
  TEXT_PRIMARY:  0xE8E8F0,
  TEXT_DISABLED: 0x555570,
  EDGE:          0x08080F,
};

// ===== STRING COLORS EXPORT (1-indexed, for Rocksmith convention) =====
export const STRING_COLORS = {
  1: 0xFF3333,  // string 1 (high E), red
  2: 0xFFDD00,  // string 2 (B), yellow
  3: 0x3366FF,  // string 3 (G), blue
  4: 0xFF8800,  // string 4 (D), orange
  5: 0x33AA33,  // string 5 (A), green
  6: 0x9933CC,  // string 6 (low E), purple
  7: 0xFF66AA,  // string 7 (7-string low), pink
};

// ===== CSS CUSTOM PROPERTY INJECTION =====
export function injectTokens() {
  // Convert COLORS to CSS custom properties
  const root = document.documentElement;

  // Night City palette
  root.style.setProperty('--color-bg-void', hexToCss(COLORS.BG_VOID));
  root.style.setProperty('--color-bg-stage', hexToCss(COLORS.BG_STAGE));
  root.style.setProperty('--color-bg-near', hexToCss(COLORS.BG_NEAR));
  root.style.setProperty('--color-accent', hexToCss(COLORS.ACCENT));
  root.style.setProperty('--color-text-primary', hexToCss(COLORS.TEXT_PRIMARY));
  root.style.setProperty('--color-text-disabled', hexToCss(COLORS.TEXT_DISABLED));
  root.style.setProperty('--color-edge', hexToCss(COLORS.EDGE));

  // Rocksmith string colors (1-indexed)
  for (let i = 1; i <= 7; i++) {
    root.style.setProperty(`--color-string-${i}`, hexToCss(STRING_COLORS[i]));
  }
}

// ===== INTERNAL HELPER =====
function hexToCss(hexInt) {
  return '#' + hexInt.toString(16).padStart(6, '0').toUpperCase();
}
