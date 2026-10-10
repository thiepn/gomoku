/* A23 authentic-original eligibility review: physical 7+6+5 and accessibility 7.
   No actual hardware, same-origin SW, rollback or production authorization occurs. */
'use strict';
const crypto=require('node:crypto'),W=require('./a18-signer-reconciliation.cjs');
const P=require('./a23-parent-evidence.json'),A9=require('./rc9-core.cjs');
const ACCESS=require('./a21-hardware.cjs').ACCESS,H=/^[a-f0-9]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const deny=(status,reason,extra={})=>W.result(status,reason,{...extra,
 physicalAccepted:0,actuallyRestored:false,canCloseRelease:false});
function inspect({packet,physical,assistive,swBytes,priorStableBytes,upstream,now=new Date()}={}){
 if(upstream?.status!=='physical-witness-originals-documentary-only'||
  packet?.format!=='GomokuA23PhysicalOriginals'||packet.version!==23||
  packet.sourceSha!==P.a9OriginalSha||packet.a22Head!==P.a22Head||
  packet.ownerHumanApproval!=='OPEN'||packet.deviceAcceptanceStatus!=='0/18'||
  packet.physicalAccepted!==0||packet.productionDataTouched!==false||
  !Array.isArray(packet.cases)||packet.cases.length!==18||
  !Array.isArray(packet.assistive)||packet.assistive.length!==7||
  !physical||!assistive||!swBytes)return deny('blocked-physical-origin','Original A22 evidence, exact 18+7 media and pending owner/device scope required.');
 const seen=new Set(),hashes=new Set(),series=new Map();
 for(const c of packet.cases){
  const id=c?.platform+':'+c?.caseId,b=physical[id],previous=series.get(c?.platform);
  if(!A9.DEVICE_CHECKS[c?.platform]?.includes(c.caseId)||seen.has(id)||
   c.status!=='unapproved-independent-review'||!H.test(c.sha256||'')||
   hashes.has(c.sha256)||!Buffer.isBuffer(b)||b.length<1||b.length>10*1024*1024||
   sha(b)!==c.sha256||!c.deviceId||!c.osVersion||!c.browserVersion||!c.operatorId||
   !H.test(c.originalRightsDigest||'')||!W.utc(c.at)||W.utc(c.at)>now||
   previous&&['deviceId','osVersion','browserVersion','operatorId'].some(key=>c[key]!==previous[key]))
   return deny('blocked-device-original','Exact original case bytes, independent physical source and stable device epoch required.');
  seen.add(id);hashes.add(c.sha256);series.set(c.platform,c);
 }
 if(Object.keys(physical).length!==18||Object.entries(A9.DEVICE_CHECKS).some(([k,v])=>v.some(id=>!seen.has(k+':'+id))))
  return deny('blocked-device-coverage','Exactly 7 Android Chrome, 6 Samsung Internet and 5 installed PWA original media objects.');
 const aseen=new Set();
 for(const a of packet.assistive){
  const b=assistive[a?.id];
  if(!ACCESS.includes(a?.id)||aseen.has(a.id)||a.status!=='pending-human-accessibility-review'||
   !H.test(a.sha256||'')||hashes.has(a.sha256)||
   !Buffer.isBuffer(b)||b.length<1||b.length>10*1024*1024||
   sha(b)!==a.sha256||!H.test(a.independentRightsDigest||'')||
   !W.utc(a.at)||W.utc(a.at)>now)
   return deny('blocked-assistive-original','Seven distinct original assistive technology media bytes, rights and witness metadata required.');
  aseen.add(a.id);hashes.add(a.sha256);
 }
 if(Object.keys(assistive).length!==7||aseen.size!==7)
  return deny('blocked-accessibility-matrix','Seven original assistive media and no extras.');
 const sw=packet.sw,stable=packet.priorStable;
 if(sw?.format!=='GomokuA23OriginalSW'||!Array.isArray(sw.versions)||sw.versions.join(',')!=='before,update,revert'||
  !['before','update','revert'].every(k=>Buffer.isBuffer(swBytes[k])&&swBytes[k].length>0&&
    H.test(sw[k+'Sha256']||'')&&sha(swBytes[k])===sw[k+'Sha256'])||
  Object.keys(swBytes).length!==3||sw.beforeSha256===sw.updateSha256||
  sw.beforeSha256!==sw.revertSha256||sw.realUpdatePerformed!==false||
  stable?.format!=='GomokuA23PriorStableOriginal'||!H.test(stable.sha256||'')||
  stable.sha256===P.a9NestedZipSha256||
  !Buffer.isBuffer(priorStableBytes)||priorStableBytes.length===0||
  priorStableBytes.length>50*1024*1024||sha(priorStableBytes)!==stable.sha256||
  stable.realRestorePerformed!==false||stable.playerDataAccessed!==false)
  return deny('blocked-real-restore','Original SW must change and reverse, with distinct unchanged prior-stable bytes, not actual deployed state.');
 return deny('physical-originals-documentary-only','18 physical + 7 accessibility originals, distinct SW versions and previous stable bytes verified as documentary packets. Original human/device authorization still OPEN.',
  {caseCount:18,accessibilityCount:7,packetSha256:W.hash(packet),priorSha256:stable.sha256});
}
function dispute({observations}={}){
 if(!Array.isArray(observations)||observations.length<2)return deny('blocked-observations','Two independently sourced observations required.');
 const records=new Map(),conflicts=[];
 for(const x of observations){
  if(!A9.DEVICE_CHECKS[x?.platform]?.includes(x?.caseId)||
   !H.test(x.originalSha256||'')||!x.witnessId||x.status!=='UNAPPROVED')
   return deny('blocked-observation','Wrong source or case identity.');
  const k=x.platform+':'+x.caseId,o=records.get(k);
  if(o&&o.originalSha256!==x.originalSha256)
   conflicts.push({case:k,originals:[o.originalSha256,x.originalSha256],witnesses:[o.witnessId,x.witnessId]});
  else if(!o)records.set(k,x);
 }
 return deny(conflicts.length?'real-device-originals-conflicted':'device-documents-concordant',
  conflicts.length?'Physically conflicting originals require separate human witness review.':'Documentary original hashes agree, NOT real device acceptance.',
  {conflicts,autoAccepted:false});
}
function beforeRelease({escrow,incident,device,review}={}){
 if(escrow?.status!=='multi-custodian-originals-documentary-only'||
  incident?.status!=='multi-provider-incident-documentary-only'||
  device?.status!=='physical-originals-documentary-only')
  return deny('blocked-staging-evidence','Distinct external escrow, key/replay incident and 18/7 originals missing.');
 if(review?.format!=='GomokuA23PrecutoverOwnerReview'||review.a22Head!==P.a22Head||
  review.sourceSha!==P.a9OriginalSha||review.realOwnerSigned!==false||
  review.realReviewerSigned!==false||review.physicalCasesApproved!==0||
  review.a12Executed!==false||review.hostedApproved!==false||
  !H.test(review.ownerOriginalSha256||'')||!H.test(review.reviewerOriginalSha256||'')||
  review.ownerOriginalSha256===review.reviewerOriginalSha256||
  review.escrowRoot!==escrow.finalRoot)return deny('blocked-precutover-owner','Separate owner/reviewer originals are only pending. No release authority can be obtained by source packets.');
 return deny('owner-precutover-documentary-only','Precutover packet structurally coherent; actual independent owner signoff and release are not approved.');
}
function afterRelease({before,actualA12,actualA13,postDevice,owner}={}){
 if(before?.status!=='owner-precutover-documentary-only'||
  actualA12?.status!=='HUMAN_APPROVED_AND_EXECUTED_CLAIM'||
  actualA12.originalIndependentOwnerSourceVerified!==true||
  actualA12.sourceSha!==P.a9OriginalSha||
  actualA13?.status!=='ACTUAL_PRODUCTION_P20_CLAIM'||
  !Number.isInteger(actualA13.hours)||actualA13.hours<24||actualA13.hours>72||
  !H.test(actualA13.originalMinuteSeriesSha256||'')||
  postDevice?.status!=='REAL_PHYSICAL_ACCEPTANCE_CLAIM'||
  postDevice.originalCases!==18)
  return deny('blocked-postrelease-real','Executed A12, original real 24–72h A13 and postrelease physical review absent.');
 if(owner?.format!=='GomokuA23OwnerClosure'||owner.actualHumanClosureGranted!==false||
  !H.test(owner.originalOwnerReceiptSha256||'')||
  !H.test(owner.originalReviewerReceiptSha256||'')||
  owner.originalOwnerReceiptSha256===owner.originalReviewerReceiptSha256||
  owner.deploymentId!==actualA12.deploymentId)
  return deny('blocked-owner-closure','Separate real subsequent owner closeout review and original receipts missing.');
 return deny('postrelease-owner-documentary-only','No autonomous operational closure or data access even with structural original documents.');
}
function status(){return deny('NO_GO','All human, hosted, physical, recovery, A12 and A13 permissions remain OPEN.',
 {physicalChrome:'0/7',physicalSamsung:'0/6',physicalPwa:'0/5',
  actualA12Executed:false,actualA13Monitoring:false,realSignerKeys:0});}
module.exports={inspect,dispute,beforeRelease,afterRelease,status};
