# Phase 0 Research: Subway Scales

This document resolves the unknowns flagged in plan.md's Technical Context and records the rationale for the main design decisions before any code is written.

## R1. Pitch detection algorithm

- **Decision**: Implement YIN (de Cheveigné & Kawahara, 2002) directly in JavaScript, run inside an `AudioWorkletNode` at 44.1 kHz or 48 kHz with a 2048-sample analysis window, 1024-sample hop, and a default cumulative-mean-normalized-difference threshold of 0.10–0.15.
- **Rationale**: The spec (FR-004) names YIN explicitly. A 2048-sample window covers two periods at ~43 Hz and gives stable detection down to roughly E2 (82 Hz), which comfortably covers the C2–C7 range from the spec's assumptions. A 1024-sample hop at 48 kHz gives a fresh frequency estimate every ~21 ms — well inside the SC-001 latency budget. Running in an AudioWorklet keeps the main thread free for Three.js rendering (SC-005).
- **Alternatives considered**: FFT autocorrelation (cheaper but unreliable on instruments with strong harmonics — guitars and flutes both routinely octave-flip), McLeod Pitch Method / YIN-FFT variants (more accurate but more code), and external libraries like `pitchy` or `aubio.js` (introduce dependency surface that conflicts with constitution V). Plain YIN is the smallest implementation that meets the accuracy target in SC-002.

## R2. Note quantization and tolerance

- **Decision**: Convert detected frequency `f` to MIDI via `m = 69 + 12 * log2(f / 440)`, round to nearest integer for note identity, and compute cents offset as `100 * (m - round(m))`. A detection counts only if `|cents| ≤ tolerance` (default 50 cents, configurable down to 25). Confidence comes directly from YIN's aperiodicity value (`1 - d'`); reject frames with confidence < 0.8.
- **Rationale**: Standard 12-TET mapping (per Assumptions). A 50-cent default is exactly the midpoint between adjacent semitones and effectively says "the nearest semitone wins"; tightening it to 25 in calibration lets advanced players prove their intonation. The 0.8 confidence floor rejects silence and noisy transients without dropping legitimate sustained tones in normal room conditions.
- **Alternatives considered**: Fixed-Hz tolerance (rejected — cents are perceptually uniform across octaves); zero-crossing-rate confidence (rejected — fails on harmonic-rich tones). YIN's own aperiodicity is the natural confidence signal and costs nothing extra.

## R3. Note-acceptance gating (debounce)

- **Decision**: An expected note is accepted only after the detector reports the same pitch class for at least 3 consecutive frames (~60 ms) at confidence ≥ 0.8 and within tolerance. After a successful jump, the gate clears and starts watching for the next expected pitch.
- **Rationale**: Prevents pitch glides and bow/pick attacks from triggering false jumps (edge cases in spec). 60 ms is short enough to keep median latency under the 100 ms budget when added to YIN's ~21 ms hop and Three.js's ~16 ms frame.
- **Alternatives considered**: Single-frame acceptance (rejected — too jumpy on plucked-string attacks), longer 5-frame window (rejected — pushes p95 above 150 ms).

## R4. 3D rendering library

- **Decision**: Three.js loaded as an ES module from the plugin's `static/` directory (vendored, no CDN at runtime) and used directly — no framework wrapper.
- **Rationale**: Smallest mature library that covers cameras, lighting, glTF, and basic tweening; FR-002 requires a real 3D scene with moving carts and a jumping character, which would be tedious in raw WebGL. Vendoring keeps the plugin offline-capable (Assumptions).
- **Alternatives considered**: Babylon.js (heavier, more features than we need), raw WebGL/WebGPU (too much scaffolding for a small game), 2D canvas with parallax tricks (rejected — the spec calls out a 3D scene).

## R5. Audio capture pipeline

- **Decision**: Frontend: `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` → `MediaStreamAudioSourceNode` → custom `AudioWorkletNode` (running YIN) → `port.postMessage` to main thread with `{ frequency, confidence, timestamp }`. No `AnalyserNode`; YIN reads PCM directly.
- **Rationale**: Disabling browser DSP is critical — echo cancellation and noise suppression both wreck pitch detection by mangling steady-state tones. AudioWorklet runs in the audio-render thread so detection latency is bounded by the worklet's buffer (128 samples ≈ 2.7 ms) plus the YIN hop, not by main-thread scheduling. Posting only the per-hop result keeps message traffic low.
- **Alternatives considered**: `ScriptProcessorNode` (deprecated, runs on main thread, would jank the 3D scene), recording in the backend over WebSocket (rejected — adds round-trip latency that would blow SC-001 and introduces a backend audio dependency that conflicts with constitution V).

## R6. Persistence of settings

- **Decision**: Read/write a single JSON file at `data/settings.json` relative to the plugin directory via a tiny `services/settings.py` module. Schema is validated with Pydantic models reused from the API layer. Missing file → defaults; corrupt file → log a warning and overwrite with defaults.
- **Rationale**: FR-014 only needs to persist a handful of fields. A JSON file is the simplest thing that meets the requirement, requires no migrations, and matches the existing plugin's "no database" posture.
- **Alternatives considered**: SQLite (overkill), localStorage in the browser (rejected — settings should follow the host's notion of the user, which is on the Python side; also lets future Slopsmith multi-profile support drop in naturally).

## R7. Scale catalog

- **Decision**: Define scales as `(name, intervals_in_semitones_from_root)` tuples in `services/scales.py`. Ship: major, natural minor, harmonic minor, melodic minor (ascending), the seven diatonic modes, major pentatonic, minor pentatonic, and blues. Expand at request time into note sequences for a chosen root, octave start, and octave count (1 or 2). Optional descending pass appended client-side per difficulty.
- **Rationale**: Covers FR-001 ("at least major, natural minor, and the modes") with headroom and stays comfortably inside the "Scale" entity in the spec. Computing intervals server-side and shipping plain note arrays to the client keeps the frontend free of music theory.
- **Alternatives considered**: Full scale-theory library on the client (rejected — duplication and weight); hardcoded JSON of every (root, scale) combination (rejected — 84 entries hand-written invites typos).

## R8. Pause / resume semantics

- **Decision**: Pause stops the run state machine clock and `suspend()`s the `AudioContext`; resume calls `resume()` and restarts the clock. Window blur events trigger an auto-pause (edge case from spec).
- **Rationale**: Satisfies FR-015 and the "player tabs away" edge case without bespoke logic — `AudioContext.suspend/resume` is the right primitive and also stops the mic indicator in the host UI.
- **Alternatives considered**: Tearing down and rebuilding the worklet on each pause (rejected — adds latency on resume and re-prompts permission on some platforms).

## R9. Testing approach

- **Decision**: pytest + `fastapi.testclient.TestClient` for backend contract and integration tests. Vitest for pure-JS units (YIN, notes, scales, runState). Browser-integration tests are out of scope; the quickstart is the manual acceptance gate (see Complexity Tracking in plan.md).
- **Rationale**: Constitution principle II requires TDD; both runners are lightweight and standard in their ecosystems. YIN is easily unit-tested by feeding it synthesized sine and sawtooth buffers at known frequencies.
- **Alternatives considered**: Playwright with synthetic media streams (rejected — substantial harness for one acceptance scenario), full audio CI fixtures (rejected — same reason).

## R10. Strict-octave mode (FR-016)

- **Decision**: Default mode accepts any octave of the correct pitch class; strict mode requires the exact MIDI number shown on the incoming cart. Implemented as a single boolean in run config consulted by the acceptance gate.
- **Rationale**: Direct mapping of FR-016 with no hidden state.
- **Alternatives considered**: Tolerance in octaves (rejected — non-musical; players think in "same note" or "exact note").
