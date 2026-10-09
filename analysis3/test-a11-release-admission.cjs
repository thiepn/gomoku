'use strict';
const assert=require('node:assert/strict');
const A=require('./a11-release-admission.cjs'),C=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const h='b'.repeat(64),sw='c'.repeat(64),url='https://gomoku-a10-preview-test.vercel.app/';
const now='2026-10-09T15:00:00Z',before='2026-10-09T14:00:00Z';
const copy=o=>structuredClone(o);
const candidate=()=>({format:'GomokuAnalysis3Candidate',version:9,sourceBranch:LOCK.upstreamBranch,
 sourceSha:LOCK.sourceSha,originMainFrozen:true,workflowRunId:LOCK.githubRunId,
 assets:Object.fromEntries(C.ASSETS.map(a=>[a,a==='sw.js'?sw:h])),
 stages:Object.fromEntries(C.STAGES.map(a=>[a,{status:'passed',issuer:'GitHub Actions',
 sourceSha:LOCK.sourceSha,indexSha256:h,workflowRunId:LOCK.githubRunId,completedAt:before}]))});
const device=(id,c)=>({status:'passed',sha:c.sourceSha,artifactHash:c.assets['index.html'],
 device:'Synthetic fixture — NEVER human evidence',osVersion:'15',browserVersion:'130',
 testedUrl:url,tester:'Synthetic fixture',signature:'Synthetic fixture',issuer:'Synthetic fixture',
 timestamp:now,testCases:C.DEVICE_CHECKS[id].map(id=>({id,status:'passed',
 observation:'Synthetic test fixture; not a real physical-device result'}))});
const worksheet=c=>({sourceSha:c.sourceSha,indexSha256:c.assets['index.html'],
 serviceWorkerSha256:c.assets['sw.js'],manifestSha256:c.assets['manifest.webmanifest'],
 candidatePreviewUrl:url,
 physicalEvidence:Object.fromEntries(C.PHYSICAL.map(id=>[id,device(id,c)])),
 ownerApproval:{status:'approved',sha:c.sourceSha,artifactHash:c.assets['index.html'],
 approvedBy:'Synthetic fixture',approvedAt:now}});
const probe=c=>({url,sourceSha:c.sourceSha,archiveSha256:LOCK.offlineZipSha256,
 verifiedAssets:C.ASSETS.map(path=>({path,sha256:c.assets[path],bytes:1024}))});
const update=c=>({format:'GomokuAnalysis3A11ControlledUpdate',status:'passed',
 originalSourceSha:c.sourceSha,originalServiceWorkerSha256:c.assets['sw.js'],
 updatedServiceWorkerSha256:'d'.repeat(64),revertedServiceWorkerSha256:c.assets['sw.js'],
 candidatePreviewUrl:url,updatedPreviewUrl:url,previewOnly:true,productionUnaffected:true,
 authorizedBy:'Synthetic fixture',authorizedAt:before,device:'Synthetic fixture',tester:'Synthetic fixture',
 observedAt:now,observation:'Synthetic only: PWA controlled update and rollback were not performed.',
 evidenceReference:'fixture-placeholder',evidenceSha256:h,rollbackObserved:true});
const rollback=c=>({format:'GomokuAnalysis3A11RollbackRehearsal',status:'passed',
 sourceSha:c.sourceSha,immutableZipSha256:LOCK.offlineZipSha256,indexSha256:c.assets['index.html'],
 previewOnly:true,productionUnaffected:true,backupVerified:true,backupReference:'fixture-placeholder',
 executedBy:'Synthetic fixture',executedAt:now,
 observation:'Synthetic only: no preview rollback has actually been performed.',
 evidenceReference:'fixture-placeholder',evidenceSha256:h,restoredAllEightAssets:true,restoredOfflineAndSavedRecords:true});
function complete(){let c=candidate();return {candidate:c,worksheet:worksheet(c),probe:probe(c),
 updateEvidence:update(c),rollbackEvidence:rollback(c)}}
let n=0;function test(label,fn){fn();console.log('PASS '+label);n++}
test('default with no files reports blocked source, no deployment',()=>{
 const r=A.audit();assert.equal(r.status,'blocked-source');assert.equal(r.canMerge,false);
 assert.equal(r.canDeployProduction,false);assert.equal(r.canTag,false)});
test('candidate must match locked SHA, branch and run',()=>{
 const x=complete();x.candidate.workflowRunId='other';assert.equal(A.audit(x).status,'blocked-source')});
test('all seven automated source stages are mandatory',()=>{
 const x=complete();x.candidate.stages.offline.status='skipped';
 assert.equal(A.audit(x).status,'blocked-source')});
test('real HTTPS proof required, cannot substitute a screenshot or localhost',()=>{
 const x=complete();x.probe=null;assert.equal(A.audit(x).status,'blocked-preview');
 x.probe=probe(x.candidate);x.probe.url='http://localhost/';
 assert.equal(A.audit(x).status,'blocked-preview')});
test('wrong original ZIP identity blocks hosted admission',()=>{
 const x=complete();x.probe.archiveSha256='0'.repeat(64);
 assert.equal(A.audit(x).status,'blocked-preview')});
test('missing, duplicate or mutated live asset blocks hosted admission',()=>{
 const x=complete();x.probe.verifiedAssets[1].sha256='e'.repeat(64);
 assert.equal(A.audit(x).status,'blocked-preview');
 const y=complete();y.probe.verifiedAssets[1]=y.probe.verifiedAssets[0];
 assert.equal(A.audit(y).status,'blocked-preview')});
test('different worksheet origin blocks hosted admission',()=>{
 const x=complete();x.worksheet.candidatePreviewUrl='https://another-preview.vercel.app/';
 assert.equal(A.audit(x).status,'blocked-preview')});
test('missing real device observations blocks admission after a valid probe',()=>{
 const x=complete();x.worksheet.physicalEvidence['android-chrome'].testCases[0].status='not_tested';
 assert.equal(A.audit(x).status,'awaiting-physical')});
test('all documentary physical cases do not substitute controlled SW-update evidence',()=>{
 const x=complete();delete x.updateEvidence;assert.equal(A.audit(x).status,'awaiting-controlled-update')});
test('same-version SW reload does not qualify as an update',()=>{
 const x=complete();x.updateEvidence.updatedServiceWorkerSha256=x.candidate.assets['sw.js'];
 assert.equal(A.audit(x).status,'awaiting-controlled-update')});
test('cross-origin PWA update is not accepted as same-origin update',()=>{
 const x=complete();x.updateEvidence.updatedPreviewUrl='https://another-preview.vercel.app/';
 assert.equal(A.audit(x).status,'awaiting-controlled-update')});
test('update rehearsal requires prior authorization and observed rollback',()=>{
 const x=complete();x.updateEvidence.rollbackObserved=false;
 assert.equal(A.audit(x).status,'awaiting-controlled-update');
 const y=complete();y.updateEvidence.authorizedAt='2026-10-09T17:00:00Z';
 assert.equal(A.audit(y).status,'awaiting-controlled-update')});
test('rollback rehearsal must be independently documented',()=>{
 const x=complete();x.rollbackEvidence=null;
 assert.equal(A.audit(x).status,'awaiting-rollback-rehearsal')});
test('wrong rollback archive or missing data restoration blocks readiness',()=>{
 const x=complete();x.rollbackEvidence.immutableZipSha256='1'.repeat(64);
 assert.equal(A.audit(x).status,'awaiting-rollback-rehearsal');
 const y=complete();y.rollbackEvidence.restoredOfflineAndSavedRecords=false;
 assert.equal(A.audit(y).status,'awaiting-rollback-rehearsal')});
test('matching owner signature is mandatory',()=>{
 const x=complete();x.worksheet.ownerApproval.status='not_requested';
 assert.equal(A.audit(x).status,'awaiting-owner')});
test('even a wholly SYNTHETIC complete worksheet cannot trigger deploy or merge',()=>{
 const r=A.audit(complete());assert.equal(r.status,'ready-for-independent-release-review');
 assert.equal(r.canMerge,false);assert.equal(r.canDeployProduction,false);assert.equal(r.canTag,false);
 assert.equal(r.physicalCases.required,18)});
console.log(n+' A11 fail-closed admission/preview/physical/rollback tests passed (all fixtures synthetic).');
