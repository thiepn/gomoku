import fs from 'node:fs';
const assert=(v,m)=>{if(!v)throw new Error(m);};
const audit=fs.readFileSync('audit/p25-ux-accessibility.py','utf8');
for(const marker of [
  "wcag22aa","first keyboard stop is skip link","focused skip link is visible",
  "visible non-board pointer targets meet 24px minimum","visible buttons have accessible names",
  "Escape closes settings dialog","settings returns focus to visible menu trigger",
  "route change is announced without moving focus","page.screenshot","Pixel 7"
]) assert(audit.includes(marker),'P25 audit missing '+marker);
const workflow=fs.readFileSync('.github/workflows/verify-p25-ux-accessibility.yml','utf8');
for(const marker of [
  'name: p25-desktop','name: p25-mobile','axe-core@4.13.0',
  'playwright==1.62.0','p25-test-output','p25-ux-accessibility',
  'https://thiepn.dev/gomoku/','Verify exact deployed P25 artifact'
]) assert(workflow.includes(marker),'P25 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P25 client quality workflow must not receive OIDC write permission');
const css=fs.readFileSync('ui/studio.css','utf8');
assert(css.includes(':focus-visible'),'P25 requires explicit visible focus styling');
assert(css.includes('#boardGrid:focus-visible'),'P25 skip target requires visible grid focus');
assert(css.includes('.ui-sr-only'),'P25 route announcements require a visually-hidden utility');
const studio=fs.readFileSync('ui/studio.js','utf8');
for(const marker of ["boardGrid.tabIndex=-1","uiRouteStatus","role','status","aria-atomic","dialogLabelSequence"])
  assert(studio.includes(marker),'P25 durable UI source missing '+marker);
assert(css.includes('prefers-reduced-motion:reduce'),'P25 requires reduced-motion handling');
assert(css.includes('forced-colors:active'),'P25 requires forced-colors support');
const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(!waiter.includes("p25_"),'P25 belongs to the static-client quality boundary, not P16 backend admission');
console.log('PASS P25 audit contract: WCAG 2.2 AA automation, keyboard/focus/target checks and exact deployed qualification are wired.');
