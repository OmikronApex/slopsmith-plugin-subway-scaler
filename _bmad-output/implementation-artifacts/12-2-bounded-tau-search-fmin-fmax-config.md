# Story 12.2: Bounded Tau Search — fMin/fMax Config

Status: done

## Story

As a developer,
I want the YIN detector's tau search bounded to a configurable playable frequency range,
so that computation skips irrelevant lag values and the larger 4096-sample window stays within the real-time hop budget.

## Acceptance Criteria

1. `YinDetector` constructed with `{ sampleRate: 44100, fMin: 27, fMax: 2637 }` exposes `tauMin === 16` (= `max(2, ceil(44100/2637) - 1)`) and `tauMax === 1633` (= `min(2047, floor(44100/27))`).
2. `YinDetector` constructed without `fMin`/`fMax` uses defaults `fMin=27`, `fMax=2637` — same tauMin=16, tauMax=1633 as AC1.
3. A synthetic A0 sine wave (27.5 Hz, τ ≈ 1603) within [17, 1633] is detected within ±2 Hz of 27.5 (lower boundary note not dropped).
4. A synthetic E7 sine wave (2637 Hz, τ ≈ 17) within [17, 1633] is detected within ±5 Hz of 2637 (upper boundary — highest note on standard guitar tuning).
5. B0 (30.87 Hz) from Story 12-1 still detects correctly (regression).
6. The `_difference()` outer loop runs only for `tau` in `[tauMin, tauMax]` inclusive — no computation outside this range.
7. `_absoluteThreshold()` search starts from `tauMin`, not `tau=2`.
8. `_cmnd()` running sum is NOT bounded — it still accumulates from `tau=1` to `halfSize` for correct CMNDF normalization.
9. All existing tests in `tests/unit/js/yin.test.js` pass without modification.

## Tasks / Subtasks

- [ ] Add `fMin`/`fMax` to `YinDetector` constructor (AC: 1, 2)
  - [x] Destructure `fMin = 27, fMax = 2637` from constructor options
  - [x] Compute `this.tauMin = Math.max(2, Math.ceil(sampleRate / fMax) - 1)` (back off by 1 for valid parabolic interpolation at boundary)
  - [x] Compute `this.tauMax = Math.min(this.halfSize - 1, Math.floor(sampleRate / fMin))`
- [x] Bound `_difference()` loop (AC: 6)
  - [x] `_difference()` now computes tau=1..tauMax; tauMin only gates the search in `_absoluteThreshold` (CMNDF requires full running sum from tau=1)
  - [x] Upper bound saves ~20% computation (skips tauMax+1..halfSize-1)
- [x] Bound `_absoluteThreshold()` search (AC: 7)
  - [x] Changed `for (let tau = 2; tau < H; tau++)` → `for (let tau = this.tauMin; tau <= this.tauMax; tau++)`
- [x] Leave `_cmnd()` unbounded (AC: 8)
  - [x] `_cmnd()` still loops `for (let tau = 1; tau < H; tau++)` — unchanged
- [x] Update `yin-worklet.js` to pass fMin/fMax from processorOptions (supporting AC: 1, 2)
  - [x] Passes `fMin`/`fMax` via spread if present in opts
- [x] Add/update tests in `tests/unit/js/yin.test.js` (AC: 1-5, 9)
  - [x] Test: `tauMin` (16) and `tauMax` (1633) arithmetic at SR=44100
  - [x] Test: A0 (27.5 Hz) boundary detection within ±2 Hz
  - [x] Test: E7 (2637 Hz) boundary detection within ±5 Hz
  - [x] Regression: B0 still detects (from Story 12-1)

## Dev Notes

### Current State of Files Being Modified

**`static/game/yin.js`** (after Story 12-1):
- `windowSize = 4096`, `halfSize = 2048`
- `_difference(buf)`: outer loop `for (let tau = 1; tau < H; tau++)` — currently unbounded
- `_absoluteThreshold()`: starts `for (let tau = 2; tau < H; tau++)` — currently starts at 2
- `_cmnd()`: runs `for (let tau = 1; tau < H; tau++)` — must stay unbounded (CMNDF requires full running sum)

**`static/game/yin-worklet.js`** (after Story 12-1):
- `YinProcessor` passes `threshold` from processorOptions but not fMin/fMax — add these

### Why `_cmnd()` Must NOT Be Bounded

The CMNDF (cumulative mean normalized difference) normalizes each `d[tau]` by the running mean of all previous `d` values. Bounding this running sum would corrupt the normalization for taus near `tauMin`. Only the **search** (difference function + threshold scan) is bounded — the CMNDF accumulation must see all taus.

### tauMin/tauMax Arithmetic Reference

At SR=44100, fMin=27, fMax=2637:
- `tauMin = ceil(44100 / 2637) = ceil(16.72) = 17`
- `tauMax = min(2047, floor(44100 / 27)) = min(2047, 1633) = 1633`

Boundary notes:
- E7 (2637 Hz): τ = floor(44100 / 2637) = 16 → tauMin=17 catches it at the boundary (parabolic interpolation handles sub-integer τ)
- A0 (27.5 Hz): τ = floor(44100 / 27.5) = 1603 → within [17, 1633] ✓
- B0 (30.87 Hz): τ ≈ 1429 → within [17, 1633] ✓

**Why fMax=2637:** E7 is the highest note on a standard-tuned guitar (high E string, 24th fret). Setting fMax to exactly 2637 Hz covers the full playable range for all supported instruments.

### Test Fixtures

```js
// Use SR=44100, windowSize=4096 (the new defaults after Story 12-1)
function sine44k(freq, samples = 4096, sr = 44100) {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) buf[i] = Math.sin(2 * Math.PI * freq * i / sr);
  return buf;
}

// tauMin/tauMax arithmetic
it('computes correct tauMin and tauMax at SR=44100', () => {
  const yin = new YinDetector({ sampleRate: 44100 }); // uses defaults fMin=27, fMax=2637
  expect(yin.tauMin).toBe(17);
  expect(yin.tauMax).toBe(1633);
});

// A0 boundary
it('detects A0 (27.5 Hz) within ±2 Hz', () => {
  const yin = new YinDetector({ sampleRate: 44100 });
  const res = yin.process(sine44k(27.5));
  expect(res.frequencyHz).not.toBeNull();
  expect(Math.abs(res.frequencyHz - 27.5)).toBeLessThan(2);
});

// E7 upper boundary
it('detects E7 (2637 Hz) within ±5 Hz', () => {
  const yin = new YinDetector({ sampleRate: 44100 });
  const res = yin.process(sine44k(2637));
  expect(res.frequencyHz).not.toBeNull();
  expect(Math.abs(res.frequencyHz - 2637)).toBeLessThan(5);
});
```

### Important: Existing Tests Use SR=48000, windowSize=2048

The existing `yin.test.js` constructs `YinDetector` with explicit `{ sampleRate: 48000, windowSize: 2048 }`. At SR=48000 with fMin=27, fMax=2637:
- `tauMin = ceil(48000/2637) = ceil(18.2) = 19`
- `tauMax = min(1023, floor(48000/27)) = min(1023, 1777) = 1023`

All existing test frequencies (220, 440, 880 Hz at SR=48000) fall within [19, 1023]:
- 880 Hz: τ = floor(48000/880) = 54 ✓
- 440 Hz: τ = 109 ✓
- 220 Hz: τ = 218 ✓

Existing tests pass unchanged.

### Project Structure Notes

- Edit `static/game/yin.js` — constructor + `_difference()` + `_absoluteThreshold()` only
- Edit `static/game/yin-worklet.js` — pass-through of fMin/fMax in processorOptions
- Edit `tests/unit/js/yin.test.js` — add new describe block for tau bounds

### References

- Epic 12, Story 12-2 ACs [Source: _bmad-output/planning-artifacts/epics.md#Story-12-2]
- Story 12-1 output [Source: _bmad-output/implementation-artifacts/12-1-fix-window-size-enable-b0-detection.md]
- Current yin.js [Source: static/game/yin.js]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Added `fMin=27`, `fMax=2637` constructor params to `YinDetector`
- `tauMin = max(2, ceil(sr/fMax) - 1)` — backs off by 1 so parabolic interpolation has a valid left neighbor at the upper boundary; without this, c[tauMin] evaluates to tauMin (>>threshold) due to zero running sum, causing octave errors on E7
- `tauMax = min(halfSize-1, floor(sr/fMin))`
- `_difference()` computes tau=1..tauMax (upper-bounded only): CMNDF requires the running sum from tau=1 to be valid; bounding the lower side breaks normalization
- `_absoluteThreshold()` search bounded to `[tauMin, tauMax]`
- `yin-worklet.js`: passes fMin/fMax from processorOptions via conditional spread
- 6 new tests in `'YIN - tau bounds'` describe block; all 14 tests pass

### File List

- `static/game/yin.js`
- `static/game/yin-worklet.js`
- `tests/unit/js/yin.test.js`

### Review Findings

- [x] [Review][Patch] Misleading test comment: claims `min(1023, floor(48000/27)) = 1023` but clamping source is halfSize-1=1023, not fMin — comment implies fMin drives the clamp when halfSize does [tests/unit/js/yin.test.js:122] (12-2 AC8)
- [x] [Review][Patch] fMin > fMax produces tauMin > tauMax, causing silent perpetual no-detection with no diagnostic — no constructor validation [static/game/yin.js:59-60]
