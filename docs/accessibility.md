# Accessibility Compliance — Subway Scaler

**Standard:** WCAG 2.1 AA  
**Audit Date:** 2026-05-23  
**Story:** 4-5 — Touch Targets and Final Accessibility Audit

---

## 1. WCAG 2.1 AA Compliance Checklist

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| 1.1.1 Non-text Content | Alt text / aria-label for all non-decorative elements | ✅ Pass |
| 1.3.1 Info and Relationships | Semantic roles (form, radiogroup, radio, dialog) | ✅ Pass |
| 1.4.1 Use of Color | Error message uses ⚠ icon prefix + border, not color alone | ✅ Pass |
| 1.4.3 Contrast (Minimum) | All text ≥ 4.5:1, large text ≥ 3:1 | ✅ Pass |
| 1.4.11 Non-text Contrast | Focus indicators ≥ 3:1 | ✅ Pass |
| 2.1.1 Keyboard | All interactive elements keyboard-accessible | ✅ Pass |
| 2.4.3 Focus Order | Logical tab order: Scale → Difficulty → Instrument → START | ✅ Pass |
| 2.4.7 Focus Visible | :focus-visible outline on all interactive elements | ✅ Pass |
| 2.5.3 Label in Name | Button labels match visible text | ✅ Pass |
| 2.5.5 Target Size (AAA) | All interactive elements ≥ 44×44px | ✅ Pass |
| 4.1.2 Name, Role, Value | role, aria-checked, aria-label, aria-labelledby present | ✅ Pass |
| 4.1.3 Status Messages | Error uses role="alert" + aria-live="assertive" | ✅ Pass |

---

## 2. Colour Contrast Verification

Calculated using WCAG relative luminance formula: `(L1 + 0.05) / (L2 + 0.05)`

| Foreground | Background | Hex Pair | Ratio | AA (4.5:1) | AAA (7:1) |
|------------|------------|----------|-------|------------|-----------|
| ACCENT | BG_VOID | #FFB800 / #0D0D1A | **11.15:1** | ✅ | ✅ |
| TEXT_PRIMARY | BG_STAGE | #E8E8F0 / #1A1A2E | **13.97:1** | ✅ | ✅ |
| TEXT_PRIMARY | BG_VOID | #E8E8F0 / #0D0D1A | **15.77:1** | ✅ | ✅ |
| ACCENT | BG_NEAR | #FFB800 / #252538 | **8.04:1** | ✅ | ✅ |
| ACCENT | BG_STAGE | #FFB800 / #1A1A2E | **9.16:1** | ✅ | ✅ |
| Focus outline (ACCENT on BG_VOID) | — | #FFB800 / #0D0D1A | **11.15:1** | ✅ (≥3:1) | — |

All ratios verified mathematically and covered by unit tests in `tests/unit/js/accessibility.test.js`.

---

## 3. Touch Target Measurements

Minimum touch target: **44×44px** (WCAG 2.5.5 / Apple HIG / Material Design).

| Element | CSS Class | min-height | Padding (top+bottom) | Computed ≥ 44px |
|---------|-----------|------------|----------------------|-----------------|
| START button | `.start-button` | `44px` | `0.875rem × 2 = 28px` | ✅ ~52px |
| RESUME button | `.overlay-btn-primary` | `44px` | `0.875rem × 2 = 28px` | ✅ ~52px |
| RESTART button | `.overlay-btn-primary` | `44px` | `0.875rem × 2 = 28px` | ✅ ~52px |
| MAIN MENU button | `.overlay-btn-secondary` | `44px` | `0.75rem × 2 = 24px` | ✅ ~44px+ |
| Quit to Menu link | `.overlay-link` | `44px` (min-width: 44px) | `0.75rem × 2 = 24px` | ✅ explicit |
| Difficulty options | `.toggle-button` | `44px` | `0.75rem × 2 = 24px` | ✅ ~44px+ |
| Instrument options | `.toggle-button` | `44px` | `0.75rem × 2 = 24px` | ✅ ~44px+ |
| Scale `<select>` | `.form-group select` | `44px` | `0.75rem × 2 = 24px` | ✅ explicit |

All `min-height: 44px` values are present in `static/game/ui/setup.css` and `static/game/ui/overlays.css`.

---

## 4. axe DevTools Audit

axe DevTools must be run manually using the browser extension (Chrome/Firefox/Edge).

**Expected results based on ARIA structure verified in unit tests:**

### Setup Screen
- `role="form"` + `aria-label="Session Setup"` on form container
- `role="radiogroup"` on difficulty and instrument toggle groups
- `role="radio"` + `aria-checked` on all toggle buttons
- `<label>` elements linked to scale `<select>` via `for`/`id`
- Error message: `role="alert"` + `aria-live="assertive"`

**Expected:** Zero WCAG 2.1 AA violations  
**Canvas note:** Three.js `<canvas>` element renders game graphics. Any axe warning about "canvas text contrast" is non-applicable — the canvas is not an information display and contains no assistive text. Document as expected false positive.

### Pause Overlay
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on container
- RESUME button: `.overlay-btn-primary` with visible label
- Focus trap: Tab cycles between RESUME and Quit to Menu
- Escape key closes overlay

**Expected:** Zero WCAG 2.1 AA violations

### Game-Over Overlay
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on container
- Score announced via `role="status"` or equivalent
- RESTART / MAIN MENU buttons with visible labels

**Expected:** Zero WCAG 2.1 AA violations

---

## 5. Lighthouse Accessibility Audit

Run Chrome DevTools → Lighthouse → Accessibility on each surface.

**Expected scores:** ≥ 90 on setup screen, pause overlay, game-over overlay.

Factors contributing to high score:
- All interactive elements have accessible names
- Logical heading hierarchy
- Form elements have labels
- Sufficient colour contrast (11–15:1 ratios)
- No tabindex violations
- Focus indicators visible

---

## 6. Responsive Touch Layout

### Breakpoints

| Viewport | Layout | Toggle groups |
|----------|--------|---------------|
| ≤ 599px | Single column, `flex-direction: column` | Stack vertically |
| ≥ 600px | Two-column grid | Row layout |

CSS: `@media (max-width: 599px) { .toggle-group { flex-direction: column; } }`

### Gap between touch targets
- `.toggle-group` gap: `0.5rem` = 8px between toggle buttons ≥ 2px minimum
- `.overlay-buttons` gap: `0.75rem` = 12px between overlay buttons

### Manual testing checklist
- [ ] iPad portrait (iOS 15+): tap all buttons
- [ ] iPad landscape: tap all buttons
- [ ] Android tablet portrait/landscape
- [ ] Desktop Chrome with device emulation (≤ 600px, ≤ 320px)
- [ ] Verify no overlapping interactive elements

---

## 7. Error Message Accessibility

**Implementation in `static/game/ui/setup.js`:**
```html
<div class="error-message" role="alert" aria-live="assertive">
  Couldn't load session — check your connection and try again
</div>
```

**Visual distinction (WCAG 1.4.1 — not color alone):**
- CSS `::before { content: '⚠ ' }` — icon prefix independent of color
- `border: 2px solid var(--color-accent)` — structural distinction
- `background: rgba(255, 184, 0, 0.15)` — background tint

**Contrast:** #FFB800 on #0D0D1A = 11.15:1 ✅

**Screen reader behavior:** `role="alert"` causes immediate announcement on appearance without user interaction. `aria-live="assertive"` ensures the announcement interrupts the current reading flow.

---

## 8. Known Limitations

| Limitation | Reason | Mitigation |
|------------|--------|------------|
| Canvas game area not accessible | Three.js renders via WebGL/canvas; no DOM text | Accessible overlays (pause, game-over) provide all user-facing content |
| Canvas "text contrast" axe warning | Automated tools cannot inspect canvas pixel content | Documented as non-applicable false positive |
| Real device testing (iPad/Android) | CI cannot run on physical devices | Desktop touch emulation in Playwright covers layout regression |

---

## 9. Testing Methodology

- **Colour contrast:** Mathematical calculation via WCAG formula, unit-tested in `tests/unit/js/accessibility.test.js`
- **ARIA structure:** Unit tests in `tests/unit/js/accessibility.test.js` and `tests/unit/js/aria.test.js`
- **Touch targets:** CSS values inspected; `min-height: 44px` enforced in source
- **axe DevTools:** Manual browser tool (Chrome extension) — run on each screen state
- **Lighthouse:** Chrome DevTools → Lighthouse → Accessibility — run on each screen state
- **Touch devices:** Manual testing on real devices or Chrome DevTools emulation
