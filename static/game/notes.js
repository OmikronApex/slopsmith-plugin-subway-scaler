// Pitch ↔ MIDI ↔ note-name helpers. 12-TET, A4 = 440 Hz.

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi) {
  const m = Math.round(midi);
  return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

export function quantize(freq) {
  if (!freq || !isFinite(freq) || freq <= 0) return null;
  const m = frequencyToMidi(freq);
  const rounded = Math.round(m);
  const cents = 100 * (m - rounded);
  return {
    midi: rounded,
    name: midiToName(rounded),
    centsOffset: cents,
  };
}
