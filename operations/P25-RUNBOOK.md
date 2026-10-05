# P25 — Product UX, Accessibility & Final Quality Pass

P25 is an evidence-first release-quality pass over the P24-certified Gomoku client. It does not redesign the product. It audits the current simplified journeys, fixes reproduced issues, and turns those fixes into a release-blocking browser quality gate.

## Audited journeys

The Chromium audit runs at desktop (1440×1000) and mobile (390×844) sizes and captures screenshots for:

1. **first launch** — the real first-run welcome;
2. **local game** — the visible onboarding “2 players” path;
3. **first move** — board keyboard navigation and real streamlined placement;
4. **Improve** — the learning/course landing;
5. **Library** — empty/local collection state;
6. **Settings** — visible Menu → Settings path, including focus containment and return;
7. **Online** — visible Menu → Specialist tools → Online rooms path.

The test deliberately follows the current public UI instead of hidden legacy proxy controls.

## Accessibility checks

Every step runs Axe with WCAG 2.0/2.1/2.2 A/AA tags and custom checks for:

- accessible names;
- positive tabindex;
- duplicate IDs;
- focus containment and focus return for dialogs;
- board grid semantics;
- exactly one visible primary aria-current page;
- horizontal overflow;
- minimum 24×24 CSS-pixel target sizing outside the board;
- uncaught page errors.

The custom name check understands `aria-label`, `aria-labelledby`, native/wrapping `<label>` associations, text content, placeholders and values.

For WCAG 2.5.8 target size, checkbox/radio controls use the actual clickable associated label rectangle. Inline links inside prose use the WCAG inline-target exception instead of being falsely treated as standalone 24×24 buttons.

Any remaining audit finding fails `p25-ux-quality`.

## Reproduced production fixes

The baseline audit found two real issues after false-positive triage.

### Learn chapter-number contrast

On mobile, the large chapter numbers inside `.ui-course-art` measured **2.93:1** against their card background. Axe requires 3:1 for that large text.

P25 increases the chapter-number opacity to **0.78** in both the base rule and the later mobile override. The first repair changed only the base rule; Axe correctly caught that the mobile media query still reset it to 0.5. The final fix repairs the actual cascade while retaining the intended hierarchy.

### Competition Live / Archive targets

The tournament scope tabs measured only **20px high** on both desktop and mobile. P25 gives `.p9-scope-tabs button` a **28px minimum height**, preserving the compact segmented-control appearance while satisfying WCAG 2.5.8's 24px minimum target size.

## Findings that were not product defects

The first custom audit incorrectly reported several existing controls:

- Library Save title, Export JSON and Import JSON;
- Online room password and room code;
- Settings buttons;
- 18px checkboxes inside large clickable toggle rows;
- the inline “International Renju rules” link.

Axe did not report accessible-name failures for those controls. Source inspection confirmed native/wrapping labels and visible text were already present. P25 corrects the auditor rather than adding redundant ARIA or visually inflating controls that already have compliant clickable labels.

## Existing strengths preserved

P25 preserves the mature accessibility work already present:

- 15×15 board exposed as an ARIA grid;
- keyboard arrow navigation;
- board live announcements;
- labelled native dialogs;
- focus-visible styles;
- reduced-motion support;
- live status/toast regions;
- `aria-current` primary navigation;
- `aria-pressed` mode/filter states;
- visible mobile Menu routing rather than hidden desktop controls.

## Release boundary

P25 is a static-client/browser quality gate, like P22 and P24. It does not enter P16's Supabase/database admission list.

The candidate shell is rebuilt from `ui/` and `online/` source before the audit so generated HTML cannot hide a source-level regression.

The main-only `p25-deployed-quality` job waits until `https://thiepn.dev/gomoku/index.html` matches the exact generated client hash, then repeats the same desktop/mobile Axe and custom journey audit against production.

## Evidence limits

Passing P25 means the audited desktop/mobile Chromium journeys have no Axe WCAG 2.2 AA violations or P25 custom findings.

It is **not** a claim of complete accessibility conformance. Manual screen-reader testing (NVDA/JAWS/VoiceOver), cognitive usability testing, physical-device behavior, and broader assistive-technology combinations remain outside automated evidence and should be covered by human testing before any formal WCAG conformance statement.
