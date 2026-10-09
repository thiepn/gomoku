/* A11 documentary release-readiness admission. Never a merge, tag, or deployment authorization. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const A9=require('./rc9-core.cjs');
const A10=require('./a10-device-assessment.cjs');
const {previewUrl}=require('./a10-preview-integrity.cjs');
const LOCK=require('./a10-source-lock.json');
const HEX=/^[a-f0-9]{64}$/;
const present=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>present(x)&&Number.isFinite(Date.parse(x));
function checkUpdate(e,c,probe){
 const issues=[];
 if(!e||e.format!=='GomokuAnalysis3A11ControlledUpdate'||e.status!=='passed')
   return ['No independently observed, explicitly approved same-origin service-worker update rehearsal.'];
 for(const [key,valid] of Object.entries({
   originalSourceSha:e.originalSourceSha===LOCK.sourceSha,
   originalServiceWorkerSha256:e.originalServiceWorkerSha256===c.assets['sw.js'],
   candidatePreviewUrl:e.candidatePreviewUrl===probe.url,
   updatedPreviewUrl:e.updatedPreviewUrl===probe.url,
   updatedServiceWorkerSha256:HEX.test(e.updatedServiceWorkerSha256||'')&&e.updatedServiceWorkerSha256!==c.assets['sw.js'],
   previewOnly:e.previewOnly===true,productionUnaffected:e.productionUnaffected===true,
   ownerAuthorized:present(e.authorizedBy)&&date(e.authorizedAt),
   realPhysicalTest:present(e.device)&&present(e.tester)&&date(e.observedAt)&&
     present(e.observation)&&e.observation.trim().length>=20,
   independentEvidence:present(e.evidenceReference)&&HEX.test(e.evidenceSha256||''),
   controlledRollback:present(e.revertedServiceWorkerSha256)&&
     e.revertedServiceWorkerSha256===c.assets['sw.js']&&e.rollbackObserved===true
 }))if(!valid)issues.push('Controlled SW-update evidence invalid: '+key);
 if(date(e.authorizedAt)&&date(e.observedAt)&&Date.parse(e.observedAt)<Date.parse(e.authorizedAt))
   issues.push('SW update reportedly observed before it was approved.');
 return issues;
}
function checkRollback(r,c){
 if(!r||r.format!=='GomokuAnalysis3A11RollbackRehearsal'||r.status!=='passed')
   return ['No documented preview-only rollback rehearsal for the exact A9 package.'];
 const issues=[];
 const checks={
   sourceSha:r.sourceSha===LOCK.sourceSha,
   immutableZipSha256:r.immutableZipSha256===LOCK.offlineZipSha256,
   indexSha256:r.indexSha256===c.assets['index.html'],
   previewOnly:r.previewOnly===true&&r.productionUnaffected===true,
   backup:r.backupVerified===true&&present(r.backupReference),
   humanWitness:present(r.executedBy)&&date(r.executedAt)&&present(r.observation)&&r.observation.trim().length>=20,
   evidence:present(r.evidenceReference)&&HEX.test(r.evidenceSha256||''),
   restoreVerified:r.restoredAllEightAssets===true&&r.restoredOfflineAndSavedRecords===true
 };
 for(const [name,ok] of Object.entries(checks))if(!ok)issues.push('Rollback rehearsal invalid: '+name);
 return issues;
}
function audit({candidate,worksheet,probe,updateEvidence,rollbackEvidence}={}){
 const issues=[],summary={source:'blocked',preview:'blocked',physical:'not_tested',
   controlledUpdate:'not_tested',rollback:'not_tested',owner:'not_approved'};
 const counts={required:18,passed:0};
 const add=(category,msgs)=>{for(const message of msgs)issues.push({category,message});};
 if(!candidate||typeof candidate!=='object'){
   add('source',['Original A9 candidate receipt not supplied.']);
   return finish('blocked-source',summary,counts,issues);
 }
 const src=[];
 if(candidate.sourceSha!==LOCK.sourceSha||candidate.sourceBranch!==LOCK.upstreamBranch||
    String(candidate.workflowRunId)!==LOCK.githubRunId)
   src.push('A9 source SHA, upstream branch or passed workflow run differs from immutable lock.');
 if(!A9.automated(candidate).ok)src.push(...A9.automated(candidate).issues);
 if(!A9.ASSETS.every(f=>HEX.test(candidate.assets?.[f]||'')))
   src.push('Incomplete or invalid original eight-asset SHA receipt.');
 add('source',src);
 if(src.length)return finish('blocked-source',summary,counts,issues);
 summary.source='locked-a9-automation';
 const host=[];
 if(!probe||!Array.isArray(probe.verifiedAssets))
   host.push('Missing verified live HTTPS probe from the exact isolated host.');
 else {
   try {previewUrl(probe.url);}catch(e){host.push(String(e.message));}
   if(probe.sourceSha!==LOCK.sourceSha||probe.archiveSha256!==LOCK.offlineZipSha256)
     host.push('Live source/archive hash differs from immutable A9 artifact.');
   if(probe.verifiedAssets.length!==A9.ASSETS.length)
     host.push('Live probe must cover exactly eight immutable assets.');
   const seen=new Set();
   for(const a of probe.verifiedAssets){
     if(!A9.ASSETS.includes(a?.path)||seen.has(a.path))host.push('Unexpected or duplicate probed asset.');
     else if(a.sha256!==candidate.assets[a.path]||!Number.isSafeInteger(a.bytes)||a.bytes<1)
       host.push('Mismatched or invalid probed asset: '+a.path);
     if(a?.path)seen.add(a.path);
   }
   for(const f of A9.ASSETS)if(!seen.has(f))host.push('Missing probed asset: '+f);
 }
 if(!worksheet||worksheet.candidatePreviewUrl!==probe?.url)
   host.push('Worksheet URL not pinned to verified live HTTPS origin.');
 add('preview',host);
 if(host.length)return finish('blocked-preview',summary,counts,issues);
 summary.preview='eight-assets-match-receipt-documentary';
 const physical=A9.physical(candidate,worksheet);
 for(const id of A9.PHYSICAL){
   const e=worksheet?.physicalEvidence?.[id];
   const allowed=new Set(A9.DEVICE_CHECKS[id]);
   if(Array.isArray(e?.testCases))for(const row of e.testCases)
     if(allowed.has(row?.id)&&row.status==='passed'&&present(row.observation))counts.passed++;
 }
 counts.passed=Math.min(counts.passed,18);
 add('physical',physical.issues);
 if(!physical.ok)return finish('awaiting-physical',summary,counts,issues);
 summary.physical='documented-18-of-18-not-independently-retested';
 const updates=checkUpdate(updateEvidence,candidate,probe);
 add('update',updates);
 if(updates.length)return finish('awaiting-controlled-update',summary,counts,issues);
 summary.controlledUpdate='documented-not-independently-retested';
 const rollback=checkRollback(rollbackEvidence,candidate);
 add('rollback',rollback);
 if(rollback.length)return finish('awaiting-rollback-rehearsal',summary,counts,issues);
 summary.rollback='documented-not-independently-retested';
 const qualified=A10.evaluate(candidate,worksheet,probe);
 if(qualified.status!=='ready-for-separate-release-authorization'){
   add('owner',qualified.issues.length?qualified.issues:['Owner approval missing or stale.']);
   return finish('awaiting-owner',summary,counts,issues);
 }
 summary.owner='documented-approved-not-production-authorized';
 return finish('ready-for-independent-release-review',summary,counts,issues);
}
function finish(status,stages,physicalCases,issues){
 return {format:'GomokuAnalysis3A11Admission',version:11,sourceSha:LOCK.sourceSha,
   offlineZipSha256:LOCK.offlineZipSha256,status,stages,physicalCases,issues,
   canMerge:false,canTag:false,canDeployProduction:false,
   notice:'Documentary readiness only. Evidence must be independently verified; this tool cannot authorize a merge, tag, production migration or deployment.'};
}
function load(name){return name?JSON.parse(fs.readFileSync(path.resolve(name),'utf8')):null;}
if(require.main===module){
 const [receipt,worksheet,httpsProbe,update,rollback]=process.argv.slice(2);
 const result=audit({candidate:load(receipt),worksheet:load(worksheet),probe:load(httpsProbe),
   updateEvidence:load(update),rollbackEvidence:load(rollback)});
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='ready-for-independent-release-review')process.exitCode=2;
}
module.exports={audit,checkUpdate,checkRollback};
