// ===== COLORS EXPORT (JS hex integers for Three.js) =====
// WCAG 2.1 AA contrast audit (verified 2026-05-23, formula: (L1+0.05)/(L2+0.05)):
//   ACCENT (#FFB800) on BG_VOID (#0D0D1A):    11.15:1 — pass AA+AAA (≥4.5:1)
//   TEXT_PRIMARY (#E8E8F0) on BG_STAGE (#1A1A2E): 13.97:1 — pass AA+AAA
//   TEXT_PRIMARY (#E8E8F0) on BG_VOID (#0D0D1A):  15.77:1 — pass AA+AAA
//   ACCENT focus outline on BG_VOID:           11.15:1 — pass (≥3:1 required)
//   ACCENT on BG_NEAR (#252538):               8.04:1  — pass AA+AAA
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

// ===== STRING COLORS (Slopsmith / Rocksmith standard palette) =====
// Indexed low→high pitch. Index 0 = lowest pitch string of the instrument.
// Note: backend Note.string is 1-based from HIGH (tabulator convention);
// convert with `stringCount - note.string` before indexing this array,
// or use `colourForString` which expects the low→high index directly.
export const STRING_COLORS = [
  0xCC0000, // 0 — Red    (lowest pitch)
  0xCCA800, // 1 — Yellow
  0x0066CC, // 2 — Blue
  0xCC6600, // 3 — Orange
  0x00CC66, // 4 — Green
  0x9900CC, // 5 — Purple
  0xCC00AA, // 6 — Magenta
  0x00CCCC, // 7 — Teal
];

// Look up a string color by low→high index, clamping to instrument.stringCount.
export function colourForString(stringIdx, instrument) {
  const stringCount = instrument?.stringCount ?? STRING_COLORS.length;
  const cap = Math.min(stringCount, STRING_COLORS.length);
  const i = Math.max(0, Math.min(stringIdx, cap - 1));
  return STRING_COLORS[i];
}

// ===== CSS CUSTOM PROPERTY INJECTION =====
export function injectTokens() {
  const root = document.documentElement;

  // Night City palette
  root.style.setProperty('--color-bg-void', hexToCss(COLORS.BG_VOID));
  root.style.setProperty('--color-bg-stage', hexToCss(COLORS.BG_STAGE));
  root.style.setProperty('--color-bg-near', hexToCss(COLORS.BG_NEAR));
  root.style.setProperty('--color-accent', hexToCss(COLORS.ACCENT));
  root.style.setProperty('--color-text-primary', hexToCss(COLORS.TEXT_PRIMARY));
  root.style.setProperty('--color-text-disabled', hexToCss(COLORS.TEXT_DISABLED));
  root.style.setProperty('--color-edge', hexToCss(COLORS.EDGE));

  // String colors, low→high pitch (0..N-1).
  for (let i = 0; i < STRING_COLORS.length; i++) {
    root.style.setProperty(`--color-string-${i}`, hexToCss(STRING_COLORS[i]));
  }
}

// ===== INTERNAL HELPER =====
function hexToCss(hexInt) {
  return '#' + hexInt.toString(16).padStart(6, '0').toUpperCase();
}
