/* A18 original physical Android/browser/accessibility and distinct offline rollback packet review. */
'use strict';
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const W=require('./a18-signer-reconciliation.cjs');
const PINS=require('./a18-source-pins.json');
const SHA=/^[a-f0-9]{64}$/;
const ACCESSIBILITY=Object.freeze(['screen-reader','keyboard-or-switch','zoom-200','reduced-motion','focus-order','contrast','offline-state-persistence']);
const PLATFORM=Object.freeze({'android-chrome':7,'samsung-internet':6,'installed-android-pwa':5});
function inspect({worksheet,accessibility,preview,swReview,rollbackReview,signature,roots,now=new Date()}={}){
 if(worksheet?.format!=='GomokuA17OriginalDeviceWorksheet'||worksheet.version!==17||
  worksheet.sourceSha!==LOCK.sourceSha||worksheet.physicalAcceptance!=='OPEN'||
  worksheet.ownerAuthorization!=='not_approved'||worksheet.independentReviewer!=='not_approved'||
  !preview||preview.status!=='hosted-originals-ready-for-independent-human-review'||
  preview.sourceSha!==LOCK.sourceSha||!preview.origin)
  return W.result('blocked-original-physical','A17 original unapproved source worksheet and separate independently reviewed HTTPS candidate are required.');
 const receipts=new Set(),all=[];
 for(const [platform,count] of Object.entries(PLATFORM)){
  const row=worksheet.platforms?.[platform],ids=A9.DEVICE_CHECKS[platform];
  if(!row||!Array.isArray(row.cases)||row.cases.length!==count||
   row.cases.map(x=>x.id).sort().join('|')!==[...ids].sort().join('|')||
   [row.device,row.osVersion,row.browserVersion,row.operator].some(v=>typeof v!=='string'||!v.trim()))
   return W.result('blocked-matrix','Distinct exact 7/6/5 physical-device case inventory or operator/device attribution missing.');
  for(const test of row.cases){
   const t=W.utc(test.observedAt);
   if(test.status!=='observed_pending_independent_review'||
    typeof test.observation!=='string'||test.observation.trim().length<24||
    !SHA.test(test.originalEvidenceDigest||'')||receipts.has(test.originalEvidenceDigest)||
    !t||t>now||t.getTime()<Date.parse(worksheet.createdAt||'1970-01-01T00:00:00Z'))
    return W.result('blocked-physical-evidence','Original immutable case observation missing, duplicated, undated or not reviewable.');
   receipts.add(test.originalEvidenceDigest);all.push({platform,id:test.id,originalEvidenceDigest:test.originalEvidenceDigest});
  }
 }
 if(all.length!==18||worksheet.origin!==preview.origin)
  return W.result('blocked-origin','18 physical observations must match the same independently reviewed preview origin.');
 if(accessibility?.format!=='GomokuA18OriginalA11Accessibility'||accessibility.version!==18||
  accessibility.sourceSha!==LOCK.sourceSha||accessibility.previewOrigin!==preview.origin||
  !Array.isArray(accessibility.cases)||accessibility.cases.length!==ACCESSIBILITY.length||
  new Set(accessibility.cases.map(x=>x.id)).size!==ACCESSIBILITY.length||
  !ACCESSIBILITY.every(id=>accessibility.cases.some(c=>c.id===id&&c.result==='observed-pending-review'&&
   SHA.test(c.originalMediaSha256||'')&&typeof c.observation==='string'&&c.observation.trim().length>=24))||
  accessibility.realHardwareObservedClaimed!==true)
  return W.result('blocked-accessibility','Required screen-reader, focus, zoom, motion, contrast and offline-state evidence records missing.');
 if(swReview?.format!=='GomokuA18OriginalServiceWorkerUpdate'||swReview.version!==18||
  swReview.sourceSha!==LOCK.sourceSha||swReview.origin!==preview.origin||
  !SHA.test(swReview.beforeHash||'')||!SHA.test(swReview.updatedHash||'')||
  swReview.beforeHash===swReview.updatedHash||swReview.revertedHash!==swReview.beforeHash||
  swReview.updatePerformedOnRealDeviceClaimed!==true||
  !SHA.test(swReview.originalObservationDigest||''))
  return W.result('blocked-sw','No separately sourced actual version-changing same-origin SW installation and reversal evidence.');
 if(rollbackReview?.format!=='GomokuA18PreviousStableRestoreReview'||
  rollbackReview.status!=='originals-awaiting-human-review'||
  rollbackReview.sourceSha!==LOCK.sourceSha||
  rollbackReview.productionDataAccessed!==false||
  rollbackReview.previewOrigin!==preview.origin||
  rollbackReview.realRestoreObservedClaimed!==true)
  return W.result('blocked-rollback','Distinct previous-stable original restore and player-state custody remain unverified.');
 const payload={worksheetDigest:W.hash(worksheet),accessibilityDigest:W.hash(accessibility),
  swDigest:W.hash(swReview),rollbackDigest:W.hash(rollbackReview),sourceSha:LOCK.sourceSha,
  a17Head:PINS.upstreamA17,previewOrigin:preview.origin,physicalCases:18};
 const signed=W.verify({kind:'physical-device-review',payload,envelope:signature,roots,now});
 return signed.status==='signed-originals-document-only'
  ?W.result('physical-originals-ready-for-independent-review','All 18 original-looking cases and seven accessibility originals are documentary-reviewable. Device reality and human signer provenance have NOT been independently established.',
    {physicalCasesReviewable:18,accessibilityCasesReviewable:ACCESSIBILITY.length,physicalAccepted:0,payloadDigest:W.hash(payload)})
  :signed;
}
function previousStable({candidate,restore,prior,signature,roots,now=new Date()}={}){
 if(candidate?.sourceSha!==LOCK.sourceSha||prior?.format!=='GomokuA18PriorStableSource'||
  prior.version!==18||!SHA.test(prior.previousStableArchiveSha256||'')||
  prior.previousStableArchiveSha256===LOCK.offlineZipSha256||
  prior.sourceRef===LOCK.sourceSha||
  prior.originallyDeployed===true&&!SHA.test(prior.deploymentReceiptDigest||'')||
  !SHA.test(prior.originalSourceManifestSha256||'')||
  restore?.status!=='isolated-restore-rehearsed-only'||
  restore.originalSourceSha!==LOCK.sourceSha||
  restore.previousStableArchiveSha256!==prior.previousStableArchiveSha256||
  restore.assets!==8||restore.candidateAppliedThenRestored!==true||
  restore.syntheticRecordPreserved!==true||restore.realRollbackAccepted!==false)
  return W.result('blocked-prior-image','Previous stable original must be separate from A9 and source-anchored; local synthetic revert does not prove real restore.');
 const payload={a17Head:PINS.upstreamA17,a9SourceSha:LOCK.sourceSha,
  priorArchiveSha256:prior.previousStableArchiveSha256,originalsDigest:W.hash(prior),
  rehearsalDigest:W.hash(restore),syntheticOnly:true};
 const signed=W.verify({kind:'previous-stable-restore',payload,envelope:signature,roots,now});
 return signed.status==='signed-originals-document-only'
  ?W.result('prior-static-restore-documentary-review','Distinct source and local synthetic restored static image reconcile; REAL PWA/previous-stable/player backup restoration remains OPEN.')
  :signed;
}
module.exports={inspect,previousStable,ACCESSIBILITY,PLATFORM};
