// Deterministic MIDI → (string, fret) resolver. Pure module.
//
// Strategy (see specs/003-guitar-subway-scaler/research.md §1):
//   - Candidate per string: fret = midi - openMidi, accepted if 0 ≤ fret ≤ maxFret.
//   - With no prev position: pick the lowest-fret candidate (ties go to the higher string).
//   - With a prev position: pick the candidate whose (stringIdx, fret) is closest to prev
//     in Euclidean distance, with a small same-string bias subtracted when stringIdx matches.
//   - Returns null when no candidate is in range.

const SAME_STRING_BIAS = 0.5;

export function resolve(midi, prevPos, instrument) {
  const { tuning, maxFret } = instrument;
  const candidates = [];
  for (let s = 0; s < tuning.length; s++) {
    const fret = midi - tuning[s];
    if (fret >= 0 && fret <= maxFret) {
      candidates.push({ stringIdx: s, fret });
    }
  }
  if (candidates.length === 0) return null;

  if (prevPos == null) {
    // Lowest fret wins; tie → higher string index (closer to the played pitch's "natural" string).
    candidates.sort((a, b) => (a.fret - b.fret) || (b.stringIdx - a.stringIdx));
    return candidates[0];
  }

  let best = null;
  let bestCost = Infinity;
  for (const c of candidates) {
    const ds = c.stringIdx - prevPos.stringIdx;
    const df = c.fret - prevPos.fret;
    let cost = Math.sqrt(ds * ds + df * df);
    if (c.stringIdx === prevPos.stringIdx) cost -= SAME_STRING_BIAS;
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  return best;
}
