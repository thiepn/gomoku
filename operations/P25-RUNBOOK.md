# P25 — Product UX, Accessibility & Final Quality Pass

P25 is a quality phase, not a redesign. The current Gomoku visual identity and information architecture remain in place unless a measured user-facing defect requires a change.

## Baseline

The automated minimum is WCAG 2.2 AA where an automated rule exists. Axe-core 4.13.0 is pinned for deterministic CI. Manual browser assertions cover important behavior that axe alone cannot establish: skip-link order and focus transfer, visible focus, SPA route announcements, keyboard move placement, visible Menu → Settings navigation and focus restoration, dialog Escape behavior, accessible button names and WCAG 2.5.8 minimum target sizing outside the spatial board control.

The board's individual intersections are intentionally excluded from the generic 24 × 24 target-size check because a coordinate board is a spatial-position input. On coarse pointers the separate Place control remains the confirmation target.

## Journeys captured

Each P25 run saves screenshots and audit JSON for:

1. Play / first usable surface.
2. Improve.
3. Library.
4. Settings dialog.

Desktop and Pixel-class mobile profiles run independently. Screenshots are evidence for the product-quality pass; automated accessibility results are emitted with the same artifact.

## Release boundary

The aggregate source gate is `p25-ux-accessibility`.

On `main`, `p25-deployed-quality` waits until the public `index.html` byte-for-byte matches the tested commit, then reruns desktop and mobile audits against `https://thiepn.dev/gomoku/`.

P25 remains outside P16 because P16 is the Supabase/backend release-admission plane. P25 protects the static browser product, like P22 and P24.

## Scope limits

Automated accessibility checks do not establish full legal or human assistive-technology conformance. Physical screen-reader testing, speech control, switch control, browser zoom beyond automated checks and real-device vendor behavior remain human/device evidence. P25 is intended to eliminate known automated violations and high-confidence interaction defects before the stable-release phase.

## P25 fixes

The quality pass adds three durable interaction fixes in `ui/studio.js` / `ui/studio.css`:

- the skip link now transfers keyboard focus to the board grid and the grid has an explicit visible focus ring;
- Play / Learn / Library SPA route changes announce the new section through a polite atomic status region without stealing keyboard focus;
- dynamically added dialogs receive a stable accessible name fallback when older feature modules omitted one.

The audit opens Settings through the visible Menu instead of reaching through the hidden legacy settings proxy, and verifies focus returns to the visible menu trigger after Escape.
