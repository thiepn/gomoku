/* A14: offline Ed25519 custody and lifecycle validation; never a release or human approval. */
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const LOCK=require('./a10-source-lock.json');
const POLICY=require('./a14-trust-roots.json');
const {allowedPublicOrigin}=require('./a13-live-probe.cjs');
const H40=/^[a-f0-9]{40}$/i,H64=/^[a-f0-9]{64}$/i,H32=/^[a-f0-9]{32}$/i;
const stages=Object.freeze(['cutover','stability','handoff']);
const roles=Object.freeze(['release-operator','independent-reviewer','owner']);
const A12='e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07';
const A13='0801c96d9317c625646eb20bf69ffecbd4f731f9';
function canonical(x,depth=0){
 if(depth>25)throw Error('JSON nesting exceeds safe limit.');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(v=>canonical(v,depth+1)).join(',')+']';
 if(x&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)){
  const keys=Object.keys(x).sort();
  if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('Unsafe JSON object key.');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(x[k],depth+1)).join(',')+'}';
 }
 throw Error('Only plain canonical JSON data is permitted.');
}
const sha=x=>crypto.createHash('sha256').update(canonical(x),'utf8').digest('hex');
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===new Date(x).toISOString();
const denied=(status,reason,extra={})=>Object.freeze({format:'GomokuA14CustodyAudit',version:14,
 status,reason,...extra,sourceSha:LOCK.sourceSha,canMerge:false,canTag:false,canDeploy:false,
 canCertifyStable:false,canCloseRelease:false,canModifyProductionData:false,
 notice:'Cryptographic/documentary verification never substitutes for independent original-evidence review, fresh replay ledger or real human approval.'});
function verify({packet,policy=POLICY,usedChallenges=[],now=new Date()}={}){
 try{return inspect(packet,policy,usedChallenges,now);}catch(e){return denied('blocked-invalid',String(e.message));}
}
function inspect(packet,policy,usedChallenges,now){
 if(policy?.format!=='GomokuA14PinnedTrustRoots'||policy.version!==1||
  policy.repository!=='thiepn/gomoku'||policy.a12HeadSha!==A12||policy.a13HeadSha!==A13||
  !Array.isArray(policy.keys)||!Array.isArray(policy.revokedKeyIds)||
  policy.keys.length<3)
  return denied('blocked-trust-root','No independently reviewed, SHA-pinned production role trust roots are configured.');
 if(policy.keys.length>12||new Set(policy.keys.map(k=>k.id)).size!==policy.keys.length||
  policy.revokedKeyIds.some(id=>typeof id!=='string')||
  new Set(policy.revokedKeyIds).size!==policy.revokedKeyIds.length)
  return denied('blocked-trust-root','Ambiguous, oversized or duplicate public-key/revocation policy.');
 const keys=new Map();
 for(const k of policy.keys){
  if(!k||!roles.includes(k.role)||typeof k.id!=='string'||!k.id||
   typeof k.person!=='string'||!k.person||!H64.test(k.spkiSha256||'')||
   typeof k.publicKeyPem!=='string'||k.publicKeyPem.length>4096)
    return denied('blocked-trust-root','Invalid or unreviewed pinned public-key metadata.');
  const pub=crypto.createPublicKey(k.publicKeyPem);
  if(pub.asymmetricKeyType!=='ed25519')return denied('blocked-trust-root','Only pinned Ed25519 public keys allowed.');
  const actual=crypto.createHash('sha256').update(pub.export({format:'der',type:'spki'})).digest('hex');
  if(actual!==k.spkiSha256)return denied('blocked-trust-root','Pinned public-key fingerprint mismatch.');
  keys.set(k.id,{...k,key:pub});
 }
 if(packet?.format!=='GomokuA14CustodyPacket'||packet.version!==14||
  packet.repository!=='thiepn/gomoku'||packet.sourceSha!==LOCK.sourceSha||
  packet.a12HeadSha!==A12||packet.a13HeadSha!==A13||
  !H40.test(packet.productionCommitSha||'')||
  typeof packet.deploymentId!=='string'||!packet.deploymentId.trim()||
  !allowedPublicOrigin(packet.productionOrigin)||
  !H32.test(packet.challenge||'')||
  !packet.evidence||typeof packet.evidence!=='object'||Array.isArray(packet.evidence)||
  Object.keys(packet.evidence).sort().join(',')!==[...stages].sort().join(',')||
  !Array.isArray(packet.records)||packet.records.length!==3)
  return denied('blocked-scope','Wrong source, pinned phase heads, deployment scope, challenge, evidence set or record count.');
 if(!Array.isArray(usedChallenges)||usedChallenges.some(x=>!H32.test(x))||
    new Set(usedChallenges).size!==usedChallenges.length)
  return denied('blocked-replay','Invalid operator-managed previously-used challenge list.');
 if(usedChallenges.includes(packet.challenge))return denied('blocked-replay','Custody challenge already recorded in the supplied replay ledger.');
 const verifyNow=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(verifyNow))return denied('blocked-time','Invalid verification clock.');
 const participantKeys=new Set(),participants=new Set(),nonces=new Set();
 let prevDigest=null,prevIssued=0,firstIssued=0;
 for(let i=0;i<3;i++){
  const r=packet.records[i],stage=stages[i],role=roles[i];
  if(!r||r.format!=='GomokuA14SignedRecord'||r.kind!==stage||
   r.sequence!==i+1||r.role!==role||r.challenge!==packet.challenge||
   r.previousDigest!==prevDigest||!H32.test(r.nonce||'')||
   nonces.has(r.nonce)||typeof r.keyId!=='string'||!keys.has(r.keyId)||
   typeof r.signer!=='string'||!r.signer)
   return denied('blocked-chain','Evidence chain order, witness identities, challenge, nonce or previous digest invalid at '+stage);
  nonces.add(r.nonce);
  const k=keys.get(r.keyId);
  if(k.role!==role||k.person!==r.signer||participantKeys.has(k.id)||participants.has(k.person)||
   policy.revokedKeyIds.includes(k.id)||k.revoked===true)
   return denied('blocked-revocation','Signer is revoked, re-used, self-approving or not authorized for '+stage);
  participantKeys.add(k.id);participants.add(k.person);
  if(!iso(r.issuedAt)||!iso(r.expiresAt))return denied('blocked-time','Missing canonical UTC timestamps.');
  const issued=Date.parse(r.issuedAt),expires=Date.parse(r.expiresAt);
  if(issued>verifyNow+300000||issued<=prevIssued||expires<=issued||
   expires-issued>14*86400000||expires<verifyNow)
   return denied('blocked-time','Future, expired, out-of-order or overlong attestation '+stage);
  if(i===0)firstIssued=issued;
  if(i===1&&issued-firstIssued<24*3600000)return denied('blocked-time','Stability witness issued before a 24-hour observation horizon.');
  prevIssued=issued;
  if(r.repository!=='thiepn/gomoku'||r.sourceSha!==LOCK.sourceSha||
   r.a12HeadSha!==A12||r.a13HeadSha!==A13||
   r.productionCommitSha!==packet.productionCommitSha||
   r.deploymentId!==packet.deploymentId||r.productionOrigin!==packet.productionOrigin||
   r.evidenceSha256!==sha(packet.evidence[stage]))
   return denied('blocked-evidence','Signed evidence hash/source/deployment mismatch at '+stage);
  if(typeof r.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(r.signature))
   return denied('blocked-signature','Invalid Ed25519 detached signature encoding at '+stage);
  const signature=Buffer.from(r.signature,'base64');
  if(signature.length!==64||signature.toString('base64')!==r.signature)
   return denied('blocked-signature','Noncanonical signature encoding.');
  const {signature:excluded,...unsigned}=r;
  if(!crypto.verify(null,Buffer.from(canonical(unsigned)),k.key,signature))
   return denied('blocked-signature','Ed25519 signature verification failed at '+stage);
  prevDigest=sha(r);
 }
 const ev=packet.evidence;
 if(ev.cutover?.format!=='GomokuAnalysis3A13ExecutedCutover'||
  ev.cutover.status!=='completed-production-cutover'||
  ev.cutover.sourceSha!==LOCK.sourceSha||
  ev.cutover.productionCommitSha!==packet.productionCommitSha||
  ev.cutover.deploymentId!==packet.deploymentId||
  ev.cutover.productionOrigin!==packet.productionOrigin||
  ev.stability?.format!=='GomokuAnalysis3A13StabilityReview'||
  ev.stability.status!=='ready-for-manual-stability-review'||
  ev.stability.sourceSha!==LOCK.sourceSha||
  !Number.isSafeInteger(ev.stability.hoursObserved)||
  ev.stability.hoursObserved<24||ev.stability.hoursObserved>72||
  ev.stability.canCertifyStable!==false||ev.stability.canDeployProduction!==false||
  ev.handoff?.format!=='GomokuAnalysis3A13OperationalHandoff'||
  ev.handoff.status!=='accepted-by-owner-for-independent-review'||
  ev.handoff.deploymentId!==packet.deploymentId)
  return denied('blocked-evidence','A13 cutover, stability and handoff supporting records absent or inconsistent.');
 return denied('ready-for-independent-ledger-and-originals-review',
  'Three detached signatures, source/deployment hashes and in-packet anti-replay checks verified. External challenge ledger, original hosted bytes, physical devices and separate human decision remain OPEN.',
  {verifiedSigners:[...participants],chainDigest:prevDigest,replayLedgerNotIndependentlyAuthenticated:true});
}
function read(path){return path?JSON.parse(fs.readFileSync(path,'utf8')):null;}
if(require.main===module){
 // Only repository-pinned public trust anchors are accepted. NO trust-policy path/override in CLI.
 const [packetPath,ledgerPath]=process.argv.slice(2);
 const result=verify({packet:read(packetPath),usedChallenges:read(ledgerPath)||[]});
 console.log(JSON.stringify(result,null,2));
 // Even a fully signed documentary packet does NOT grant closure or release.
 if(result.status!=='ready-for-independent-ledger-and-originals-review')process.exitCode=2;
}
module.exports={verify,canonical,sha,stages,roles};
