// Mirror of services/scales.py expansion logic for offline UI / unit tests.
import { midiToName, midiToFrequency } from './notes.js';

function makeNote(midi) {
  return { midi, name: midiToName(midi), frequencyHz: midiToFrequency(midi) };
}

export function expand(scale, rootMidi, octaves = 1, descending = false) {
  const body = scale.intervals.slice(0, -1);
  const apex = scale.intervals[scale.intervals.length - 1];
  const midis = [];
  for (let k = 0; k < octaves; k++) {
    for (const iv of body) midis.push(rootMidi + iv + 12 * k);
  }
  midis.push(rootMidi + apex + 12 * (octaves - 1));
  if (descending) {
    for (let i = midis.length - 2; i >= 0; i--) midis.push(midis[i]);
  }
  return midis.map(makeNote);
}
