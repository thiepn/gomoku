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


// A long-lived frozen release SHA eventually has >100 checks because scheduled
// P16/P26 jobs accumulate. Force the sole governance check onto page two.
import {spawnSync} from 'node:child_process';
const p16PaginationProbe=`
const names=['p15','governance','p13','ranked','lifecycle','history','profiles','integrity','portable-preview','p19-supply-chain','p20-slo','p21-capacity','p23-security'];
const record=(name,i)=>({name,id:i,status:'completed',conclusion:'success',started_at:'2026-10-08T09:00:00Z',completed_at:'2026-10-08T09:00:01Z'});
const first=names.filter(x=>x!=='governance').map(record);
while(first.length<100)first.push(record('unrelated-check-'+first.length,first.length));
let calls=0;
globalThis.fetch=async url=>{
  calls++;
  const page=new URL(url).searchParams.get('page');
  const check_runs=page==='1'?first:page==='2'?[record('governance',101)]:[];
  return {ok:true,json:async()=>({total_count:101,check_runs})};
};
await import('./operations/p16-await-checks.mjs');
if(calls!==2)throw Error('Expected both check-runs pages; observed '+calls);
`;
const p16Probe=spawnSync(process.execPath,['--input-type=module','--eval',p16PaginationProbe],{
  cwd:process.cwd(),encoding:'utf8',timeout:5000,
  env:{...process.env,GITHUB_REPOSITORY:'thiepn/gomoku',GITHUB_SHA:config.candidate_source_sha,GITHUB_TOKEN:'test-only-token'}
});
assert(p16Probe.status===0,'P16 check-run pagination must preserve governance on page two: '+String(p16Probe.stderr||p16Probe.error||''));
assert(config.allowed_p26_paths.includes('operations/p16-await-checks.mjs'),'P16 release-control exception must be explicit and narrowly scoped');

console.log('PASS P26 release-candidate, burn-in and physical-device contracts.');
