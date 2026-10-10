/* A21 two-person documentary governance, never executable owner/deploy/closure authority. */
'use strict';
const PIN=require('./a21-qualified-parent.json'),LOCK=require('./a10-source-lock.json');
const W=require('./a18-signer-reconciliation.cjs');
const H=/^[a-f0-9]{64}$/;
const deny=(status,reason,extra={})=>W.result(status,reason,{...extra,
  ownerApproved:false,stagingAuthorized:false,canExecuteCutover:false,canCloseRelease:false});
function preflight({escrow,hardware,recovery,prior,packet,signatures,roots,now=new Date()}={}){
 if(escrow?.status!=='escrow-originals-documentary-only'||
  hardware?.status!=='physical-and-restore-originals-documentary-only'||
  recovery?.status!=='original-recovery-documentary-only'||
  prior?.status!=='previous-stable-custody-documentary'&&
  prior?.status!=='prior-archive-reviewable-only')
  return deny('blocked-prerequisite','Separate source/object/hardware/old stable and external recovery originals not reconciled.');
 if(packet?.format!=='GomokuA21PrecutoverReview'||packet.version!==21||
  packet.sourceSha!==LOCK.sourceSha||packet.a20Head!==PIN.head||
  packet.phase!=='staging-review-only'||packet.actualHumanApproval!=='OPEN'||
  packet.actualA12CutoverExecuted!==false||
  packet.hostedPreviewApproved!==false||packet.physicalAccepted!==0||
  !H.test(packet.escrowDigest||'')||!H.test(packet.hardwareDigest||'')||
  packet.escrowDigest!==escrow.finalReceiptDigest||
  packet.hardwareDigest!==hardware.sourceDigest||
  !H.test(packet.recoveryOriginalDigest||'')||
  !H.test(packet.independentOwnerIntakeDigest||'')||
  !H.test(packet.independentReviewerIntakeDigest||'')||
  packet.independentOwnerIntakeDigest===packet.independentReviewerIntakeDigest||
  typeof packet.deploymentId!=='string'||!packet.deploymentId.trim())
  return deny('blocked-owner-preflight','Staging human decision must be separate, exact source-bound and still unapproved.');
 const payload={sourceSha:LOCK.sourceSha,a20Head:PIN.head,escrowDigest:packet.escrowDigest,
  hardwareDigest:packet.hardwareDigest,recoveryOriginalDigest:packet.recoveryOriginalDigest,
  ownerDigest:packet.independentOwnerIntakeDigest,
  reviewerDigest:packet.independentReviewerIntakeDigest,stage:'staging-review-only'};
 const signed=W.verify({kind:'precutover-owner-review',payload,envelope:signatures,roots,now});
 return signed.status==='signed-originals-document-only'
  ?deny('precutover-signed-documents-only','Two synthetic/reviewed role signatures match a staging proposal; no actual owner consent, host approval or release occurs.',
   {reviewDigest:W.hash(packet),deploymentId:packet.deploymentId}):signed;
}
function closure({precutover,actualA12,actualA13,postPhysical,provider,packet,signatures,roots,now=new Date()}={}){
 if(precutover?.status!=='precutover-signed-documents-only'||
  actualA12?.format!=='GomokuA21ActualA12Original'||actualA12.status!=='EXECUTED_CUTOVER_CLAIMED'||
  actualA12.originalHumanAuthorityIndependentlyVerified!==true||
  actualA12.sourceSha!==LOCK.sourceSha||actualA12.deploymentId!==precutover.deploymentId||
  actualA12.productionDatabaseMigrated!==false||
  !W.utc(actualA12.executedAt)||
  actualA13?.status!=='real-postrelease-observation-claimed'||
  actualA13.deploymentId!==actualA12.deploymentId||
  !Number.isSafeInteger(actualA13.hoursObserved)||actualA13.hoursObserved<24||
  actualA13.hoursObserved>72||!H.test(actualA13.originalMinuteTelemetrySha256||'')||
  postPhysical?.status!=='independent-real-physical-acceptance-claimed'||
  postPhysical.originalCasesClaimed!==18||
  provider?.status!=='independent-provider-operational-originals-claimed')
  return deny('blocked-genuine-postrelease','No separately authorized executed A12, real 24–72h P20 original, independently accepted postrelease devices and provider custody.');
 if(packet?.format!=='GomokuA21PostreleaseReview'||packet.version!==21||
  packet.sourceSha!==LOCK.sourceSha||packet.a20Head!==PIN.head||
  packet.phase!=='postrelease-owner-review-only'||packet.deploymentId!==actualA12.deploymentId||
  packet.realClosureHumanApproved!==false||
  !W.utc(packet.reviewedAt)||W.utc(packet.reviewedAt)<=W.utc(actualA12.executedAt)||
  !H.test(packet.independentOwnerReceiptDigest||'')||
  !H.test(packet.independentReviewerReceiptDigest||'')||
  packet.independentOwnerReceiptDigest===packet.independentReviewerReceiptDigest||
  !H.test(packet.telemetryOriginalSha256||'')||
  packet.telemetryOriginalSha256!==actualA13.originalMinuteTelemetrySha256)
  return deny('blocked-later-owner','Postrelease separate custody/owner review chronology invalid.');
 const payload={sourceSha:LOCK.sourceSha,a20Head:PIN.head,reviewDigest:W.hash(packet),
  deploymentId:actualA12.deploymentId,telemetrySha256:packet.telemetryOriginalSha256,
  stage:'postrelease-owner-review-only'};
 const signed=W.verify({kind:'postrelease-closure-review',payload,envelope:signatures,roots,now});
 return signed.status==='signed-originals-document-only'
  ?deny('postrelease-signed-documents-only','Signed later closure-shaped original document only. Actual human closeout remains separate, never automatic.'):signed;
}
function status(){return deny('NO_GO','Staging, release and postrelease closure remain separately human governed. Production unchanged.',
 {physicalAccepted:0,hostedApproved:false,realHumanKeys:0,realGlobalLedger:false,
  actuallyExecutedA12:false,realA13HoursObserved:0});}
module.exports={preflight,closure,status,deny};
