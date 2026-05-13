# Quickstart: Guitar Subway Scaler (v2 — 45° camera + scale-only carts)

Manual acceptance for the audio + 3D path. Pure-JS modules (`fretboard.js`, `grid.js`, `scaleMap.js`) are covered by Vitest; this script verifies the wiring and the new visual rules.

## Prerequisites

- Slopsmith host running with the Subway Scaler plugin loaded.
- A microphone or a guitar / bass via an audio interface.
- 002 quickstart has been performed at least once (audio device permission granted).

## 1. Backend smoke

```bash
curl http://localhost:<host-port>/api/plugins/subway-scaler/instruments
curl http://localhost:<host-port>/api/plugins/subway-scaler/settings
```

Expect `guitar-standard` and `bass-4-standard`; settings include `instrumentId` and `strictTuning`. No new endpoints in v2.

## 2. Scene layout sanity

1. Open the Subway Scaler screen, instrument = "Guitar (Standard)", scale = "C major", root = C4.
2. Without starting a run, observe the scene.
3. The camera is angled **diagonally downward at 45°**: you can see both the lane separation (X) and the row depth (rows receding behind one another).
4. Each of the 6 rows shows carts **only at the (string, fret) cells whose pitch is in C major** within the 9-lane window centred on fret 0. Verify a few:
   - Row 0 (low E2 string): expect carts at fret 0 (E2 is not in C major — actually E IS in C major; expect cart). Frets 1 (F), 3 (G), 5 (A), 7 (B), 8 (C), 10 (D), 12 (E). Frets without carts: 2, 4, 6, 9, 11.
   - Row 5 (high E4 string): same pattern as row 0 shifted up two octaves; same pitch-class membership.
5. Within each row, carts are **queued behind one another** along the row's depth axis — none overlap or pile up.

**Pass criteria**: visible 45° angle; no carts at out-of-scale cells; no two carts in the same row overlap.

## 3. Switching scale updates the carts

1. Change the scale picker to "Minor Pentatonic" (5 notes per octave).
2. Without leaving the screen, the cart set updates: rows now show fewer carts than before (only pitch classes in the pentatonic).
3. Spot-check: no cart appears at a cell that produces a non-scale pitch.

**Pass criteria**: cart set updates immediately on scale change; new set is a strict subset of the previous one for a pentatonic relative to its parent diatonic.

## 4. Same-string lateral lane change (P1)

1. Set scale = "C major" again. Start a run.
2. Play E2 (low E open). Character lands on the cart at row 0, fret 0.
3. Play F2 (string 0 fret 1). Character performs a **lateral** hop right; remains on row 0.
4. Play G2 (string 0 fret 3). Another lateral hop. The lane window re-centres so the cart is visible.

**Pass criteria**: character moves between scale-cart positions in the same row; no row change; animation begins ≤ 50 ms after the HUD updates.

## 5. String-change row jump (P2)

1. Continuing the run, play A2 (string 1, fret 0).
2. Character performs a **row jump** to row 1 (A2 string) and lands on the cart at fret 0.
3. Play D3 (string 2, fret 0). Another row jump to row 2.

**Pass criteria**: row jumps are visibly taller/longer than lateral hops; each landing is on an existing scale cart.

## 6. Bass mode (P3)

1. Pause, return to menu. Switch instrument to "Bass 4-string (Standard)". Keep scale = C major.
2. Start a new run.
3. Confirm exactly **4 rows** are visible, each populated with scale-only carts.
4. Play E1 (string 0 open) → character lands on the leftmost cart of row 0.

**Pass criteria**: 4 rows; switching back to guitar restores 6.

## 7. Out-of-scale played note (sanity)

1. In C major guitar mode, play F#3 (MIDI 54, not in C major).
2. The resolver still resolves it to a fingering for the HUD, but no cart exists at that cell — the character either stays put or moves to the cell's spatial position without a cart underneath.
3. The HUD shows the note name.

**Pass criteria**: scene does not crash; clear visual signal that the note was off-scale (no cart to land on).

## 8. Out-of-range played note (sanity)

1. In guitar mode, play D2 (MIDI 38, below low E).
2. HUD shows "D2"; character does not move; no error.

## 9. Persistence

1. Reload the screen. Instrument picker reflects last selection; cart set repopulates for the persisted (scale, instrument) pair.
