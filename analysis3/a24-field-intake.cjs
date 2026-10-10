/* A24 INCREMENTAL field-original byte intake: accepts partial original media, never physical certification.
   No network, no device APIs, no permanent storage, no player-account access.
 */
'use strict';
const A9=require('./rc9-core.cjs'),ACCESS=require('./a21-hardware.cjs').ACCESS;
const P=require('./a23-parent-evidence.json'),{readUnder,sha,utc}=require('./a24-offline-intake.cjs');
const ALL=Object.entries(A9.DEVICE_CHECKS).flatMap(([p,ids])=>ids.map(id=>p+':'+id));
const H=/^[a-f0-9]{64}$/;
function field({manifest,root,now=new Date()}={}){
 if(manifest?.format!=='GomokuA24FieldOriginalIntake'||manifest.version!==24||
  manifest.sourceSha!==P.a9OriginalSha||
  manifest.a23Head!=='d36610bc49aa0cee03f3a649108fda98e99094ee'||
  manifest.humanOwnerApproval!=='NOT_OBTAINED'||manifest.releaseState!=='NO_GO'||
  manifest.physicalCasesAccepted!==0||manifest.productionDataTouched!==false||
  !Array.isArray(manifest.cases)||!Array.isArray(manifest.accessibility)||
  manifest.cases.length+manifest.accessibility.length<1)
  throw Error('Rejected A24 physical intake scope, source identity or claim of approval');
 const seen=new Set(),digests=new Set(),units=new Map(),records=[];
 for(const c of manifest.cases){
  const id=c?.platform+':'+c?.caseId;
  if(!ALL.includes(id)||seen.has(id)||c.status!=='OBSERVED_PENDING_INDEPENDENT_REVIEW'||
   c.originalFile!=='media/'+c.platform+'/'+c.caseId+'.bin'||
   !H.test(c.sha256||'')||digests.has(c.sha256)||
   !c.hardwareModel?.trim()||!c.androidVersion?.trim()||!c.browserVersion?.trim()||
   !c.operatorId?.trim()||!c.observation?.trim()||c.observation.trim().length<24||
   !H.test(c.ownerRightsIntakeSha256||''))
   throw Error('Incorrect device witness original case/rights/scope: '+id);
  utc(c.observedAt,now);
  const bytes=readUnder(root,c.originalFile);
  if(sha(bytes)!==c.sha256)throw Error('Original physical media SHA mismatch: '+id);
  const prior=units.get(c.platform);
  if(prior&&['hardwareModel','androidVersion','browserVersion','operatorId'].some(k=>prior[k]!==c[k]))
   throw Error('Changed physical device/browser/operator series requires a separate original cohort');
  units.set(c.platform,c);seen.add(id);digests.add(c.sha256);
  records.push({category:'device',id,status:'PENDING_UNAUTHENTICATED_PHYSICAL_REVIEW',
   sha256:c.sha256,bytes:bytes.length,reportedHardware:c.hardwareModel,
   reportedOS:c.androidVersion,reportedBrowser:c.browserVersion,
   operator:c.operatorId});
 }
 const seenAccess=new Set();
 for(const a of manifest.accessibility){
  if(!ACCESS.includes(a?.id)||seenAccess.has(a.id)||
   a.status!=='OBSERVED_PENDING_INDEPENDENT_REVIEW'||
   a.originalFile!=='assistive/'+a.id+'.bin'||
   !H.test(a.sha256||'')||digests.has(a.sha256)||
   !H.test(a.ownerRightsIntakeSha256||'')||
   !a.assistiveTechnology?.trim()||!a.operatorId?.trim()||
   !a.observation?.trim()||a.observation.trim().length<24)
   throw Error('Invalid or repeated accessibility original media: '+a?.id);
  utc(a.observedAt,now);
  const bytes=readUnder(root,a.originalFile);
  if(sha(bytes)!==a.sha256)throw Error('Assistive original byte SHA mismatch: '+a.id);
  seenAccess.add(a.id);digests.add(a.sha256);
  records.push({category:'accessibility',id:a.id,sha256:a.sha256,bytes:bytes.length,
   technology:a.assistiveTechnology,operator:a.operatorId,
   status:'PENDING_UNAUTHENTICATED_ASSISTIVE_REVIEW'});
 }
 return{format:'GomokuA24UnsignedIncrementalFieldReview',version:24,
  originalA9SourceSha:P.a9OriginalSha,a23Head:manifest.a23Head,
  totalPhysicalRequired:18,totalAssistiveRequired:7,
  physicallyAcceptedBySoftware:0,
  originalsWithByteIntegrityChecked:records.length,
  pendingCaseCount:seen.size,pendingAssistiveCount:seenAccess.size,
  missingCases:ALL.filter(x=>!seen.has(x)),
  missingAccessibility:ACCESS.filter(x=>!seenAccess.has(x)),
  records,independentRealHardwareAttestation:false,
  independentHumanOwnerApproval:false,
  actualServiceWorkerUpdate:false,actualPreviousStableRestore:false,
  canMerge:false,canTag:false,canDeploy:false,canCertifyPhysical:false,canCloseRelease:false,
  decision:'NO_GO'};
}
function rollback({packet,root,now=new Date()}={}){
 if(packet?.format!=='GomokuA24OfflineRollbackReview'||packet.version!==24||
  packet.a23Head!=='d36610bc49aa0cee03f3a649108fda98e99094ee'||
  packet.originalA9SourceSha!==P.a9OriginalSha||
  packet.ownerRestoreApproval!=='NOT_OBTAINED'||
  packet.realSameOriginUpdatePerformed!==false||
  packet.realPlayerDataRestored!==false||
  packet.realProductionTouched!==false||
  !H.test(packet.previousStableSha256||'')||
  packet.previousStableSha256===P.a9NestedZipSha256||
  !H.test(packet.beforeSwSha256||'')||!H.test(packet.updatedSwSha256||'')||
  packet.beforeSwSha256===packet.updatedSwSha256||
  packet.beforeSwSha256!==packet.revertedSwSha256)
  throw Error('Rollback review cannot claim live restore, A9 previous stable or human approval');
 utc(packet.observedAt,now);
 const names=[['previousStable','prior/previous-stable.bin','previousStableSha256'],
  ['before','sw/before.bin','beforeSwSha256'],['updated','sw/updated.bin','updatedSwSha256'],
  ['reverted','sw/reverted.bin','revertedSwSha256']];
 const content=Object.fromEntries(names.map(([name,file,key])=>{
  const bytes=readUnder(root,file,{max:name==='previousStable'?50*1024*1024:10*1024*1024});
  if(sha(bytes)!==packet[key])throw Error('Original rollback media SHA mismatch: '+name);
  return [name,{sha256:sha(bytes),bytes:bytes.length}];
 }));
 if(content.before.sha256===content.updated.sha256||
  content.before.sha256!==content.reverted.sha256)
  throw Error('Original service worker did not change or revert');
 return{format:'GomokuA24UnsignedRollbackOriginalReview',
  originalA9SourceSha:P.a9OriginalSha,sourceHead:packet.a23Head,
  originalByteHashes:content,actualDeployedPreviousStableVerified:false,
  realServiceWorkerUpdateOrRollbackPerformed:false,playerStateRecoveryAccepted:false,
  humanOwnerAuthority:false,decision:'NO_GO'};
}
module.exports={field,rollback,ALL,ACCESS};
