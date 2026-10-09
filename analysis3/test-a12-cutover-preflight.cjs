'use strict';
const assert=require('node:assert/strict'),A=require('./a12-cutover-preflight.cjs');
const C=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const h='b'.repeat(64),a='a'.repeat(40),b='c'.repeat(40);
function fixture(){
 const a11={format:'GomokuAnalysis3A11Admission',status:'ready-for-independent-release-review',
  sourceSha:LOCK.sourceSha,offlineZipSha256:LOCK.offlineZipSha256,physicalCases:{required:18,passed:18},
  issues:[],canMerge:false,canTag:false,canDeployProduction:false,stages:{
   source:'locked-a9-automation',preview:'eight-assets-match-receipt-documentary',
   physical:'documented-18-of-18-not-independently-retested',
   controlledUpdate:'documented-not-independently-retested',rollback:'documented-not-independently-retested',
   owner:'documented-approved-not-production-authorized'}};
 const review={status:'independently-verified',sourceSha:LOCK.sourceSha,a11HeadSha:b,
  reviewer:'SYNTHETIC ONLY',reviewedAt:'2026-10-09T16:00:00Z',physicalCases:18,
  hostProbeDigest:h,swUpdateDigest:h,restoreDigest:h,originalsDigest:h,
  previewOrigin:'https://gomoku-a10-test.vercel.app/'};
 const ci={repository:'thiepn/gomoku',sourceSha:LOCK.sourceSha,a10HeadSha:a,a11HeadSha:b,
  a10Passed:true,a11Passed:true,a10RunId:1,a11RunId:2,
  observedAt:'2026-10-09T17:00:00Z',evidenceDigest:h,
  checks:Object.fromEntries(A.checks.map(x=>[x,{conclusion:'success',sha:b,runId:3}]))};
 const authorization={status:'explicit-production-approved',sourceSha:LOCK.sourceSha,
  a10HeadSha:a,a11HeadSha:b,productionOrigin:'https://gomoku.thiepn.dev/',
  owner:'SYNTHETIC ONLY',operator:'SYNTHETIC ONLY',changeTicket:'SYNTHETIC ONLY',
  maintenanceWindow:'SYNTHETIC ONLY',approvalDigest:h,approvedAt:'2026-10-09T18:00:00Z',
  rollbackZipSha256:LOCK.offlineZipSha256,dataMigration:'none'};
 const baseline={mainSha:'d'.repeat(40),capturedAt:'2026-10-09T19:00:00Z',
  backupLocation:'SYNTHETIC ONLY',backupDigest:h,restoreTested:true,productionUnaffected:true,
  assets:C.ASSETS.map(path=>({path,sha256:h}))};
 const monitor={onCall:'SYNTHETIC ONLY',escalation:'SYNTHETIC ONLY',
  rollbackTrigger:'SYNTHETIC ONLY',rollbackOwner:'SYNTHETIC ONLY',
  pwaOfflineCheck:'SYNTHETIC ONLY',playerDataCheck:'SYNTHETIC ONLY',
  liveAssetCheck:'SYNTHETIC ONLY',restoreProcedure:'SYNTHETIC ONLY',planDigest:h};
 return {a11,review,ci,authorization,baseline,monitor};
}
let n=0;
function test(name,edit,expected){const x=fixture();if(edit)edit(x);const r=A.assess(x);
 assert.equal(r.status,expected,name);
 for(const k of ['canMerge','canTag','canDeployProduction','canModifyProductionData'])
  assert.equal(r[k],false,name);n++;console.log('PASS '+name);}
test('empty input fail closed',()=>{},'manual-review-only');
const none=A.assess();assert.equal(none.status,'blocked-a11');
test('A11 not accepted',x=>x.a11.status='awaiting-physical','blocked-a11');
test('A11 source drift',x=>x.a11.sourceSha=a,'blocked-a11');
test('A11 false deploy rights mandatory',x=>x.a11.canDeployProduction=true,'blocked-a11');
test('no independent review',x=>x.review=null,'blocked-review');
test('17 physical observations insufficient',x=>x.review.physicalCases=17,'blocked-review');
test('P19 check from wrong head',x=>x.ci.checks['p19-supply-chain'].sha=a,'blocked-ci');
test('missing security check',x=>delete x.ci.checks['p23-security'],'blocked-ci');
test('no new owner approval',x=>x.authorization=null,'blocked-production-authorization');
test('owner approval earlier than review',x=>x.authorization.approvedAt='2026-10-09T15:00:00Z','blocked-production-authorization');
test('preview not production',x=>x.authorization.productionOrigin='https://test.vercel.app/','blocked-production-authorization');
test('no live migrations authorized',x=>x.authorization.dataMigration='live-sql','blocked-production-authorization');
test('restore not tested',x=>x.baseline.restoreTested=false,'blocked-recovery');
test('duplicate current asset',x=>x.baseline.assets[1]={...x.baseline.assets[0]},'blocked-recovery');
test('current production snapshot must follow owner decision',x=>x.baseline.capturedAt='2026-10-09T17:00:00Z','blocked-recovery');
test('monitoring owner required',x=>x.monitor.rollbackOwner='','blocked-monitoring');
assert.equal(A.origin('https://gomoku.thiepn.dev/'),true);
assert.equal(A.origin('https://localhost/'),false);
console.log(n+' A12 adversarial contracts passed; all fixtures SYNTHETIC, never real acceptance.');
