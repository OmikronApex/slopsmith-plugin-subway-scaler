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
  0xE53935, // Red
  0xFDD835, // Yellow
  0x1E88E5, // Blue
  0xFB8C00, // Orange
  0x43A047, // Green
  0x8E24AA, // Purple
];

export function colourForString(stringIdx, instrument) {
  const max = (instrument && instrument.stringCount) || STRING_COLOURS.length;
  const i = Math.max(0, Math.min(stringIdx, max - 1));
  return STRING_COLOURS[i];
}
