/* A15: static, read-only trust rotation and operational closure documentary review. */
'use strict';
const crypto=require('node:crypto');
const ROOTS=require('./a14-trust-roots.json');
const A14=require('./a14-custody.cjs');
const LOCK=require('./a10-source-lock.json');
const PINS=require('./a15-evidence-pins.json');
const H64=/^[0-9a-f]{64}$/i;
function deny(status,reason,extra={}){
 return {format:'GomokuA15OperatorClosure',version:15,status,reason,...extra,
  canApplyKeys:false,canMerge:false,canTag:false,canDeploy:false,
  canCloseRelease:false,canCertifyStable:false,canModifyProductionData:false,
  note:'No automatic promotion. This report is documentary and never substitutes for witnessed originals, independent custody, physical testing or actual owner consent.'};
}
function keyInfo(k){
 if(!k||typeof k!=='object'||typeof k.id!=='string'||!k.id||
   !['owner','release-operator','independent-reviewer'].includes(k.role)||
   typeof k.person!=='string'||!k.person.trim()||
   typeof k.publicKeyPem!=='string'||!H64.test(k.spkiSha256||'')||
   'privateKeyPem' in k||k.publicKeyPem.length>4096)return null;
 try{
  const pub=crypto.createPublicKey(k.publicKeyPem);
  if(pub.asymmetricKeyType!=='ed25519')return null;
  const fingerprint=crypto.createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex');
  return fingerprint===k.spkiSha256?{id:k.id,role:k.role,person:k.person,fingerprint}:null;
 }catch{return null}
}
function rotation({current=ROOTS,proposal,review}={}){
 if(current?.format!=='GomokuA14PinnedTrustRoots'||current.a13HeadSha!==PINS.requiredRuns[0].sha.slice(0,0)+'0801c96d9317c625646eb20bf69ffecbd4f731f9'||
  !Array.isArray(current.keys)||current.keys.length<3||!Array.isArray(current.revokedKeyIds))
  return deny('blocked-unprovisioned','No previously approved and separately reviewed A14 trust anchors; rotation cannot bootstrap authority from proposed keys.');
 const c=new Map();
 for(const k of current.keys){
  const x=keyInfo(k);
  if(!x||c.has(x.id))return deny('blocked-current-root','Current trust registry invalid.');
  c.set(x.id,x);
 }
 if(!proposal||proposal.format!=='GomokuA15TrustRotationProposal'||proposal.version!==15||
  proposal.sourceSha!==LOCK.sourceSha||proposal.a14HeadSha!==PINS.a14HeadSha||
  proposal.priorPolicyDigest!==A14.sha(current)||
  !Array.isArray(proposal.keys)||proposal.keys.length<3||proposal.keys.length>12||
  !Array.isArray(proposal.revokedKeyIds)||!H64.test(proposal.changeEvidenceDigest||''))
  return deny('blocked-proposal','Proposal does not bind exact prior registry and source or misses vetted replacement keys.');
 const next=new Map(),seenPersons=new Set(),roles=new Set(),revoked=new Set(proposal.revokedKeyIds);
 if(revoked.size!==proposal.revokedKeyIds.length||
  current.revokedKeyIds.some(x=>!revoked.has(x)))
  return deny('blocked-revocation','Revocations must be monotonic; duplicate revocations are not allowed.');
 for(const k of proposal.keys){
  const x=keyInfo(k);
  if(!x||next.has(x.id)||revoked.has(x.id)||
   seenPersons.has(x.person)||roles.has(x.role))
   return deny('blocked-roles','Duplicate signer, revoked key, unsupported key or self-approving roles.');
  next.set(x.id,x);seenPersons.add(x.person);roles.add(x.role);
  if(c.has(x.id)){
   const old=c.get(x.id);
   if(old.role!==x.role||old.person!==x.person||old.fingerprint!==x.fingerprint)
    return deny('blocked-key-reuse','Existing key ID cannot be silently reassigned to a different owner or fingerprint.');
  }else if(current.revokedKeyIds.includes(x.id))return deny('blocked-revocation','Revoked historical key may never be re-added.');
 }
 if(!['owner','release-operator','independent-reviewer'].every(x=>roles.has(x)))
  return deny('blocked-roles','Three distinct staffed operational roles are required.');
 const changes=[...next.keys()].filter(x=>!c.has(x)).length+
  [...c.keys()].filter(x=>!next.has(x)).length+
  [...revoked].filter(x=>!current.revokedKeyIds.includes(x)).length;
 if(changes<1)return deny('blocked-no-change','Rotation must change at least one trust key or revocation.');
 if(review?.format!=='GomokuA15IndependentRotationReview'||
  review.priorPolicyDigest!==A14.sha(current)||
  review.proposedPolicyDigest!==A14.sha(proposal)||
  !H64.test(review.originalsDigest||'')||
  !H64.test(review.witnessReportDigest||'')||
  typeof review.owner!=='string'||!review.owner||
  typeof review.independentReviewer!=='string'||!review.independentReviewer||
  review.owner===review.independentReviewer||
  !review.changeTicket||!review.reviewedAt||!Number.isFinite(Date.parse(review.reviewedAt)))
  return deny('blocked-review','Independent owner, change ticket and original key-ownership review required.');
 return deny('ready-for-external-key-review','Public-key fingerprints and documentary change order match, but no registry edits, key approvals or revocations executed.',
  {proposedPolicyDigest:A14.sha(proposal),changes});
}
function closure({github,offlineZip,ledger,custody,stability,external}={}){
 if(github?.status!=='ready-for-original-byte-and-independent-review'||
  github.a14HeadSha!==PINS.a14HeadSha||
  !github.validatedRuns?.includes(PINS.a9RunId)||
  !PINS.requiredRuns.every(x=>github.validatedRuns?.includes(x.id)))
  return deny('blocked-github','Exact-head independently fetched GitHub readback is missing.');
 if(offlineZip?.status!=='ready-for-independent-zip-review'||
  offlineZip.offlineZipSha256!==LOCK.offlineZipSha256)
  return deny('blocked-originals','Original A9 package content hash not independently checked.');
 if(ledger?.status!=='local-chain-valid-unanchored'||!H64.test(ledger.head||'')||
  ledger.consumed<1)return deny('blocked-ledger','Consumed locally tracked challenge absent; global replay authority still OPEN.');
 if(custody?.status!=='ready-for-independent-ledger-and-originals-review'||
  !H64.test(custody.chainDigest||'')||custody.replayLedgerNotIndependentlyAuthenticated!==true)
  return deny('blocked-custody','Three separately witnessed signed custody events not supplied.');
 if(stability?.format!=='GomokuAnalysis3A13StabilityReview'||
  stability.status!=='ready-for-manual-stability-review'||
  stability.sourceSha!==LOCK.sourceSha||stability.canCloseRelease!==false||
  !Number.isSafeInteger(stability.hoursObserved)||stability.hoursObserved<24||stability.hoursObserved>72)
  return deny('blocked-stability','A13 real-world stability receipt absent or incomplete.');
 if(external?.format!=='GomokuA15IndependentClosureReview'||
  external.a14HeadSha!==PINS.a14HeadSha||
  !H64.test(external.originalsDigest||'')||
  !H64.test(external.externalReplayLedgerDigest||'')||
  external.externalReplayLedgerDigest===ledger.head||
  !H64.test(external.humanSignoffDigest||'')||
  !external.reviewedAt||
  !Number.isFinite(Date.parse(external.reviewedAt))||
  typeof external.owner!=='string'||!external.owner||
  typeof external.reviewer!=='string'||!external.reviewer||
  external.reviewer===external.owner||
  external.originalEvidenceIndependentlyWitnessed!==true)
  return deny('blocked-independent-review','Separate owner, reviewer, independently anchored replay ledger and original-evidence review remain absent.');
 return deny('ready-for-separate-owner-closure-decision','Originals and signed records appear documented but are not authenticated by this purely documentary combiner; a separate actual owner closure decision remains mandatory.');
}
if(require.main===module){
 const out=closure();console.log(JSON.stringify(out,null,2));process.exitCode=2;
}
module.exports={rotation,closure,keyInfo};
