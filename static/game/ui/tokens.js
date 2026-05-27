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
  // NPC cart threat colour — reserved solely for hazard state signals.
  // Do NOT reuse for UI warnings, low-health indicators, or any non-hazard element.
  // ACCENT (0xFFB800) is reserved for world lighting (lampposts, story 7-3).
  DANGER:        0xFF2233,
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

// ===== SAFE ZONE FILL COLOURS (darkened string colours for translucent safe-zone planes) =====
// Indexed low→high pitch — same index as STRING_COLORS.
// Each value is a darkened variant of STRING_COLORS[i] for use as the translucent fill material.
// The opaque neon border uses STRING_COLORS[i] at full value.
export const STRING_SAFE_ZONE_FILLS = [
  0x330000, // 0 — Red    (darkened)
  0x332A00, // 1 — Yellow (darkened)
  0x001A33, // 2 — Blue   (darkened)
  0x331900, // 3 — Orange (darkened)
  0x003319, // 4 — Green  (darkened)
  0x260033, // 5 — Purple (darkened)
  0x330029, // 6 — Magenta(darkened)
  0x003333, // 7 — Teal   (darkened)
];

// Emissive intensity for safe-zone border LineBasicMaterial (full-brightness string colour).
// PROVISIONAL — retune after lamppost lighting (story 7-3) lands.
// Do NOT raise above 0.8 before testing with ACESFilmicToneMapping.
export const EMISSIVE_SAFE_ZONE_BORDER = 0.7;

// ===== STRING COLOUR LOOKUP =====
// Look up a string color by low→high index, clamping to instrument.stringCount.
export function colourForString(stringIdx, instrument) {
  if (stringIdx == null || typeof stringIdx !== 'number' || isNaN(stringIdx)) return STRING_COLORS[0];
  const stringCount = instrument?.stringCount ?? STRING_COLORS.length;
  if (stringCount <= 0) return STRING_COLORS[0];
  const cap = Math.min(stringCount, STRING_COLORS.length);
  const i = Math.max(0, Math.min(Math.floor(stringIdx), cap - 1));
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
    // Emit legacy 1-indexed names for backward compatibility (P6).
    root.style.setProperty(`--color-string-${i + 1}`, hexToCss(STRING_COLORS[i]));
  }
}

// ===== INTERNAL HELPER =====
function hexToCss(hexInt) {
  return '#' + hexInt.toString(16).padStart(6, '0').toUpperCase();
}
