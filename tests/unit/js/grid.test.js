import { describe, it, expect } from 'vitest';
import { laneX, rowZ, windowedLanes, LANE_X_SCALE, ROW_DZ, WINDOW, cameraFor45Deg } from '../../../static/game/grid.js';

describe('grid.laneX', () => {
  it('places the active fret at world-X 0', () => {
    for (const active of [0, 5, 12, 19]) {
      expect(laneX(active, active)).toBeCloseTo(0, 9);
    }
  });

  it('lower frets are to the left, higher frets to the right', () => {
    const active = 7;
    expect(laneX(active - 1, active)).toBeLessThan(0);
    expect(laneX(active + 1, active)).toBeGreaterThan(0);
  });

  it('lane X is monotonically increasing in fret', () => {
    const active = 7;
    const xs = [];
    for (let f = active - 4; f <= active + 4; f++) xs.push(laneX(f, active));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('uses linear spacing (all gaps are equal)', () => {
    const gap1 = laneX(1, 0) - laneX(0, 0);
    const gap2 = laneX(12, 0) - laneX(11, 0);
    expect(gap1).toBeCloseTo(gap2, 9);
  });
});

describe('grid.rowZ', () => {
  it('row 0 (lowest pitch / front) has the largest Z', () => {
    // front = closest to camera = largest Z given camera at +Z looking toward -Z.
    expect(rowZ(0)).toBeGreaterThan(rowZ(1));
    expect(rowZ(1)).toBeGreaterThan(rowZ(2));
  });

  it('rowZ(0) === 0', () => {
    expect(rowZ(0)).toBe(0);
  });

  it('row N-1 (back) is at the smallest Z', () => {
    expect(rowZ(5)).toBeLessThan(rowZ(0));
    expect(rowZ(5)).toBe(-5 * ROW_DZ);
  });
});

describe('grid.cameraFor45Deg', () => {
  it('Y drop equals Z distance to lookAt point (45° pitch invariant)', () => {
    const cam = cameraFor45Deg(8);
    // Y drop from camera to lookAt y=0 = cam.y; Z distance from cam to lookAt z = cam.z - cam.lookAt[2]
    const yDrop = cam.y;
    const zDist = cam.z - cam.lookAt[2];
    expect(yDrop).toBeCloseTo(zDist, 9);
  });

  it('camera sits at (0, distance, distance + lookAtZ)', () => {
    const cam = cameraFor45Deg(8, -2);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(8);
    expect(cam.z).toBe(6);
    expect(cam.lookAt).toEqual([0, 0, -2]);
  });
});

describe('grid.windowedLanes', () => {
  it('returns exactly WINDOW lanes centred on the active fret when interior', () => {
    const lanes = windowedLanes(10, 6, 24);
    expect(lanes).toHaveLength(WINDOW);
    expect(lanes[0].fret).toBe(10 - Math.floor(WINDOW / 2));
    expect(lanes[lanes.length - 1].fret).toBe(10 + Math.floor(WINDOW / 2));
  });

  it('clamps the window at the low end (no negative frets)', () => {
    const lanes = windowedLanes(0, 6, 24);
    expect(lanes[0].fret).toBe(0);
    expect(lanes).toHaveLength(WINDOW);
  });

  it('clamps the window at the high end (no frets > maxFret)', () => {
    const lanes = windowedLanes(24, 6, 24);
    expect(lanes[lanes.length - 1].fret).toBe(24);
    expect(lanes).toHaveLength(WINDOW);
  });
});
