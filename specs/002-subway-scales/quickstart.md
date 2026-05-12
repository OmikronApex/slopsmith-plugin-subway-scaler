# Quickstart: Subway Scales

Manual end-to-end verification of the plugin. Per plan.md's Complexity Tracking entry, this quickstart is the acceptance gate for the audio + 3D path that cannot be automated.

## Prerequisites

- A running Slopsmith host with this plugin installed.
- A working audio input (built-in mic is fine) and an instrument that can produce single sustained pitches. A tuning app on your phone playing pure tones works too.
- A modern Chromium-based renderer with WebGL 2 and AudioWorklet support (the default Slopsmith chrome).

## 1. Start the host and open the plugin

1. Launch Slopsmith.
2. Open the **Subway Scaler** screen from the nav.
3. The status line should read `Subway Scaler is ready`. If it does not, check the host console for errors hitting `/api/plugins/subway_scaler/status`.

**Pass criterion**: the screen loads and the status line shows the ready message.

## 2. Pick a scale and start a run (User Story 1)

1. From the scale picker, select **C Major** at **Medium** difficulty, **1 octave**, **ascending only**.
2. Press **Start Run**. Grant microphone permission when prompted.
3. The 3D scene should appear: a cart with your character, a track stretching toward a cliff, and the next cart approaching from the side carrying a `D4` label.

**Pass criterion**: the 3D scene renders at a smooth frame rate; the current expected note is shown on-screen as `C4`, with `D4` on the incoming cart.

## 3. Play through the scale

1. Play (or sing) `C4`. The character should jump onto the incoming cart within ~100 ms of the note stabilising; the next expected note should advance to `D4`.
2. Continue with `D4, E4, F4, G4, A4, B4, C5`. Each correct note in time should advance the run.
3. On the final correct `C5`, the run should end in success with a visible success state.

**Pass criterion**: every correct note in time triggers a jump; the run ends in success.

## 4. Force a failure (acceptance scenario 2)

1. Start another run of C Major Medium.
2. When the expected note is `E4`, deliberately play `F4` and then stay silent until the timer expires.
3. The carts should fall off the cliff and the run should end in failure with a visible fail state.

**Pass criterion**: failure is shown; no further jumps are accepted after the cliff animation begins.

## 5. Tolerate slight timing (acceptance scenario 3)

1. Start C Major Easy.
2. Play each correct note either right at the start or near the end of its window.
3. All in-window correct notes should still trigger a jump.

**Pass criterion**: timing tolerance feels generous on Easy and tighter on Hard (run step 4 again on Hard to confirm the window shrinks visibly).

## 6. Strict-octave mode (FR-016)

1. Toggle **Strict octave** on.
2. Start C Major Medium with root `C4`.
3. When expected is `E4`, play `E5`. The detection should be visible (the tuner reads `E5`) but no jump should occur, and the deadline should expire into a failure.
4. Turn strict mode off and repeat — the `E5` should now count and trigger the jump.

**Pass criterion**: strict mode rejects octave-mismatched pitch classes; default mode accepts them.

## 7. Persistence (FR-014)

1. Change the scale to **A natural minor**, difficulty to **Hard**, and the input device label to your second mic (if any).
2. Close the screen, reload the host, and return to the plugin.
3. The previous selections should be pre-populated.

**Pass criterion**: settings survive a host restart.

## 8. Pause / resume (FR-015)

1. Start any run.
2. Press **Pause**. The cart movement should freeze and the microphone indicator in the host UI should drop.
3. Press **Resume**. The run continues from the same expected note with the same time remaining.

**Pass criterion**: pause halts state and audio; resume restores both cleanly.

## 9. Audio device + calibration (User Story 3)

1. Open **Audio Settings**.
2. Switch to an alternate input device. The live tuner readout should immediately reflect the new device's signal.
3. Play a sustained `A4` (440 Hz, e.g., from a phone tone generator). The displayed note should be `A4` with `|cents| ≤ tolerance`.

**Pass criterion**: device switching is live; tuner is accurate within tolerance.

## 10. Error handling (FR-012)

1. Deny microphone permission (or block the device at the OS level).
2. Attempt to start a run.
3. The plugin should show a clear "no microphone" message and not start the run.

**Pass criterion**: no crash, no silent failure, a human-readable error.

---

When all ten sections pass, the plugin meets the acceptance scenarios for User Stories 1, 2, and 3 and the success criteria SC-001 through SC-005 (SC-006 needs longitudinal play).
