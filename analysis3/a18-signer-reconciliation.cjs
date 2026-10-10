/* A18 review-only detached witness verification. Document-signature matching is NOT human acceptance. */
'use strict';
const crypto=require('node:crypto');
const A14=require('./a14-custody.cjs'),LOCK=require('./a10-source-lock.json');
const ANCHORS=require('./a18-source-pins.json'),ROOTS=require('./a18-review-roots.json');
const SHA=/^[0-9a-f]{64}$/,SHA40=/^[0-9a-f]{40}$/;
const ROLES=Object.freeze(['host-custodian','device-witness','independent-reviewer','ledger-custodian','release-owner']);
const KINDS=Object.freeze({
 'host-byte-intake':['host-custodian','independent-reviewer'],
 'physical-device-review':['device-witness','independent-reviewer'],
 'previous-stable-restore':['host-custodian','independent-reviewer'],
 'external-replay-ledger':['ledger-custodian','independent-reviewer'],
 'key-revocation':['ledger-custodian','independent-reviewer','release-owner'],
 'precutover-owner-review':['independent-reviewer','release-owner'],
 'postrelease-closure-review':['independent-reviewer','release-owner']
});
function result(status,reason,more={}){
 return Object.freeze({format:'GomokuA18IndependentWitnessReview',version:18,status,reason,...more,
 canMerge:false,canDeploy:false,canTag:false,canModifyProductionData:false,
 canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
 warning:'Validated synthetic or documentary signatures cannot prove real-world witness independence, authentic human consent, physical devices, immutable provider custody or production authorization.'});
}
const hash=o=>A14.sha(o);
function verifiedRoots(roots=ROOTS){
 if(roots?.format!=='GomokuA18IndependentOperatorRoots'||roots.version!==18||
  roots.repo!=='thiepn/gomoku'||roots.a17Head!==ANCHORS.upstreamA17||
  !Array.isArray(roots.issuerKeys)||roots.issuerKeys.length!==ROLES.length||
  !Array.isArray(roots.revokedKeys)||!Array.isArray(roots.rotationHistory)||
  new Set(roots.revokedKeys).size!==roots.revokedKeys.length) return null;
 const ids=new Set(),people=new Set(),roles=new Map();
 for(const row of roots.issuerKeys){
  if(!row||!ROLES.includes(row.role)||typeof row.keyId!=='string'||!row.keyId||
   typeof row.person!=='string'||!row.person.trim()||
   typeof row.publicKeyPem!=='string'||!SHA.test(row.spkiSha256||'')||
   row.privateKeyPem!==undefined||row.revoked===true||
   ids.has(row.keyId)||people.has(row.person)||roles.has(row.role)||
   roots.revokedKeys.includes(row.keyId))return null;
  let key;try{key=crypto.createPublicKey(row.publicKeyPem)}catch{return null}
  if(key.asymmetricKeyType!=='ed25519'||crypto.createHash('sha256')
   .update(key.export({type:'spki',format:'der'})).digest('hex')!==row.spkiSha256)return null;
  ids.add(row.keyId);people.add(row.person);roles.set(row.role,{...row,key});
 }
 if(ROLES.some(role=>!roles.has(role)))return null;
 for(const epoch of roots.rotationHistory){
  if(!epoch||!SHA.test(epoch.previousDigest||'')||!SHA.test(epoch.nextDigest||'')||
   !SHA.test(epoch.independentReviewDigest||'')||
   !Array.isArray(epoch.revokedKeys)||epoch.revokedKeys.some(k=>!roots.revokedKeys.includes(k)))
   return null;
 }
 return roles;
}
function utc(value){
 if(typeof value!=='string'||!/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))
  return null;
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return null;
 return d.toISOString().replace('.000Z','Z')===value||d.toISOString()===value?d:null;
}
function verify({kind,payload,envelope,roots=ROOTS,now=new Date()}={}){
 const required=KINDS[kind];
 if(!required)return result('blocked-kind','Unsupported or nonreviewable evidence stage.');
 const roles=verifiedRoots(roots);
 if(!roles)return result('blocked-roots','No five independently vetted public signer roots; defaults stay unprovisioned.');
 if(!payload||!envelope||envelope.format!=='GomokuA18SignedOriginals'||
  envelope.version!==18||envelope.kind!==kind||
  envelope.repository!=='thiepn/gomoku'||envelope.originalSourceSha!==LOCK.sourceSha||
  envelope.a17Head!==ANCHORS.upstreamA17||
  !SHA40.test(envelope.productionCommitSha||'')||
  typeof envelope.deploymentId!=='string'||!envelope.deploymentId.trim()||
  !SHA.test(envelope.payloadDigest||'')||envelope.payloadDigest!==hash(payload)||
  !SHA.test(envelope.challengeDigest||''))
  return result('blocked-binding','Original A9/A17 immutable identity, deployment, source evidence or challenge digest changed.');
 const issued=utc(envelope.issuedAt),expires=utc(envelope.expiresAt);
 if(!issued||!expires||!Number.isFinite(now?.getTime?.())||
  issued.getTime()>now.getTime()+60000||expires.getTime()<=now.getTime()||
  expires.getTime()<=issued.getTime()||expires.getTime()-issued.getTime()>86400000)
  return result('blocked-time','Original witness envelope timestamp, lifetime or clock chronology invalid.');
 if(!Array.isArray(envelope.signatures)||envelope.signatures.length!==required.length)
  return result('blocked-signers','Every required distinct signer must sign exact canonical envelope bytes.');
 const seen=new Set();const {signatures:_,...body}=envelope;
 for(const role of required){
  const row=envelope.signatures.find(x=>x?.role===role),key=roles.get(role);
  if(!row||seen.has(role)||row.keyId!==key.keyId||row.person!==key.person||
   typeof row.signature!=='string'||row.signature.length!==88)
   return result('blocked-signers','Missing, mismatched or reused signer role: '+role);
  const raw=Buffer.from(row.signature,'base64');
  if(raw.length!==64||raw.toString('base64')!==row.signature||
   !crypto.verify(null,Buffer.from(A14.canonical(body)),key.key,raw))
   return result('blocked-signature','Original detached Ed25519 signature invalid for '+role);
  seen.add(role);
 }
 if(envelope.signatures.some(x=>!seen.has(x.role)))return result('blocked-signers','Unreviewed extra signing role.');
 return result('signed-originals-document-only','Exact-source signer fingerprints and canonical detached signatures match. Human approval remains separate.',
  {kind,verifiedRoles:[...seen],payloadDigest:envelope.payloadDigest});
}
function rotation({prior=ROOTS,proposed,review,now=new Date()}={}){
 const old=verifiedRoots(prior);
 if(!old)return result('blocked-prior-roots','No authorized prior trust epoch; cannot bootstrap a new root from its own signature.');
 if(!proposed||proposed.format!=='GomokuA18IndependentOperatorRoots'||proposed.version!==18||
  proposed.a17Head!==ANCHORS.upstreamA17||proposed.repo!=='thiepn/gomoku'||
  !Array.isArray(proposed.revokedKeys)||prior.revokedKeys.some(x=>!proposed.revokedKeys.includes(x)))
  return result('blocked-revocation','Revocation timeline must retain every previous revoked key.');
 if(!verifiedRoots(proposed))return result('blocked-proposed-roots','Invalid replacement role topology, fingerprint or revoked identity.');
 const next=verifiedRoots(proposed);
 for(const role of ROLES){
  const was=old.get(role),cur=next.get(role);
  if(cur.keyId===was.keyId&&cur.spkiSha256!==was.spkiSha256)
   return result('blocked-key-reuse','Existing signer key ID cannot be rebound to different fingerprint.');
  if(cur.keyId!==was.keyId&&!proposed.revokedKeys.includes(was.keyId))
   return result('blocked-revocation','Superseded trust-root key must be permanently revoked.');
 }
 const p={priorDigest:hash(prior),nextDigest:hash(proposed),a17Head:ANCHORS.upstreamA17};
 if(review?.format!=='GomokuA18SignedRotationReview'||review.payload?.priorDigest!==p.priorDigest||
  review.payload?.nextDigest!==p.nextDigest||review.payload?.a17Head!==p.a17Head)
  return result('blocked-rotation-review','Independent predecessor-owner and reviewer signature chain missing.');
 const v=verify({kind:'key-revocation',payload:review.payload,envelope:review.envelope,roots:prior,now});
 return v.status==='signed-originals-document-only'
  ?result('ready-for-human-key-rotation-review','Historical pinned signer fingerprints cross-check; no keys rotated or approved automatically.',
    {proposedDigest:p.nextDigest})
  :v;
}
module.exports={result,hash,verify,verifiedRoots,rotation,KINDS,ROLES,utc};
