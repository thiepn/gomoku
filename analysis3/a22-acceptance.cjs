/* A22 physical/witness acceptance preparation + owner release/closure isolation. */
'use strict';
const crypto=require('node:crypto'),W=require('./a18-signer-reconciliation.cjs');
const A9=require('./rc9-core.cjs'),P=require('./a22-qualified-parent.json');
const H=/^[a-f0-9]{64}$/;
const ACCESS=require('./a21-hardware.cjs').ACCESS;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const deny=(status,reason,other={})=>W.result(status,reason,{...other,realPhysicalAccepted:0,
  genuineOwnerApproval:false,realCutoverAuthorized:false,realPostreleaseClosed:false});
function intake({packet,physicalBytes,accessibilityBytes,swBytes,priorStableBytes,prior,now=new Date()}={}){
 if(prior?.status!=='physical-and-restore-originals-documentary-only'||
  prior.physicalAccepted!==0||
  packet?.format!=='GomokuA22OriginalPhysicalWitness'||packet.version!==22||
  packet.sourceSha!==P.originalA9Source||packet.a21Head!==P.sourceHead||
  packet.ownerApprovalState!=='OPEN'||packet.reviewerApprovalState!=='OPEN'||
  packet.physicalCasesActuallyApproved!==0||packet.actualInstalledPwaRollbackPerformed!==false||
  packet.productionOriginTouched!==false||!Array.isArray(packet.cases)||packet.cases.length!==18||
  !Array.isArray(packet.assistive)||packet.assistive.length!==7||
  !physicalBytes||!accessibilityBytes)
  return deny('blocked-hardware-source','Original bounded byte witness, exact source and pending-only reviewer cases absent.');
 const seen=new Set(),hashes=new Set(),device=new Map();
 for(const c of packet.cases){
  const name=c?.platform+':'+c?.caseId,bytes=physicalBytes[name];
  if(!A9.DEVICE_CHECKS[c?.platform]?.includes(c.caseId)||seen.has(name)||
   c.status!=='pending-independent-source-witness'||!H.test(c.sha256||'')||
   hashes.has(c.sha256)||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>10*1024*1024||
   sha(bytes)!==c.sha256||!H.test(c.rightsOriginalSha256||'')||
   typeof c.deviceId!=='string'||!c.deviceId.trim()||
   typeof c.operatorId!=='string'||!c.operatorId.trim()||
   typeof c.browserVersion!=='string'||!c.browserVersion.trim()||
   typeof c.osVersion!=='string'||!c.osVersion.trim()||
   !W.utc(c.capturedAt)||W.utc(c.capturedAt)>now)
   return deny('blocked-case-originals','Wrong real-device name, source rights, duplicate original media or missing device witness attribution.');
  const d=device.get(c.platform);
  if(d&&[d.deviceId,d.operatorId,d.browserVersion,d.osVersion].some((x,i)=>x!==[c.deviceId,c.operatorId,c.browserVersion,c.osVersion][i]))
   return deny('blocked-device-series','Hardware/OS/browser/operator changed without separate original witness epoch.');
  device.set(c.platform,c);seen.add(name);hashes.add(c.sha256);
 }
 if(Object.keys(physicalBytes).length!==18||Object.entries(A9.DEVICE_CHECKS).some(([platform,ids])=>
  ids.some(id=>!seen.has(platform+':'+id))))
  return deny('blocked-case-coverage','Exactly 7 Chrome/6 Samsung/5 installed PWA originals, no extra attachments.');
 const assistSeen=new Set();
 for(const a of packet.assistive){
  const bytes=accessibilityBytes[a?.id];
  if(!ACCESS.includes(a?.id)||assistSeen.has(a.id)||
   a.status!=='pending-independent-assistive-review'||!H.test(a.sha256||'')||
   hashes.has(a.sha256)||!Buffer.isBuffer(bytes)||bytes.length<1||
   bytes.length>10*1024*1024||sha(bytes)!==a.sha256||
   !W.utc(a.capturedAt)||W.utc(a.capturedAt)>now||
   !H.test(a.witnessRightsDigest||''))
   return deny('blocked-accessibility-originals','Seven distinct real screen-reader/keyboard/zoom/contrast/offline original byte buffers required.');
  assistSeen.add(a.id);hashes.add(a.sha256);
 }
 if(Object.keys(accessibilityBytes).length!==7||assistSeen.size!==7)
  return deny('blocked-accessibility-coverage','Incomplete or extra accessibility originals.');
 const sw=packet.serviceWorker,stable=packet.previousStable;
 if(!sw||sw.format!=='GomokuA22ServiceWorkerOriginals'||!swBytes||
  ['before','update','revert'].some(k=>!Buffer.isBuffer(swBytes[k])||!H.test(sw[k+'Sha256']||'')||sha(swBytes[k])!==sw[k+'Sha256'])||
  Object.keys(swBytes).length!==3||sw.beforeSha256===sw.updateSha256||
  sw.revertSha256!==sw.beforeSha256||
  sw.realServiceWorkerUpdateAuthorized!==false||
  !stable||stable.format!=='GomokuA22DistinctPreviousStableOriginal'||
  stable.status!=='REAL_ROLLBACK_NOT_PERFORMED'||
  !H.test(stable.sha256||'')||stable.sha256===P.originalOfflineZipSha256||
  !Buffer.isBuffer(priorStableBytes)||priorStableBytes.length<1||
  priorStableBytes.length>50*1024*1024||sha(priorStableBytes)!==stable.sha256||
  stable.playerStateRestored!==false||!H.test(stable.originalCustodianDigest||''))
  return deny('blocked-recovery-originals','Prior stable source distinct from A9 and byte-backed SW upgrade/revert required, no live update or player data.');
 return deny('physical-witness-originals-documentary-only','18+7 originals, unchanged device families, and distinct SW/prior-stable bytes reconcile as synthetic documentary evidence; no real case approved.',
  {cases:18,accessibility:7,stableSha256:stable.sha256,originalsDigest:W.hash(packet)});
}
function decide({escrow,incident,physical,packet,now=new Date()}={}){
 if(escrow?.status!=='external-original-receipts-documentary-only'||
  incident?.status!=='incident-originals-documentary-only'||
  physical?.status!=='physical-witness-originals-documentary-only')
  return deny('blocked-owner-evidence','Independent external escrow/incident/device review prerequisites missing.');
 if(packet?.format!=='GomokuA22OwnerReleaseDecision'||packet.version!==22||
  packet.sourceSha!==P.originalA9Source||packet.a21Head!==P.sourceHead||
  packet.phase!=='precutover-review-only'||packet.humanOwnerSignoff!=='OPEN'||
  packet.independentReviewerSignoff!=='OPEN'||packet.actualA12Cutover!==false||
  packet.previewHostIndependentlyAuthorized!==false||packet.physicalCasesApproved!==0||
  !H.test(packet.ownerOriginalDigest||'')||!H.test(packet.reviewerOriginalDigest||'')||
  packet.ownerOriginalDigest===packet.reviewerOriginalDigest||
  packet.escrowRoot!==escrow.finalRoot||packet.hardwareOriginalDigest!==physical.originalsDigest||
  !W.utc(packet.reviewedAt)||W.utc(packet.reviewedAt)>now)
  return deny('blocked-owner-review','Precutover proposal must be two-party distinct and source-bound, never actual release authorization.');
 return deny('owner-precutover-review-only','Owner/reviewer originals are unapproved documentary claims, not permission for staging, prod cutover or deployment.',
  {packetDigest:W.hash(packet)});
}
function after({precutover,cutover,stability,postDevice,owner,now=new Date()}={}){
 if(precutover?.status!=='owner-precutover-review-only'||
  cutover?.status!=='ACTUAL_A12_CUTOVER_CLAIMED'||cutover.humanOwnerApprovalVerified!==true||
  cutover.sourceSha!==P.originalA9Source||
  !W.utc(cutover.executedAt)||cutover.productionDataMigrated!==false||
  stability?.status!=='ACTUAL_A13_P20_TELEMETRY_CLAIMED'||
  !Number.isSafeInteger(stability.hours)||stability.hours<24||stability.hours>72||
  !H.test(stability.originalMinuteSourceSha256||'')||
  postDevice?.status!=='INDEPENDENT_REAL_HARDWARE_REVIEW_CLAIMED'||
  postDevice.originalCount!==18)
  return deny('blocked-postrelease-real-world','Executed human-authorized A12, true 24-72h A13 production and postrelease physical evidence remain unavailable.');
 if(owner?.format!=='GomokuA22OwnerClosureDecision'||owner.phase!=='postrelease-review-only'||
  owner.humanClosureGranted!==false||owner.deploymentId!==cutover.deploymentId||
  !W.utc(owner.reviewedAt)||W.utc(owner.reviewedAt)<=W.utc(cutover.executedAt)||
  !H.test(owner.originalOwnerDigest||'')||!H.test(owner.originalReviewerDigest||'')||
  owner.originalOwnerDigest===owner.originalReviewerDigest)
  return deny('blocked-closure-review','Owner closure original must be distinct and later than actual executed cutover.');
 return deny('postrelease-documentary-owner-review-only','Even separately reviewed postrelease original does not autonomously approve human closure.');
}
function status(){return deny('NO_GO','No independently authorized live host, real original physical devices, genuine owner keys, executed A12 or real A13.',
 {chrome:'0/7',samsung:'0/6',pwa:'0/5',humanKeys:0,hostedHttps:false,
  realPriorStableRecovery:false,actualA12:false,actualA13Hours:0});}
module.exports={intake,decide,after,status,deny};
