/* A19: physical, accessibility, SW + distinct previous-stable original custody. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),A9=require('./rc9-core.cjs');
const P=require('./a19-parent-evidence.json'),LOCK=require('./a10-source-lock.json');
const A18=require('./a18-physical-and-restore.cjs'),H=/^[a-f0-9]{64}$/;
const n=(status,reason,extra={})=>W.result(status,reason,{...extra,physicalAccepted:0});
function physical({packet,caseBytes,priorA18,signature,roots,now=new Date()}={}){
 if(packet?.format!=='GomokuA19PhysicalOriginals'||packet.version!==19||
  packet.repository!=='thiepn/gomoku'||packet.sourceSha!==LOCK.sourceSha||
  packet.a18Head!==P.a18Head||packet.realOwnerApprovalStatus!=='OPEN'||
  packet.claimedOriginalHardwareWitnessed!==true||
  packet.originalCaptureHost!==packet.origin||!packet.origin?.startsWith('https://')||
  priorA18?.status!=='physical-originals-ready-for-independent-review'||
  priorA18.physicalAccepted!==0||
  !Array.isArray(packet.cases)||packet.cases.length!==18||!caseBytes)
  return n('blocked-physical-provenance','Eighteen pending-only independent original hardware records absent.');
 const seen=new Set(),digests=new Set();
 for(const r of packet.cases){
  const ids=A9.DEVICE_CHECKS[r?.platform];
  if(!ids?.includes(r.caseId)||seen.has(r.platform+':'+r.caseId)||
   !['android-chrome','samsung-internet','installed-android-pwa'].includes(r.platform)||
   r.status!=='observed-pending-independent-review'||r.origin!==packet.origin||
   typeof r.deviceId!=='string'||!r.deviceId.trim()||
   typeof r.osVersion!=='string'||!r.osVersion||
   typeof r.browserVersion!=='string'||!r.browserVersion||
   typeof r.operator!=='string'||!r.operator||
   !H.test(r.originalMediaSha256||'')||digests.has(r.originalMediaSha256)||
   !W.utc(r.observedAt)||W.utc(r.observedAt)>now||
   !Buffer.isBuffer(caseBytes[r.platform+':'+r.caseId])||
   caseBytes[r.platform+':'+r.caseId].length<1||
   caseBytes[r.platform+':'+r.caseId].length>10*1024*1024||
   require('node:crypto').createHash('sha256').update(caseBytes[r.platform+':'+r.caseId]).digest('hex')!==r.originalMediaSha256)
   return n('blocked-original-case','Duplicated, incomplete, unanchored or altered physical case original.');
  seen.add(r.platform+':'+r.caseId);digests.add(r.originalMediaSha256);
 }
 if(Object.keys(caseBytes).length!==18||Object.entries(A18.PLATFORM).some(([k,v])=>
  [...seen].filter(x=>x.startsWith(k+':')).length!==v))
  return n('blocked-physical-matrix','Exactly 7 Chrome, 6 Samsung Internet and 5 installed-PWA originals required.');
 if(packet.accessibility?.format!=='GomokuA19AccessibilityOriginals'||
  packet.accessibility.sourceSha!==LOCK.sourceSha||
  !Array.isArray(packet.accessibility.cases)||packet.accessibility.cases.length!==7||
  new Set(packet.accessibility.cases.map(c=>c.id)).size!==7||
  !A18.ACCESSIBILITY.every(id=>packet.accessibility.cases.some(x=>x.id===id&&
   x.reviewStatus==='pending-independent-hardware-review'&&
   H.test(x.originalMediaSha256||'')&&
   typeof x.observation==='string'&&x.observation.length>=24)))
  return n('blocked-accessibility','Seven distinct original accessibility review traces missing.');
 if(packet.serviceWorker?.format!=='GomokuA19WitnessedSW'||packet.serviceWorker.origin!==packet.origin||
  !H.test(packet.serviceWorker.beforeHash||'')||!H.test(packet.serviceWorker.updatedHash||'')||
  packet.serviceWorker.beforeHash===packet.serviceWorker.updatedHash||
  packet.serviceWorker.revertedHash!==packet.serviceWorker.beforeHash||
  packet.serviceWorker.originalPhysicalEvidenceStatus!=='pending-independent-review')
  return n('blocked-sw','Actual different-version PWA SW installation/reversal needs retained originals.');
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,
  originalCasesDigest:W.hash(packet.cases),accessibilityDigest:W.hash(packet.accessibility),
  swDigest:W.hash(packet.serviceWorker),origin:packet.origin,caseCount:18};
 const v=W.verify({kind:'physical-device-review',payload,envelope:signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?n('physical-original-custody-reviewable','All supplied source-bound media bytes match, but real devices/independent witness identity and acceptance remain OPEN.',
   {casesSubmitted:18,accessibilityPending:7,acceptanceGranted:false})
  :v;
}
function restore({rehearsal,priorArchive,priorArchiveBytes,originalObservation,signature,roots,now=new Date()}={}){
 if(rehearsal?.status!=='prior-static-restore-documentary-review'||
  !priorArchive||priorArchive.format!=='GomokuA19DistinctPriorArchive'||priorArchive.version!==19||
  priorArchive.a18Head!==P.a18Head||
  !H.test(priorArchive.sha256||'')||priorArchive.sha256===P.a9NestedZipSha256||
  !Buffer.isBuffer(priorArchiveBytes)||priorArchiveBytes.length<1||
  priorArchiveBytes.length>50*1024*1024||
  require('node:crypto').createHash('sha256').update(priorArchiveBytes).digest('hex')!==priorArchive.sha256||
  priorArchive.originalPreviousStableSource!==true||
  priorArchive.ownerApprovedRestore===false&&priorArchive.rehearsalOnly!==true||
  originalObservation?.format!=='GomokuA19PreviousStableWitness'||
  originalObservation.priorArchiveSha256!==priorArchive.sha256||
  originalObservation.actualPlayerDataTouched!==false||
  originalObservation.realRestorePerformed!==false||
  !H.test(originalObservation.observationDigest||''))
  return n('blocked-prior-restore','Distinct actual archive bytes, synthetic-only prior-stable rehearsal and original custody review are required.');
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,priorDigest:W.hash(priorArchive),
  originalObservationDigest:W.hash(originalObservation),rehearsalOnly:true};
 const v=W.verify({kind:'previous-stable-restore',payload,envelope:signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?n('prior-archive-reviewable-only','Prior original archive hash and offline rehearsal receipts consistent. Actual installed PWA/player rollback remains OPEN.')
  :v;
}
module.exports={physical,restore};
