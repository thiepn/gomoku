/* A20 separate hardware, prior stable and manual owner decisions. NEVER grants release. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),LOCK=require('./a10-source-lock.json');
const ROOTS=require('./a20-external-roots.json'),A19=require('./a19-device-and-restore.cjs');
const H=/^[a-f0-9]{64}$/;
const deny=(status,reason,extra={})=>W.result(status,reason,{...extra,
  ownerReleaseAccepted:false,postreleaseClosureAccepted:false,physicalAccepted:0});
const PLATFORMS=Object.freeze({'android-chrome':7,'samsung-internet':6,'installed-android-pwa':5});
const ACCESS=['screen-reader','keyboard-or-switch','zoom-200','reduced-motion','focus-order','contrast','offline-state-persistence'];
function device({packet,originalMedia,priorA19,independent,now=new Date()}={}){
 if(priorA19?.status!=='physical-original-custody-reviewable'||priorA19.physicalAccepted!==0||
  packet?.format!=='GomokuA20DeviceWitnessIntake'||packet.version!==20||
  packet.sourceSha!==LOCK.sourceSha||packet.a19Head!==ROOTS.a19Head||
  packet.humanApprovalStatus!=='OPEN'||packet.physicalAccepted!==0||
  !Array.isArray(packet.cases)||packet.cases.length!==18||
  !Array.isArray(packet.accessibility)||packet.accessibility.length!==7||
  !originalMedia||typeof originalMedia!=='object')
  return deny('blocked-device-intake','Exact source, pending-only device/accessibility originals missing.');
 const hashes=new Set();
 for(const [platform,n] of Object.entries(PLATFORMS)){
  const cases=packet.cases.filter(x=>x.platform===platform);
  if(cases.length!==n||new Set(cases.map(x=>x.caseId)).size!==n||
   cases.some(x=>x.reviewState!=='pending-independent-witness'||!x.originalSha256||
    !H.test(x.originalSha256)||!W.utc(x.observedAt)||W.utc(x.observedAt)>now||
    typeof x.deviceId!=='string'||!x.deviceId.trim()||
    !Buffer.isBuffer(originalMedia[platform+':'+x.caseId])||
    require('node:crypto').createHash('sha256').update(originalMedia[platform+':'+x.caseId]).digest('hex')!==x.originalSha256||
    hashes.has(x.originalSha256)))
    return deny('blocked-original-device','Duplicated, altered, missing or unreviewable exact physical source bytes.');
  for(const x of cases)hashes.add(x.originalSha256);
 }
 if(ACCESS.some(id=>!packet.accessibility.some(x=>x.id===id&&
  x.state==='pending-independent-accessibility-review'&&H.test(x.originalDigest||'')&&
  typeof x.notes==='string'&&x.notes.trim().length>=24))||
  new Set(packet.accessibility.map(x=>x.id)).size!==7)
  return deny('blocked-assistive-originals','Original seven accessibility witness checks incomplete.');
 if(independent?.format!=='GomokuA20DeviceIndependentReview'||independent.version!==20||
  independent.sourceSha!==LOCK.sourceSha||independent.a19Head!==ROOTS.a19Head||
  independent.deviceOriginalsDigest!==W.hash(packet)||independent.ownerPermissionStatus!=='OPEN'||
  independent.humanSignersIndependentlyAuthenticated!==false||
  !H.test(independent.originalReviewerPacketDigest||''))
  return deny('blocked-reviewer-independence','Separate device reviewer original packet and explicit lack of real approval required.');
 return deny('device-originals-documentary-only','18 binary source-bound cases and 7 accessible-use records match documentary bytes, with ZERO real-device acceptance.',
   {casesPending:18,accessibilityPending:7,originalsDigest:W.hash(packet)});
}
function previousStable({priorArchive,originalBytes,a19Review,receipt,now=new Date()}={}){
 if(a19Review?.status!=='prior-archive-reviewable-only'||
  priorArchive?.format!=='GomokuA20DistinctStableEscrow'||priorArchive.version!==20||
  priorArchive.sourceSha!==LOCK.sourceSha||priorArchive.a19Head!==ROOTS.a19Head||
  priorArchive.releaseState!=='NOT_EXECUTED'||!H.test(priorArchive.priorSha256||'')||
  priorArchive.priorSha256===ROOTS.originalOfflineZipSHA256||
  !Buffer.isBuffer(originalBytes)||originalBytes.length<1||
  originalBytes.length>50*1024*1024||
  require('node:crypto').createHash('sha256').update(originalBytes).digest('hex')!==priorArchive.priorSha256||
  receipt?.format!=='GomokuA20PriorRecoveryWitness'||receipt.priorSha256!==priorArchive.priorSha256||
  receipt.actualRestorePerformed!==false||receipt.personalPlayerDataAccessed!==false||
  receipt.currentProductionChanged!==false||
  !H.test(receipt.offlineSyntheticRehearsalDigest||'')||
  !W.utc(receipt.observedAt)||W.utc(receipt.observedAt)>now)
  return deny('blocked-prior-recovery','Real distinct prior stable archive bytes and synthetic-only restore original review absent.');
 return deny('previous-stable-custody-documentary','Prior archive SHA matches independently supplied bytes. Actual installed-PWA and player-data recovery is still OPEN.',
  {previousStableSha256:priorArchive.priorSha256,recoveryActuallyPerformed:false});
}
function release({origin,deviceReport,recovery,globalLedger,rotation,review}={}){
 if(origin?.status!=='external-originals-documentary-ready'||
  deviceReport?.status!=='device-originals-documentary-only'||
  recovery?.status!=='previous-stable-custody-documentary'||
  globalLedger?.status!=='multioperator-documentary-consistent'||
  rotation?.status!=='compromise-recovery-review-only')
  return deny('blocked-release-prerequisites','Original host/device/global replay/revocation/prior stable documents incomplete.');
 if(review?.format!=='GomokuA20OwnerPrecutoverDecision'||review.version!==20||
  review.sourceSha!==LOCK.sourceSha||review.a19Head!==ROOTS.a19Head||
  review.reviewState!=='HUMAN_DECISION_NOT_OBTAINED'||
  review.humanReleaseGranted!==false||
  review.actualA12CutoverExecuted!==false||
  review.realPhysicalAcceptanceGranted!==false||
  !H.test(review.ownerOriginalPacketDigest||'')||
  !H.test(review.independentOperatorOriginalDigest||''))
  return deny('blocked-owner-authorization','Owner authorization must remain separately pending; release operation is not permitted.');
 return deny('precutover-owner-review-only','All synthetic documentary packets assembled. No human approval, physical acceptance or actual production deployment.');
}
function closure({precutover,cutover,realA13,postDevice,afterLedger,review}={}){
 if(precutover?.status!=='precutover-owner-review-only'||
  cutover?.status!=='completed-production-cutover'||
  cutover.independentOwnerApprovalAuthenticated!==true||
  cutover.sourceSha!==LOCK.sourceSha||
  cutover.productionDataMigration!=='none'||!W.utc(cutover.deployedAt)||
  realA13?.status!=='ready-for-manual-stability-review'||
  !Number.isSafeInteger(realA13.hoursObserved)||realA13.hoursObserved<24||realA13.hoursObserved>72||
  postDevice?.status!=='independently-reviewed-real-device-originals'||
  afterLedger?.status!=='multioperator-documentary-consistent')
  return deny('blocked-real-postrelease','Executed separate A12, genuine 24–72h A13, new real physical and external ledger evidence missing.');
 if(review?.format!=='GomokuA20OwnerPostreleaseDecision'||review.version!==20||
  review.sourceSha!==LOCK.sourceSha||review.a19Head!==ROOTS.a19Head||
  review.deploymentId!==cutover.deploymentId||review.humanClosureGranted!==false||
  review.reviewState!=='POSTRELEASE_REVIEW_NOT_APPROVED'||!W.utc(review.reviewedAt)||
  W.utc(review.reviewedAt)<=W.utc(cutover.deployedAt))
  return deny('blocked-later-owner-review','Distinct later original human closure review required.');
 return deny('postrelease-owner-review-only','Human closure still requires an independent real decision; never close automatically.');
}
function state(){return deny('NO_GO','Real device 0/18, hosted authorization, A11 signoff, A12 cutover, A13 monitoring and trust roots are OPEN.',
 {androidChrome:'0/7',samsungInternet:'0/6',installedPwa:'0/5',humanSignerRoots:0,
 hostedHttpsApproved:false,actualPriorRestore:false,independentGlobalLedger:false,
 actualA12:false,actualA13:false});}
module.exports={device,previousStable,release,closure,state};
