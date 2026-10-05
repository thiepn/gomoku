import fs from 'node:fs';
const assert=(value,message)=>{if(!value)throw new Error(message);};

const config=JSON.parse(fs.readFileSync('operations/p26-release-candidate.json','utf8'));
assert(config.version==='p26.release-candidate.v1','P26 candidate contract version missing');
assert(/^[0-9a-f]{40}$/.test(config.candidate_source_sha),'P26 candidate must pin an immutable SHA');
assert(config.minimum_burn_in_hours===24,'P26 should use the 24-hour burn-in');
assert(config.policy?.mode==='defect-only','P26 must remain defect-only');
assert(config.policy?.product_changes_invalidate_candidate===true,'P26 must invalidate the RC on product changes');
assert(config.policy?.automated_emulation_does_not_satisfy_physical_profiles===true,'P26 must not convert emulation into physical-device evidence');

const matrix=JSON.parse(fs.readFileSync('operations/p26-device-matrix.json','utf8'));
const required=new Set(config.required_physical_profiles);
for(const id of ['android-chrome-physical','samsung-internet-physical','android-installed-pwa'])
  assert(required.has(id),'P26 required physical profile missing '+id);
for(const profile of matrix.profiles){
  assert(['pending_manual','pass','fail','blocked'].includes(profile.status),'P26 invalid physical status '+profile.id);
  if(profile.status==='pending_manual')assert(!profile.evidence?.tested_at,'Pending manual profile must not contain invented test time: '+profile.id);
}

const script=fs.readFileSync('operations/p26-release-candidate.mjs','utf8');
for(const marker of ['merge-base','diff','Immutable P26 artifact changed','pending_manual','releaseReady','verifyDeployed','release-ready'])
  assert(script.includes(marker),'P26 release-candidate guard missing '+marker);

const workflow=fs.readFileSync('.github/workflows/verify-p26-release-candidate.yml','utf8');
for(const marker of ['schedule:',"cron: '43 */6 * * *'",'node operations/p26-release-candidate.mjs validate','node operations/p26-release-candidate.mjs deployed-status','fetch-depth: 0'])
  assert(workflow.includes(marker),'P26 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P26 receives no OIDC/deployment authority');

const runbook=fs.readFileSync('operations/P26-RUNBOOK.md','utf8').toLowerCase();
for(const marker of ['defect-only','physical device','24-hour','candidate invalidation','p27','cannot be inferred'])
  assert(runbook.includes(marker),'P26 runbook missing '+marker);

console.log('PASS P26 release-candidate, burn-in and physical-device contracts.');
