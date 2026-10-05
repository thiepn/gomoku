import fs from 'node:fs';
const assert=(v,m)=>{if(!v)throw new Error(m);};
const audit=fs.readFileSync('audit/p25-product-quality.mjs','utf8');
for(const marker of ['@axe-core/playwright','wcag22aa','first-launch','play-after-move','improve-catalog','learning-dialog','guided-review','high-contrast-large-text','mobile-play','smallTargets','focusWalk','x.width<24||x.height<24','outlineWidth','page.screenshot'])
  assert(audit.includes(marker),'P25 audit missing '+marker);
const workflow=fs.readFileSync('.github/workflows/verify-p25-product-quality.yml','utf8');
for(const marker of ['name: p25-product-quality','@axe-core/playwright@4.13.0','playwright@1.62.0','node audit/p25-product-quality.mjs','p25-audit-output/','name: p25-deployed-quality','Verify exact deployed P25 artifact','https://thiepn.dev/gomoku/'])
  assert(workflow.includes(marker),'P25 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P25 must not receive OIDC write permission');
const runbook=fs.readFileSync('operations/P25-RUNBOOK.md','utf8').toLowerCase();
for(const marker of ['wcag 2.2','axe','keyboard','focus','target size','screenshots','first launch','play','improve','library','review','physical'])
  assert(runbook.includes(marker),'P25 runbook missing '+marker);
const p16=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(!p16.includes('p25_'),'P25 stays at the client/product-quality boundary');
console.log('PASS P25 source contracts.');

const studio=fs.readFileSync('ui/studio.js','utf8');
for(const marker of ["dialogLabelSequence","event.preventDefault()","boardGrid.focus()","uiRouteStatus","improve:'Improve'","modeGroup.setAttribute('role','group')"])
  assert(studio.includes(marker),'P25 Studio accessibility fix missing '+marker);
const css=fs.readFileSync('ui/studio.css','utf8');
for(const marker of ['#boardGrid:focus-visible','.ui-sr-only','opacity:.78'])
  assert(css.includes(marker),'P25 Studio CSS fix missing '+marker);
const competition=fs.readFileSync('online/p8-competition.css','utf8');
assert(competition.includes('.p9-scope-tabs button{border:0;border-radius:6px;background:transparent;color:var(--ink2);min-height:28px;padding:6px 10px'),'P25 competitive scope tabs remain below target floor');
const index=fs.readFileSync('index.html','utf8');
assert(index.includes('id="ch1Board" role="group"'),'P25 chapter-1 board must use honest group semantics');
const ch1=index.slice(index.indexOf('<script id="course-ch1-v1-script">'),index.indexOf('</script>',index.indexOf('<script id="course-ch1-v1-script">')));
assert(ch1.includes('id="ch1Board" role="group"'),'P25 chapter-1 script must render a labelled group');
assert(!ch1.includes("b.setAttribute('role','gridcell')"),'P25 chapter-1 board must not expose invalid gridcell hierarchy');
assert(index.includes('color:color-mix(in srgb,var(--ink2) 88%,var(--ink));font-size:7px'),'P25 chapter-1 progress text contrast fix missing');
assert(workflow.includes('python ui/build.py')&&workflow.includes('python online/build-p8-client.py')&&workflow.includes('git diff --exit-code -- index.html'),'P25 must verify generated shell parity');

assert(css.includes('#settingsDialog input[type="checkbox"]{width:24px;height:24px;min-width:24px'),'P25 settings checkboxes must meet the 24px target floor');
assert(css.includes('#settingsDialog a')&&css.includes('display:inline-flex')&&css.includes('min-height:24px'),'P25 settings links must meet the 24px target floor');
