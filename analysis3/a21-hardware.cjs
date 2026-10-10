/* A21 physical-device, accessibility, and prior-stable escrow. No physical acceptance. */
'use strict';
const crypto=require('node:crypto');
const P=require('./a21-qualified-parent.json'),LOCK=require('./a10-source-lock.json');
const W=require('./a18-signer-reconciliation.cjs'),A9=require('./rc9-core.cjs');
const H=/^[a-f0-9]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=(status,reason,more={})=>W.result(status,reason,{...more,physicalAccepted:0,realRestoreAccepted:false});
const ACCESS=['screen-reader','keyboard-or-switch','zoom-200','reduced-motion','focus-order','contrast','offline-state-persistence'];
function inspect({packet,caseOriginals,assistiveOriginals,swOriginals,priorBytes,priorA20,now=new Date()}={}){
 if(priorA20?.status!=='device-originals-documentary-only'||
  priorA20.physicalAccepted!==0||
  packet?.format!=='GomokuA21PhysicalEscrow'||packet.version!==21||
  packet.sourceSha!==LOCK.sourceSha||packet.a20Head!==P.head||
  packet.ownerHumanAuthorization!=='OPEN'||packet.reviewerHumanAuthorization!=='OPEN'||
  packet.realPhysicalAccepted!==0||packet.deploymentExecuted!==false||
  !Array.isArray(packet.cases)||packet.cases.length!==18||
  !Array.isArray(packet.accessibility)||packet.accessibility.length!==7||
  !caseOriginals||!assistiveOriginals||!swOriginals)
  return fail('blocked-hardware-intake','No original source-bound 18+7 hardware/media custody packet or owner review.');
 const uniqueHashes=new Set(),seenCases=new Set(),series=new Map();
 for(const c of packet.cases){
  const k=c?.platform+':'+c?.caseId;
  if(!A9.DEVICE_CHECKS[c?.platform]?.includes(c?.caseId)||
   seenCases.has(k)||c.status!=='pending-independent-original-review'||
   !H.test(c.mediaSha256||'')||uniqueHashes.has(c.mediaSha256)||
   !Buffer.isBuffer(caseOriginals[k])||caseOriginals[k].length===0||
   caseOriginals[k].length>10*1024*1024||sha(caseOriginals[k])!==c.mediaSha256||
   typeof c.hardwareId!=='string'||!c.hardwareId.trim()||
   typeof c.browserVersion!=='string'||!c.browserVersion.trim()||
   typeof c.osVersion!=='string'||!c.osVersion.trim()||
   typeof c.operatorId!=='string'||!c.operatorId.trim()||
   !W.utc(c.observedAt)||W.utc(c.observedAt)>now||
   !H.test(c.sourceRightsDigest||''))
    return fail('blocked-hardware-original','Altered/duplicated media, rights, actual hardware attribution or 18-case source identity.');
  const previous=series.get(c.platform);
  if(previous&&(previous.hardwareId!==c.hardwareId||previous.operatorId!==c.operatorId||
     previous.browserVersion!==c.browserVersion||previous.osVersion!==c.osVersion))
    return fail('blocked-device-series','Original device-series identity cannot silently change between cases.');
  seenCases.add(k);uniqueHashes.add(c.mediaSha256);series.set(c.platform,c);
 }
 if(Object.keys(caseOriginals).length!==18||
   Object.keys(A9.DEVICE_CHECKS).some(p=>A9.DEVICE_CHECKS[p].some(id=>!seenCases.has(p+':'+id))))
  return fail('blocked-device-matrix','Exact 7/6/5 device coverage, and no extra source objects, mandatory.');
 const seenAccess=new Set();
 for(const a of packet.accessibility){
  if(!ACCESS.includes(a.id)||seenAccess.has(a.id)||
   a.status!=='pending-independent-accessibility-review'||
   !H.test(a.sha256||'')||uniqueHashes.has(a.sha256)||
   !Buffer.isBuffer(assistiveOriginals[a.id])||assistiveOriginals[a.id].length<1||
   assistiveOriginals[a.id].length>10*1024*1024||sha(assistiveOriginals[a.id])!==a.sha256||
   typeof a.originalObservation!=='string'||a.originalObservation.trim().length<24||
   !W.utc(a.observedAt)||W.utc(a.observedAt)>now)
    return fail('blocked-assistive-media','Seven original accessible-use media buffers, separate hashes and observations required.');
  seenAccess.add(a.id);uniqueHashes.add(a.sha256);
 }
 if(Object.keys(assistiveOriginals).length!==7||ACCESS.some(x=>!seenAccess.has(x)))
  return fail('blocked-assistive-coverage','Exact seven assistive original names and no extras.');
 const sw=packet.serviceWorker,prior=packet.priorStable;
 if(sw?.format!=='GomokuA21ServiceWorkerOriginals'||
  sw.origin!==packet.originalPreviewOrigin||
  !H.test(sw.beforeSha256||'')||!H.test(sw.updatedSha256||'')||
  sw.beforeSha256===sw.updatedSha256||sw.revertedSha256!==sw.beforeSha256||
  sw.updateActuallyWitnessedAndApproved!==false||
  !Buffer.isBuffer(swOriginals.before)||!Buffer.isBuffer(swOriginals.updated)||
  !Buffer.isBuffer(swOriginals.reverted)||
  sha(swOriginals.before)!==sw.beforeSha256||
  sha(swOriginals.updated)!==sw.updatedSha256||
  sha(swOriginals.reverted)!==sw.revertedSha256||
  Object.keys(swOriginals).sort().join('|')!=='before|reverted|updated')
  return fail('blocked-sw-originals','Original service worker must change and revert in independently preserved offline byte fixtures; no real approval.');
 if(prior?.format!=='GomokuA21PreviousStableOriginal'||prior.status!=='ORIGINAL_RESTORE_NOT_EXECUTED'||
  !H.test(prior.archiveSha256||'')||prior.archiveSha256===P.originalNestedZipSha256||
  !Buffer.isBuffer(priorBytes)||priorBytes.length===0||priorBytes.length>50*1024*1024||
  sha(priorBytes)!==prior.archiveSha256||prior.playerRecordsTouched!==false||
  prior.realPwaRollbackAccepted!==false||
  !H.test(prior.independentArchiveReceiptSha256||''))
  return fail('blocked-prior-stable','A distinct byte-verified previous stable original must remain unrestored and owner-unauthorized.');
 if(packet.originalPreviewOrigin!==sw.origin||
  !/^https:\/\/[a-z0-9-]+\.vercel\.app\/$/.test(packet.originalPreviewOrigin||'')||
  packet.productionOriginTouched!==false)
  return fail('blocked-hardware-origin','Exact isolated hosted preview origin required, with no production origin touch.');
 return fail('physical-and-restore-originals-documentary-only',
  '25 media byte originals, separately recorded SW changes, and prior original archive match. Genuine devices/owner approval and player-state recovery are NOT established.',
  {physicalCaseOriginals:18,assistiveOriginals:7,swOriginalBytes:3,
   sourceDigest:W.hash(packet),priorStableSha256:prior.archiveSha256});
}
function conflicts({observations}={}){
 if(!Array.isArray(observations)||observations.length<2)return fail('blocked-observation-input','At least two independently received device originals required.');
 const seen=new Map(),disputes=[];
 for(const o of observations){
  const key=o?.platform+':'+o?.caseId;
  if(!A9.DEVICE_CHECKS[o?.platform]?.includes(o?.caseId)||
    !H.test(o.sha256||'')||typeof o.witnessId!=='string'||!o.witnessId.trim()||
    o.status!=='pending-review')
    return fail('blocked-original-observation','Original physical record invalid or not pending.');
  const prev=seen.get(key);
  if(prev&&prev.sha256!==o.sha256)
   disputes.push({case:key,digests:[prev.sha256,o.sha256],witnessIds:[prev.witnessId,o.witnessId]});
  else if(!prev)seen.set(key,o);
 }
 return fail(disputes.length?'device-originals-disputed':'device-originals-consistent-documents',
  disputes.length?'Conflicting device case originals: require independent physical replay and reviewer resolution.':'Documents agree, still not real accepted physical observations.',
  {disputes,accepted:0,automatedArbitration:false});
}
module.exports={inspect,conflicts,ACCESS,fail};
