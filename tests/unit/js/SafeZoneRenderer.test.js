import { describe, it, expect, beforeEach } from 'vitest';
import { SafeZoneRenderer } from '../../../static/game/ui/SafeZoneRenderer.js';

const GUITAR = { id: 'guitar-standard', stringCount: 6 };
const BASS = { id: 'bass-4-standard', stringCount: 4 };

function makeScene() {
  const added = [];
  return {
    add: (m) => added.push(m),
    remove: () => {},
    _added: added,
  };
}

function makeWave(safe_string, safe_track = 0) {
  return {
    wave_id: `w-${safe_string}`,
    safe_track,
    safe_string,
    spawn_time_ms: 0,
    speed_px_per_ms: 0.1,
    duration_ms: 1000,
  };
}

// Tabulator: string 1 = highest pitch, string N = lowest pitch.
// Palette: idx 0 = Red = lowest string. So paletteIdx = stringCount - safe_string.
// Bass (4 strings): string 4 (E low) → idx 0 → Red, string 1 (G high) → idx 3 → Orange.
// Guitar (6 strings): string 6 (E low) → idx 0 → Red, string 1 (e high) → idx 5 → Purple.
describe('SafeZoneRenderer safe zone coloring', () => {
  it('guitar string 6 (E low) → Red (0xE53935)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(6)], 0, () => 0, 0, 0, GUITAR);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0xE53935);
  });

  it('guitar string 5 → Yellow (0xFDD835)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(5)], 0, () => 0, 0, 0, GUITAR);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0xFDD835);
  });

  it('guitar string 1 (e high) → Purple (0x8E24AA)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(1)], 0, () => 0, 0, 0, GUITAR);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0x8E24AA);
  });

  it('bass string 4 (E low) → Red (0xE53935)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(4)], 0, () => 0, 0, 0, BASS);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0xE53935);
  });

  it('bass string 1 (G high) → Orange (0xFB8C00)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(1)], 0, () => 0, 0, 0, BASS);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0xFB8C00);
  });

  it('null safe_string falls back to Red (idx 0)', () => {
    const renderer = new SafeZoneRenderer(makeScene());
    renderer.update([makeWave(null)], 0, () => 0, 0, 0, GUITAR);
    const mesh = [...renderer.zones.values()][0];
    expect(mesh.material.color.getHex()).toBe(0xE53935);
  });
});
