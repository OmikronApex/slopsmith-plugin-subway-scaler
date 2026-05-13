# Quickstart: Guitar Subway Scaler (v5 — one cart per row + Rocksmith colours)

Manual acceptance for the audio + 3D path. Pure modules covered by Vitest.

## Prerequisites

- Slopsmith host running with the plugin loaded.
- A microphone or guitar/bass via interface.
- 002 quickstart performed once (audio device permission granted).

## 1. Backend smoke

```bash
curl http://localhost:<host-port>/api/plugins/subway-scaler/instruments
curl http://localhost:<host-port>/api/plugins/subway-scaler/settings
```

Expect `guitar-standard` + `bass-4-standard`; settings include `instrumentId`, `strictTuning`. No new endpoints in v5.

## 2. One cart per row

1. Open the Subway Scaler screen, instrument = "Guitar (Standard)", scale = C major, root = C4.
2. Press Start Run.
3. Count visible cart rows. Each upcoming note must have its **own row** — no row contains two carts (even for consecutive same-string notes).

**Pass criteria**: For `VISIBLE_ROWS = 6`, expect 6 distinct rows of single carts on screen at start.

## 3. Lanes ordered by fret (low → high, left → right)

1. With the queue from §2 visible, observe the track planks under the carts.
2. Confirm each distinct fret used by the visible queue has one plank, and planks are arranged ascending by fret from left (lowest) to right (highest).

**Pass criteria**: Plank count equals the count of distinct frets across the 6 visible carts; left-to-right order is fret-ascending.

## 4. Rocksmith string colours

1. Play a scale that uses multiple strings (e.g. C major across the neck).
2. As carts come into view, confirm cart **body** colours match the palette:
   - String 0 → Red
   - String 1 → Yellow
   - String 2 → Blue
   - String 3 → Orange
   - String 4 → Green
   - String 5 → Purple
3. Confirm cart **roofs** are a uniform dark gray for every cart.

**Pass criteria**: Body colour matches the palette index for the cart's string; all roofs identical dark gray.

## 5. Bass mode (4-colour palette)

1. Return to menu, switch instrument to "Bass 4-string (Standard)".
2. Start a run.
3. Verify only Red / Yellow / Blue / Orange appear on cart bodies — no Green or Purple.

## 6. Queue advance on accept

1. With a run in progress, play the front-row note correctly.
2. Front row disappears; the row immediately behind shifts forward to become the new front; a new cart appears at the tail (if more upcoming).
3. Character slides laterally (X-only) to the new front cart's lane. No vertical motion.

**Pass criteria**: Always one cart per row before and after the advance; character Y constant.

## 7. Out-of-range slot

1. Pick a scale containing a note below the instrument's lowest open string (rare).
2. Confirm its slot in the queue is empty (no cart) but still occupies a Z row — subsequent rows do not shift forward to fill it.

## 8. Camera invariant

1. Throughout play, check the horizon: the camera does not bob, tilt, or shift Y.
