import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const ui=fs.readFileSync('ui/studio.css','utf8');
assert(ui.includes('.ui-course-art>span')&&ui.includes('opacity:.78'),'P25 Learn chapter-number contrast repair missing');
assert(ui.includes('.ui-course-art>span{font-size:27px;left:12px;bottom:10px;opacity:.78;}'),'P25 mobile Learn chapter-number contrast override regressed');

const competition=fs.readFileSync('online/p8-competition.css','utf8');
assert(/\.p9-scope-tabs button\{[^}]*min-height:28px/.test(competition),'P25 Live/Archive target-size repair missing');

const audit=fs.readFileSync('audit/p25-ux-a11y.py','utf8');
for(const marker of [
  'e.labels?.length',
  "e.getAttribute('aria-labelledby')",
  "inlineTextLink=e=>e.matches('a[href]')",
  'clickableRect=e=>',
  "raise SystemExit('P25 audited journeys still contain '",
  "data-v111-action=\\\"settings\\\"",
  'data-v111-tool="online"'
]) assert(audit.includes(marker),'P25 audit hardening missing '+marker);

const workflow=fs.readFileSync('.github/workflows/verify-p25-ux-accessibility.yml','utf8');
for(const marker of [
  'name: P25 UX accessibility and quality gate',
  'name: p25-ux-quality',
  'python ui/build.py',
  'python online/build-p8-client.py',
  'axe-core@4.10.3',
  'python audit/p25-ux-a11y.py',
  'name: p25-deployed-quality',
  'Wait for exact P25 client on GitHub Pages',
  'https://thiepn.dev/gomoku/'
]) assert(workflow.includes(marker),'P25 workflow missing '+marker);

const runbook=fs.readFileSync('operations/P25-RUNBOOK.md','utf8');
for(const marker of ['first launch','local game','Improve','Library','Settings','Online','WCAG 2.2 AA','contrast','target','screen reader','physical'])
  assert(runbook.toLowerCase().includes(marker.toLowerCase()),'P25 runbook missing '+marker);

console.log('PASS P25 source contract: audited journeys, contrast, target sizing, semantic-name logic and release-blocking quality gate are wired.');
