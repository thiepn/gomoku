/* A19: multi-epoch global replay/revocation reconciliation and split owner decisions. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),P=require('./a19-parent-evidence.json');
const LOCK=require('./a10-source-lock.json');
const SHA=/^[a-f0-9]{64}$/;
const res=(code,why,extra={})=>W.result(code,why,{...extra,ownerDecisionAuthenticated:false});
function replay({epochs,sourceLedger,priorA18,signature,roots,now=new Date()}={}){
 if(priorA18?.status!=='ledger-documentary-only'||priorA18.independentReplayAuthority!==false||
  !epochs||epochs.format!=='GomokuA19IndependentReplayEpochs'||epochs.version!==19||
  epochs.sourceSha!==LOCK.sourceSha||epochs.a18Head!==P.a18Head||
  epochs.providerIndependentlyAdministeredClaimed!==true||
  epochs.globalNonceReuseCheckedClaimed!==true||
  epochs.originalExternalProofPreservedClaimed!==true||
  !Array.isArray(epochs.records)||epochs.records.length<2||
  !Array.isArray(epochs.revokedKeyIds)||new Set(epochs.revokedKeyIds).size!==epochs.revokedKeyIds.length||
  !sourceLedger?.entries?.length)return res('blocked-global-ledger','Independent multi-epoch source/object/revocation audit evidence missing.');
 const nonce=new Map(),head=new Set(),events=new Set();let last=null;
 for(const r of epochs.records){
  if(!r||!SHA.test(r.providerRootSha256||'')||head.has(r.providerRootSha256)||
   !SHA.test(r.originalSourceRecordDigest||'')||!SHA.test(r.receiptSha256||'')||
   !SHA.test(r.eventId||'')||events.has(r.eventId)||
   !/^[a-f0-9]{32}$/.test(r.challenge||'')||
   !Number.isSafeInteger(r.epoch)||r.epoch<1||!W.utc(r.observedAt)||
   last&&(!(r.epoch>last.epoch)||W.utc(r.observedAt)<=W.utc(last.observedAt))||
   !['issue','consume'].includes(r.action))
   return res('blocked-replay-history','Original nonce, root, epoch ordering, recorded timestamp or custody record invalid.');
  const state=nonce.get(r.challenge);
  if(r.action==='issue'&&state||r.action==='consume'&&state!=='issued')return res('blocked-replay-history','Nonce reused, unissued, double-consumed or consumed out of sequence.');
  nonce.set(r.challenge,r.action==='issue'?'issued':'consumed');
  head.add(r.providerRootSha256);events.add(r.eventId);last=r;
 }
 // Exactly one issue and one consume per challenge; distinct event IDs and monotonic epoch roots.
 if(epochs.records.length!==sourceLedger.entries.length)
  return res('blocked-ledger-grain','External records must match exact local journal grain.');
 for(let i=0;i<epochs.records.length;i++){
  if(epochs.records[i].originalSourceRecordDigest!==sourceLedger.entries[i].digest||
     epochs.records[i].action!==sourceLedger.entries[i].action||
     epochs.records[i].challenge!==sourceLedger.entries[i].challenge)
   return res('blocked-local-ledger-binding','External record not anchored to source issue/consume event.');
 }
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,epochDigest:W.hash(epochs),
  localJournalDigest:W.hash(sourceLedger),revokedKeyIds:epochs.revokedKeyIds};
 const v=W.verify({kind:'external-replay-ledger',payload,envelope:signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?res('external-replay-history-documentary-only','Signed external provider chronology documents are consistent, but global authority and human provider custody not authenticated.',
    {epochRecords:epochs.records.length,certifiedGlobalAntiReplay:false})
  :v;
}
function keyReview({prior,proposed,review,now=new Date()}={}){
 const v=W.rotation({prior,proposed,review,now});
 return v.status==='ready-for-human-key-rotation-review'
  ?res('revocation-proposal-only','Pinned monotonic revocations and signatures are structurally consistent, but keys remain unchanged.')
  :v;
}
function beforeRelease({originalHost,physical,restore,ledger,rotation,ownerProposal,roots,now=new Date()}={}){
 if(originalHost?.status!=='host-original-bytes-reviewable'||
  physical?.status!=='physical-original-custody-reviewable'||
  physical?.physicalAccepted!==0||
  restore?.status!=='prior-archive-reviewable-only'||
  ledger?.status!=='external-replay-history-documentary-only'||
  rotation?.status!=='revocation-proposal-only')
  return res('blocked-precutover-gates','Required distinct external originals, prior image, revocation and replay reviews absent.');
 if(ownerProposal?.format!=='GomokuA19PrecutoverOwnerReview'||ownerProposal.version!==19||
  ownerProposal.sourceSha!==LOCK.sourceSha||ownerProposal.a18Head!==P.a18Head||
  ownerProposal.status!=='proposed-for-distinct-human-consent'||
  ownerProposal.productionCutoverExecuted!==false||
  ownerProposal.realPhysicalCasesAccepted!==false||
  ownerProposal.actualOwnerApproved!==false||!SHA.test(ownerProposal.originalPacketDigest||''))
  return res('blocked-owner-proposal','Owner proposal must retain original evidence and not claim actual approval/deployment.');
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,originalPacketDigest:W.hash(ownerProposal),
  decision:'PRE_CUTOVER_REVIEW_ONLY'};
 const v=W.verify({kind:'precutover-owner-review',payload,envelope:ownerProposal.signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?res('precutover-packet-awaiting-owner','All review documents supplied, but no real owner decision, production release or data mutation is authorized.')
  :v;
}
function afterRelease({before,actualCutover,realA13,postDevice,ownerClosure,roots,now=new Date()}={}){
 if(before?.status!=='precutover-packet-awaiting-owner'||
  actualCutover?.status!=='completed-production-cutover'||
  actualCutover.originalIndependentHumanAuthorityVerified!==true||
  actualCutover.sourceSha!==LOCK.sourceSha||
  actualCutover.productionDataMigration!=='none'||
  !W.utc(actualCutover.deployedAt)||
  realA13?.status!=='ready-for-manual-stability-review'||
  !Number.isSafeInteger(realA13.hoursObserved)||
  realA13.hoursObserved<24||realA13.hoursObserved>72||
  postDevice?.status!=='independently-reviewed-real-device-originals')
  return res('blocked-postrelease-originals','Actually authorized A12, real 24–72h A13, postrelease physical source proof absent.');
 if(ownerClosure?.format!=='GomokuA19OwnerPostreleaseClosure'||ownerClosure.version!==19||
  ownerClosure.sourceSha!==LOCK.sourceSha||
  ownerClosure.deploymentId!==actualCutover.deploymentId||
  ownerClosure.status!=='owner-closure-review-only'||
  ownerClosure.actualHumanClosureApproved!==false||
  !W.utc(ownerClosure.reviewedAt)||
  W.utc(ownerClosure.reviewedAt)<=W.utc(actualCutover.deployedAt))
  return res('blocked-owner-closure','Distinct later owner closure provenance required.');
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,closureDigest:W.hash(ownerClosure),
  cutoverDigest:W.hash(actualCutover),stabilityDigest:W.hash(realA13),
  decision:'POSTRELEASE_CLOSURE_REVIEW_ONLY'};
 const v=W.verify({kind:'postrelease-closure-review',payload,envelope:ownerClosure.signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?res('postrelease-packet-awaiting-owner','Documentary postrelease signature consistency only. Actual human closure remains OPEN.')
  :v;
}
function status(){
 return res('NO_GO','No actual hosted/device/human/cutover/telemetry approvals; source automation cannot close release.',
  {physicalChrome:'0/7',physicalSamsung:'0/6',physicalPwa:'0/5',
   actualHostedApproved:false,realSigningKeys:0,previousStableRestoreObserved:false,
   actualA12Cutover:false,actualA13Telemetry:false});
}
module.exports={replay,keyReview,beforeRelease,afterRelease,status};
