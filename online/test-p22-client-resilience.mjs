import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const cache='gomoku-v12.5.0-p22-client-resilience-analysis-2.1.0-review-ux-2.1.0';
const sw=fs.readFileSync('sw.js','utf8');

for(const marker of [
  "const CACHE_NAME = '"+cache+"'",
  "const scopeURL = new URL('./', self.location.href)",
  "const shellURL = new URL('index.html', scopeURL).href",
  "if (!isShell) return",
  "cache.put(shellURL, response.clone()).catch(() => {})",
  "if (!assetPaths.has(url.pathname)) return",
  "cache.match(request, { ignoreSearch: true })",
  "return cached || response || Response.error()"
]) assert(sw.includes(marker),'P22 service worker missing '+marker);

assert(!sw.includes("cache.put('./index.html'"),'P22 must not cache arbitrary navigations as index.html');
assert(!/request\.mode\s*===\s*['"]navigate['"][\s\S]{0,400}cache\.put\(['"]\.\/index\.html/.test(sw),'P22 navigation cache poisoning pattern remains');

for(const file of ['ui/build.py','review/build.py','analysis/build.py']){
  const source=fs.readFileSync(file,'utf8');
  assert(source.includes(cache),file+' does not preserve the P22 cache version');
  assert(!source.includes('gomoku-v12.4.0-p17-preview-promotion-analysis-2.1.0-review-ux-2.1.0'),file+' can regress the service-worker cache version');
}

const unit=fs.readFileSync('audit/p22-service-worker.cjs','utf8');
for(const marker of ['documentation navigation cannot overwrite the game shell','HTTP 5xx navigation falls back','cache quota failure','sibling apps'])
  assert(unit.includes(marker),'P22 unit coverage missing '+marker);

const browser=fs.readFileSync('audit/p22-offline-browser.py','utf8');
for(const marker of ['context.set_offline(True)','documentation navigation is not replaced by the game shell','offline reload remains controlled and usable','p22-client-resilience'])
  assert(browser.includes(marker),'P22 browser coverage missing '+marker);

const workflow=fs.readFileSync('.github/workflows/verify-p22-client-resilience.yml','utf8');
for(const marker of [
  'name: p22-client-resilience',
  'node audit/p22-service-worker.cjs',
  'python audit/p22-offline-browser.py',
  'Verify exact deployed client artifacts',
  'https://thiepn.dev/gomoku/',
  'name: p22-deployed-offline'
]) assert(workflow.includes(marker),'P22 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P22 client workflow must not receive OIDC write permission');

const runbook=fs.readFileSync('operations/P22-RUNBOOK.md','utf8');
for(const marker of ['navigation cache poisoning','HTTP 5xx','CacheStorage','GitHub Pages','PR #4','P16'])
  assert(runbook.includes(marker),'P22 runbook missing '+marker);

console.log('PASS P22 contracts: scoped PWA caching, offline shell recovery, failure containment and exact deployed-client verification are wired.');
