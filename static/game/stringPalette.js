// Slopsmith / Rocksmith standard string colour palette.
// Indexed low→high pitch (string 0 = lowest).
//
//   0 → Red
//   1 → Yellow
//   2 → Blue
//   3 → Orange
//   4 → Green
//   5 → Purple
//
// Bass (4 strings) uses indices 0..3 only.

export const STRING_COLOURS = [
  0xCC0000, // Red
  0xCCA800, // Yellow
  0x0066CC, // Blue
  0xCC6600, // Orange
  0x00CC66, // Green
  0x9900CC, // Purple
  0xCC00AA, // Magenta
  0x00CCCC, // Teal
];

export function colourForString(stringIdx, instrument) {
  const max = (instrument && instrument.stringCount) || STRING_COLOURS.length;
  const i = Math.max(0, Math.min(stringIdx, max - 1));
  return STRING_COLOURS[i];
}
