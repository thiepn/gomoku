import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const matrix=JSON.parse(fs.readFileSync('operations/p24-qualification-matrix.json','utf8'));
assert(matrix.version==='p24.qualification-matrix.v1','P24 matrix version mismatch');
assert(matrix.automatedRequired.length===5,'P24 must retain five automated browser/device profiles');
for(const id of ['chromium-desktop','firefox-desktop','webkit-desktop','chromium-android','webkit-ios'])
  assert(matrix.automatedRequired.some(x=>x.id===id),'P24 missing automated profile '+id);
assert(matrix.deferredPhysical.length===4,'P24 physical-device backlog must remain explicit');
assert(matrix.deferredPhysical.every(x=>x.status==='deferred_physical'&&x.blockingNow===false),'P24 must not mislabel deferred physical devices as certified');
assert(matrix.nonClaims.some(x=>x.includes('not physical-device certifications')),'P24 emulation disclaimer missing');

const browser=fs.readFileSync('audit/p24-browser-matrix.py','utf8');
for(const marker of [
  "'chromium-desktop'","'firefox-desktop'","'webkit-desktop'","'chromium-android'","'webkit-ios'",
  "service_workers':'block'",
  "touchCapabilityObserved",
  "keyboard commit path remains available",
  "state survives tab/background proxy",
  "First-run onboarding is intentionally asynchronous",
  "close_dialogs(page)",
  "landscape proxy has no horizontal overflow",
  "360px narrow proxy has no horizontal overflow",
  "produced no uncaught page errors"
]) assert(browser.includes(marker),'P24 browser matrix missing '+marker);

const pwa=fs.readFileSync('audit/p24-pwa-network.py','utf8');
for(const marker of [
  "service_workers='allow'",
  'document.body.dataset.ready==="true"',
  "game.mode='local'",
  "context.set_offline(True)",
  "offline reload preserves committed local game state",
  "second offline-online flap recovers without state loss",
  "online navigation reconstructs a missing Gomoku shell cache",
  "gomoku-p24-stale-fixture",
  "high-latency cold-load proxy"
]) assert(pwa.includes(marker),'P24 PWA/network suite missing '+marker);

const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert(manifest.display==='standalone','P24 requires standalone PWA display mode');
assert(manifest.start_url==='./'&&manifest.scope==='./','P24 PWA start_url/scope must remain relative to Gomoku deployment root');
assert(Array.isArray(manifest.icons)&&manifest.icons.some(x=>x.purpose==='maskable'),'P24 requires a maskable install icon');

const workflow=fs.readFileSync('.github/workflows/verify-p24-browser-device-network.yml','utf8');
for(const marker of [
  'name: p24-browser-matrix',
  'name: p24-pwa-network',
  'name: p24-deployed-qualified',
  'playwright==1.62.0',
  'chromium-desktop',
  'firefox-desktop',
  'webkit-desktop',
  'chromium-android',
  'webkit-ios',
  'Verify exact deployed P24 artifacts',
  'https://thiepn.dev/gomoku/',
  'python audit/p24-pwa-network.py'
]) assert(workflow.includes(marker),'P24 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P24 client qualification must not receive OIDC write permission');

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(!waiter.includes("p24_"),'P24 must remain at the static-client/browser release boundary rather than P16 backend admission');

const runbook=fs.readFileSync('operations/P24-RUNBOOK.md','utf8'),runbookLower=runbook.toLowerCase();
for(const marker of ['chromium','firefox','webkit','physical-device','samsung internet','offline','high-latency','p22','p23'])
  assert(runbookLower.includes(marker),'P24 runbook missing '+marker);

console.log('PASS P24 contracts: cross-browser, mobile-emulation, Chromium PWA/network lifecycle and exact deployed qualification are wired without claiming physical-device coverage.');
