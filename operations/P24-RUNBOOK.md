# P24 — Browser, Device, Network & PWA Qualification

P24 expands P22's Chromium offline-shell proof into a broader client compatibility matrix. It keeps the boundary explicit: automated browser engines and device emulation are release evidence; physical Android/iPhone/Samsung testing remains a later human/device qualification and is **not** silently marked passed.

## Why P24 is separate

P22 repaired the service worker and proved one fresh Chromium profile could navigate documentation, return offline, reload offline and reconnect.

P23 then hardened the service-role backend security perimeter.

P24 focuses on the remaining client-runtime questions:

- does the app boot and remain interactive across Chromium, Firefox and WebKit?
- does the board/navigation survive desktop, narrow mobile and landscape layouts?
- do touch and keyboard board input remain correct?
- does local game state survive tab switching and offline/online transitions?
- can the PWA recover from cache eviction and a stale worker/cache generation?
- does the app remain usable under a deliberately high-latency cold load?
- did the exact tested client actually reach GitHub Pages?

## Automated browser/device matrix

The required CI matrix contains five profiles:

1. Chromium desktop, 1440×900.
2. Firefox desktop, 1440×900.
3. WebKit desktop, 1440×900.
4. Chromium using Playwright's Pixel 7 device descriptor (or the documented fallback dimensions if unavailable).
5. WebKit using Playwright's iPhone 13 device descriptor (or the documented fallback dimensions if unavailable).

Every profile must prove:

- UI boot completes;
- 225 board intersections exist;
- exactly three primary destinations remain available;
- Play / Improve / Library produce no document horizontal overflow;
- keyboard board navigation works;
- the center move can be selected and committed;
- mobile profiles expose touch input and keep confirmation reachable;
- mobile landscape and 360px narrow layouts do not overflow;
- game state survives a second-tab/background proxy;
- no uncaught page error is emitted.

WebKit is a Safari compatibility proxy, not branded Safari. Chromium mobile emulation is an Android Chrome compatibility proxy, not branded Samsung Internet.

## Chromium PWA and network lifecycle

Service-worker automation is intentionally isolated to Chromium.

The P24 network suite proves:

- active worker control and correct scope;
- a committed local move survives offline reload;
- network restoration preserves state;
- a second offline→online flap recovers;
- deleting the active Gomoku cache while online is repaired by the next navigation;
- the rebuilt cache supports the following offline launch;
- unregistering the worker plus seeding a stale `gomoku-*` cache is repaired by fresh worker activation;
- switching to another tab and back does not lose game state;
- a cold load with artificial per-request latency still reaches a usable, non-overflowing UI.

This builds on P22 rather than duplicating its service-worker unit model.

## Exact deployed qualification

Pull requests run against a local HTTP origin.

On `main`, P24 first waits until `https://thiepn.dev/gomoku/` serves the exact committed hashes for:

- `index.html`
- `sw.js`
- `manifest.webmanifest`

Only then does the same five-profile browser matrix run against the public deployment, followed by the Chromium PWA/network suite.

The aggregate main gate is `p24-deployed-qualified`.

## Physical-device boundary

The following remain explicitly `deferred_physical` in `operations/p24-qualification-matrix.json`:

- physical Android Chrome;
- physical Samsung Internet;
- physical iOS Safari;
- installed standalone PWA under real OS sleep/process-kill/storage-pressure conditions.

They are not release blockers during implementation because they require hardware/human testing. Emulation cannot prove radio handoff, vendor browser quirks, OS process eviction, thermal throttling, or device storage pressure.

## Relation to P16/P23

P24 does **not** enter `gomoku_p16_required_checks()`.

P16/P23 govern the Supabase backend/security release boundary. P24 protects the separately deployed GitHub Pages/browser artifact. The final stable-release phase can require both families of evidence without pretending a browser check is database admission evidence.
