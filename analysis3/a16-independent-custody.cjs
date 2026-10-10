/* A16: verify independently pinned signatures over original custody/physical evidence. NO authority. */
'use strict';
const crypto=require('node:crypto');
const A14=require('./a14-custody.cjs');
const Ledger=require('./a15-local-ledger.cjs');
const LOCK=require('./a10-source-lock.json');
const ROOTS=require('./a16-witness-roots.json');
const PINS=require('./a15-evidence-pins.json');
const SHA=/^[a-f0-9]{64}$/,HEX40=/^[a-f0-9]{40}$/;
const roles=['external-ledger-custodian','independent-evidence-reviewer','release-owner'];
const kinds=['replay-ledger','physical-acceptance','key-rotation','release-decision'];
const digest=x=>A14.sha(x);
function output(status,reason,extra={}){
 return {format:'GomokuA16IndependentEvidence',version:16,status,reason,...extra,
  canMerge:false,canTag:false,canDeploy:false,canModifyProductionData:false,
  canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
  note:'Signatures only bind documents to previously reviewed public keys. Global custody, physical devices, source of originals and human approval must still be independently witnessed.'};
}
function trust(roots=ROOTS){
 if(roots?.format!=='GomokuA16ExternalWitnessTrustRoots'||roots.version!==16||
  roots.repository!=='thiepn/gomoku'||roots.a15HeadSha!==
    'df2b958494460d650574351472770458e5ab5f62'||
  !Array.isArray(roots.keys)||roots.keys.length<3||roots.keys.length>12||
  !Array.isArray(roots.revokedKeyIds)||new Set(roots.revokedKeyIds).size!==roots.revokedKeyIds.length)
  return null;
 const people=new Set(),keyIds=new Set(),byRole=new Map();
 for(const k of roots.keys){
  if(!k||!roles.includes(k.role)||typeof k.id!=='string'||!k.id||
   typeof k.person!=='string'||!k.person.trim()||people.has(k.person)||
   keyIds.has(k.id)||roots.revokedKeyIds.includes(k.id)||
   k.revoked===true||typeof k.publicKeyPem!=='string'||
   'privateKeyPem' in k||!SHA.test(k.spkiSha256||''))return null;
  let key;
  try{key=crypto.createPublicKey(k.publicKeyPem);}catch{return null}
  if(key.asymmetricKeyType!=='ed25519')return null;
  const hash=crypto.createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
  if(hash!==k.spkiSha256)return null;
  people.add(k.person);keyIds.add(k.id);
  if(byRole.has(k.role))return null;
  byRole.set(k.role,{...k,key});
 }
 return roles.every(x=>byRole.has(x))?byRole:null;
}
function verifySigned({envelope,kind,payload,rolesRequired=['independent-evidence-reviewer'],roots=ROOTS}={}){
 const policy=trust(roots);
 if(!policy)return output('blocked-trust','No independent, reviewed public witness roots available.');
 if(!kinds.includes(kind)||!envelope||envelope.format!=='GomokuA16SignedEvidenceEnvelope'||
  envelope.version!==16||envelope.kind!==kind||envelope.repository!=='thiepn/gomoku'||
  envelope.sourceSha!==LOCK.sourceSha||envelope.a15HeadSha!=='df2b958494460d650574351472770458e5ab5f62')
  return output('blocked-binding','Original source, release branch or envelope identity missing.');
 // Explicit A15 anchor supersedes the A14 GitHub metadata head: independent authority must bind the A15 qualification.
 if(envelope.a15HeadSha!=='df2b958494460d650574351472770458e5ab5f62')
  return output('blocked-binding','Wrong A15 exact-head source binding.');
 if(!HEX40.test(envelope.productionCommitSha||'')||typeof envelope.deploymentId!=='string'||
  !envelope.deploymentId.trim()||!SHA.test(envelope.evidenceDigest||'')||
  envelope.evidenceDigest!==digest(payload)||!Array.isArray(envelope.signatures)||
  envelope.signatures.length!==rolesRequired.length||new Set(rolesRequired).size!==rolesRequired.length)
  return output('blocked-content','Signed payload hash, deployment scope or required witness roles invalid.');
 const seen=new Set();
 const {signatures:_,...message}=envelope;
 for(const role of rolesRequired){
  const row=envelope.signatures.find(s=>s?.role===role);
  const key=policy.get(role);
  if(!row||!key||seen.has(row.role)||row.keyId!==key.id||row.signer!==key.person||
    typeof row.signature!=='string'||!/^[-A-Za-z0-9+/=]{86,90}$/.test(row.signature))
   return output('blocked-signature','Required independent signer identity or signature encoding absent: '+role);
  const sig=Buffer.from(row.signature,'base64');
  if(sig.length!==64||sig.toString('base64')!==row.signature||
   !crypto.verify(null,Buffer.from(A14.canonical(message)),key.key,sig))
   return output('blocked-signature','Original Ed25519 evidence signature incorrect: '+role);
  seen.add(role);
 }
 if(envelope.signatures.some(s=>!seen.has(s.role)))
  return output('blocked-signature','Unreviewed or extra witness signature.');
 return output('signed-documents-only','Pinned-role Ed25519 signatures match scoped documentary bytes. Original evidence and human observations still need independent authentication.',
  {verifiedRoles:[...seen],evidenceDigest:envelope.evidenceDigest});
}
function replay({ledger,receipt,roots=ROOTS}={}){
 let state;
 try{state=Ledger.validate(ledger);}catch(e){return output('blocked-ledger',String(e.message));}
 if(state.count<2||state.consumed.size===0)
  return output('blocked-replay','No valid issued-and-once-consumed local challenge.');
 const last=ledger.entries.at(-1),issue=state.issued.get(last.challenge);
 if(last.action!=='consume'||!issue||last.deploymentId!==issue.deploymentId||
  last.scopeDigest!==issue.scopeDigest||!SHA.test(last.packetDigest||''))
  return output('blocked-replay','Local ledger latest challenge not completed with bound packet hash.');
 if(receipt?.kind!=='replay-ledger'||receipt.deploymentId!==last.deploymentId||
  receipt.productionCommitSha!==receipt.payload?.productionCommitSha||
  receipt.payload?.challenge!==last.challenge||receipt.payload?.packetDigest!==last.packetDigest||
  receipt.payload?.ledgerHead!==state.head||receipt.payload?.ledgerDigest!==digest(ledger)||
  receipt.payload?.scopeDigest!==issue.scopeDigest||
  receipt.payload?.issuedAtMs!==issue.atMs||receipt.payload?.consumedAtMs!==last.atMs||
  receipt.payload?.a15HeadSha!=='df2b958494460d650574351472770458e5ab5f62')
  return output('blocked-replay','Independently observed consumption is not linked to original source, challenge and local ledger state.');
 const verified=verifySigned({envelope:receipt,kind:'replay-ledger',payload:receipt.payload,
  rolesRequired:['external-ledger-custodian','independent-evidence-reviewer'],roots});
 return verified.status==='signed-documents-only'
  ?output('ready-for-external-ledger-review','Two independent role signatures attest the local ledger snapshot; durable external provider history and anti-replay authority are NOT established.',
    {ledgerHead:state.head,challenge:last.challenge,packetDigest:last.packetDigest})
  :verified;
}
module.exports={output,trust,verifySigned,replay,digest,roles,kinds};
