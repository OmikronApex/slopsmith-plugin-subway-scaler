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
    // START OF SCALE: Prefer lowest pitch string (index 0) to anchor the box.
    // If multiple strings can play it, the lowest string (String 0) wins.
    candidates.sort((a, b) => a.stringIdx - b.stringIdx);
    const first = candidates[0];
    return { ...first, anchorFret: first.fret };
  }

  const anchorFret = prevPos.anchorFret;
  let best = null;
  let bestCost = Infinity;

  for (const c of candidates) {
    const ds = Math.abs(c.stringIdx - prevPos.stringIdx);
    const df = Math.abs(c.fret - prevPos.fret);
    
    // Penalty for leaving the 4-fret box anchored at the start of the scale.
    const boxDist = Math.abs(c.fret - anchorFret);
    const boxPenalty = boxDist > 4 ? (boxDist - 4) * 20 : 0;
    
    // Cost function: prioritize staying in the box, then minimize string jumps.
    let cost = boxPenalty + (ds * 5) + df;
    
    // Small bias to stay on same string if multiple candidates in box
    if (c.stringIdx === prevPos.stringIdx) cost -= 0.5;

    if (cost < bestCost) {
      bestCost = cost;
      best = { ...c, anchorFret };
    }
  }
  return best;
}
