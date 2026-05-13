// Pure scale-cell filter for the Guitar Subway Scaler.
//
// For a given pitch-class set, instrument tuning, and fret range, return the
// (stringIdx, fret) cells whose produced MIDI value's pitch class is in the set.
// See specs/003-guitar-subway-scaler/research.md §7.

export function pitchClassesFromMidis(midis) {
  const out = new Set();
  for (const m of midis) out.add(((m % 12) + 12) % 12);
  return out;
}

export function inScaleCells(pitchClasses, instrument, fretRange) {
  if (!pitchClasses || pitchClasses.size === 0) return [];
  const { tuning, maxFret } = instrument;
  const lo = Math.max(0, fretRange.lo);
  const hi = Math.min(maxFret, fretRange.hi);
  const out = [];
  for (let s = 0; s < tuning.length; s++) {
    const openMidi = tuning[s];
    for (let f = lo; f <= hi; f++) {
      const pc = ((openMidi + f) % 12 + 12) % 12;
      if (pitchClasses.has(pc)) out.push({ stringIdx: s, fret: f });
    }
  }
  return out;
}
