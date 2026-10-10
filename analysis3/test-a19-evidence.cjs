/* SYNTHETIC fixture ONLY — no actual hosted server, physical device, human or release. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const W=require('./a18-signer-reconciliation.cjs'),A14=require('./a14-custody.cjs');
const ORIGIN=require('./a19-origin-custody.cjs'),DEVICE=require('./a19-device-and-restore.cjs');
const OPS=require('./a19-release-custody.cjs'),A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const P=require('./a19-parent-evidence.json'),Ledger=require('./a15-local-ledger.cjs');
const DIR=path.resolve(__dirname,'../analysis19-test-output/preview-static');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const ROOTS={},SIGNERS={},roles=[...W.ROLES],NOW=new Date('2026-10-10T17:00:00Z');
const url='https://synthetic-a19-only.vercel.app/', deploymentId='SYNTHETIC-NOT-DEPLOYED';
let passed=0;function t(name,fn){fn();passed++;console.log('PASS A19 '+name);}
for(let i=0;i<roles.length;i++){
 const role=roles[i],pair=crypto.generateKeyPairSync('ed25519');
 SIGNERS[role]=pair.privateKey;
 ROOTS[role]={role,publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
  spkiSha256:SHA(pair.publicKey.export({format:'der',type:'spki'})),person:'TEST PERSON '+i,keyId:'TEST-'+i};
}
const roots={format:'GomokuA18IndependentOperatorRoots',version:18,repo:'thiepn/gomoku',
 a17Head:require('./a18-source-pins.json').upstreamA17,issuerKeys:roles.map(k=>ROOTS[k]),
 revokedKeys:[],rotationHistory:[]};
function sign(kind,payload,opts={}){
 const plain={format:'GomokuA18SignedOriginals',version:18,kind,repository:'thiepn/gomoku',
  originalSourceSha:LOCK.sourceSha,a17Head:require('./a18-source-pins.json').upstreamA17,
  productionCommitSha:'f'.repeat(40),deploymentId,
  payloadDigest:W.hash(payload),challengeDigest:'a'.repeat(64),
  issuedAt:'2026-10-10T16:00:00Z',expiresAt:'2026-10-10T18:00:00Z',...opts};
 return {...plain,signatures:W.KINDS[kind].map(role=>({
  role,keyId:ROOTS[role].keyId,person:ROOTS[role].person,
  signature:crypto.sign(null,Buffer.from(A14.canonical(plain)),SIGNERS[role]).toString('base64')
 }))};
}
function orig(){
 const files=A9.ASSETS.map(path=>{
  const b=fs.readFileSync(require('node:path').join(DIR,path));
  return {path,sha256:SHA(b),byteLength:b.length,httpStatus:200,
   responseUrl:new URL(path,url).toString(),requestMethod:'GET',redirected:false,credentialsSent:false};
 });
 const bytes=Object.fromEntries(A9.ASSETS.map(p=>[p,fs.readFileSync(path.join(DIR,p))]));
 const digs=files.map(x=>({path:x.path,hash:x.sha256})).sort((a,b)=>a.path.localeCompare(b.path));
 const m={format:'GomokuA19ExternalOriginals',version:19,kind:'host',
  repository:'thiepn/gomoku',sourceSha:LOCK.sourceSha,a18Head:P.a18Head,
  challengeDigest:'a'.repeat(64),deploymentId,ownerApprovalStatus:'OPEN',
  productionDataIncluded:false,origin:url,originalA9ZipSha256:LOCK.offlineZipSha256,
  preservedBytesIndependentOfHost:true,networkPermissionIndependentlyAuthenticatedClaimed:true,
  networkTrafficProductionOriginTouched:false,files,responseSetDigest:W.hash(digs)};
 const payload={kind:'host-byte-intake',sourceSha:LOCK.sourceSha,a18Head:P.a18Head,
  deploymentId,challengeDigest:m.challengeDigest,evidenceDigest:W.hash(m),
  responseSetDigest:m.responseSetDigest};
 return {manifest:m,bytes,priorA18:{status:'hosted-originals-ready-for-independent-human-review',
  hostedApproved:false,origin:url},signature:sign('host-byte-intake',payload),roots,now:NOW};
}
function physical(){
 const cases=[],caseBytes={};
 for(const [platform,checks] of Object.entries(A9.DEVICE_CHECKS))for(const caseId of checks){
  const id=platform+':'+caseId,b=Buffer.from('TEST ONLY synthetic physical case '+id);
  cases.push({platform,caseId,deviceId:'SYNTHETIC TEST DEVICE',osVersion:'fake Android 15',
   browserVersion:'fake version 130',operator:'synthetic fixture',status:'observed-pending-independent-review',
   origin:url,observedAt:'2026-10-10T16:30:00Z',originalMediaSha256:SHA(b)});
  caseBytes[id]=b;
 }
 const accessibility={format:'GomokuA19AccessibilityOriginals',sourceSha:LOCK.sourceSha,
  cases:require('./a18-physical-and-restore.cjs').ACCESSIBILITY.map((id,i)=>({
   id,reviewStatus:'pending-independent-hardware-review',
   originalMediaSha256:SHA(Buffer.from('synthetic accessibility '+i)),
   observation:'SYNTHETIC browser test only, not real screen reader or hardware'}))};
 const serviceWorker={format:'GomokuA19WitnessedSW',origin:url,
  beforeHash:'b'.repeat(64),updatedHash:'c'.repeat(64),revertedHash:'b'.repeat(64),
  originalPhysicalEvidenceStatus:'pending-independent-review'};
 const packet={format:'GomokuA19PhysicalOriginals',version:19,repository:'thiepn/gomoku',
  sourceSha:LOCK.sourceSha,a18Head:P.a18Head,origin:url,originalCaptureHost:url,
  realOwnerApprovalStatus:'OPEN',claimedOriginalHardwareWitnessed:true,
  cases,accessibility,serviceWorker};
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,
  originalCasesDigest:W.hash(packet.cases),accessibilityDigest:W.hash(accessibility),
  swDigest:W.hash(serviceWorker),origin:url,caseCount:18};
 return {packet,caseBytes,priorA18:{status:'physical-originals-ready-for-independent-review',
  physicalAccepted:0},signature:sign('physical-device-review',payload),roots,now:NOW};
}
function replay(){
 const doc=Ledger.genesis(),t=Date.parse('2026-10-10T16:00:00Z'),challenge='a'.repeat(32);
 const issue={seq:1,action:'issue',challenge,scopeDigest:'a'.repeat(64),deploymentId,
  actor:'SYNTHETIC',atMs:t,previous:doc.head,expiresAtMs:t+300000};issue.digest=A14.sha(issue);
 doc.entries.push(issue);doc.head=issue.digest;
 const consume={seq:2,action:'consume',challenge,scopeDigest:issue.scopeDigest,deploymentId,
  actor:'SYNTHETIC REVIEWER',atMs:t+120000,previous:doc.head,packetDigest:'b'.repeat(64)};
 consume.digest=A14.sha(consume);doc.entries.push(consume);doc.head=consume.digest;Ledger.validate(doc);
 const epochs={format:'GomokuA19IndependentReplayEpochs',version:19,
  sourceSha:LOCK.sourceSha,a18Head:P.a18Head,providerIndependentlyAdministeredClaimed:true,
  globalNonceReuseCheckedClaimed:true,originalExternalProofPreservedClaimed:true,
  revokedKeyIds:[],records:doc.entries.map((e,i)=>({
   epoch:i+1,providerRootSha256:SHA(Buffer.from('root '+i)),
   originalSourceRecordDigest:e.digest,receiptSha256:SHA(Buffer.from('receipt '+i)),
   eventId:SHA(Buffer.from('event '+i)),challenge:e.challenge,action:e.action,
   observedAt:i?'2026-10-10T16:02:00Z':'2026-10-10T16:01:00Z'
  }))};
 const payload={sourceSha:LOCK.sourceSha,a18Head:P.a18Head,epochDigest:W.hash(epochs),
  localJournalDigest:W.hash(doc),revokedKeyIds:[]};
 return {epochs,sourceLedger:doc,priorA18:{status:'ledger-documentary-only',
  independentReplayAuthority:false},signature:sign('external-replay-ledger',payload),roots,now:NOW};
}
t('A18 exact parent pin and A9 package are unchanged',()=>{
 assert.equal(P.a18Head,'d33b5671a4bd9cfe12bef4ce8eb68788db1b0aa9');
 assert.equal(P.a9OriginalSource,LOCK.sourceSha);
 assert.equal(P.runs.length,6);
});
t('real signer registry empty remains default deny',()=>assert.equal(W.verifiedRoots(),null));
t('eight original A9 static bytes reconcile in source fixture',()=>{
 const p=orig(),r=ORIGIN.originalHost(p);
 assert.equal(r.status,'host-original-bytes-reviewable',r.reason);assert.equal(r.canDeploy,false);
});
t('missing original byte object rejected',()=>{
 const p=orig();delete p.bytes['sw.js'];assert.equal(ORIGIN.originalHost(p).status,'blocked-host-file-integrity');
});
t('mutated HTTP redirect cannot substitute original artifact',()=>{
 const p=orig();p.manifest.files[0].redirected=true;
 assert.equal(ORIGIN.originalHost(p).status,'blocked-host-file-integrity');
});
t('host original content mismatch detected',()=>{
 const p=orig();p.bytes['sw.js']=Buffer.from('NOT THE ORIGINAL SOURCE');
 assert.equal(ORIGIN.originalHost(p).status,'blocked-host-file-integrity');
});
t('duplicate A9 file path denied',()=>{
 const p=orig();p.manifest.files[1].path=p.manifest.files[0].path;
 assert.equal(ORIGIN.originalHost(p).status,'blocked-host-file-integrity');
});
t('no original human roots => host signature cannot authenticate',()=>{
 const p=orig();p.roots=require('./a18-review-roots.json');
 assert.equal(ORIGIN.originalHost(p).status,'blocked-roots');
});
t('original source wrong head denied',()=>{
 const p=orig();p.manifest.a18Head='0'.repeat(40);
 assert.equal(ORIGIN.originalHost(p).status,'blocked-host-custody');
});
t('eighteen distinct synthetic physical media bytes reviewable but 0/18 accepted',()=>{
 const r=DEVICE.physical(physical());assert.equal(r.status,'physical-original-custody-reviewable',r.reason);
 assert.equal(r.physicalAccepted,0);assert.equal(r.acceptanceGranted,false);
});
t('missing Samsung Internet original case denied',()=>{
 const p=physical();p.packet.cases=p.packet.cases.slice(1);
 assert.equal(DEVICE.physical(p).status,'blocked-physical-provenance');
});
t('duplicated physical evidence bytes/hash refused',()=>{
 const p=physical();p.packet.cases[1].originalMediaSha256=p.packet.cases[0].originalMediaSha256;
 assert.equal(DEVICE.physical(p).status,'blocked-original-case');
});
t('device media bytes tampering refused',()=>{
 const p=physical();p.caseBytes['android-chrome:fresh-launch']=Buffer.from('different');
 assert.equal(DEVICE.physical(p).status,'blocked-original-case');
});
t('missing original TalkBack accessibility record denied',()=>{
 const p=physical();p.packet.accessibility.cases[0].id='invalid';
 assert.equal(DEVICE.physical(p).status,'blocked-accessibility');
});
t('same SW version before and updated invalid',()=>{
 const p=physical();p.packet.serviceWorker.updatedHash=p.packet.serviceWorker.beforeHash;
 assert.equal(DEVICE.physical(p).status,'blocked-sw');
});
t('unprovisioned reviewer keys never accept synthetic physical original',()=>{
 const p=physical();p.roots=require('./a18-review-roots.json');
 assert.equal(DEVICE.physical(p).status,'blocked-roots');
});
t('issue/consume original source chronology yields documentary-only ledger',()=>{
 const r=OPS.replay(replay());assert.equal(r.status,'external-replay-history-documentary-only',r.reason);
 assert.equal(r.certifiedGlobalAntiReplay,false);assert.equal(r.canDeploy,false);
});
t('replayed consume rejected',()=>{
 const p=replay();p.epochs.records.push({...p.epochs.records[1],epoch:3,eventId:'f'.repeat(64),
  providerRootSha256:'e'.repeat(64),receiptSha256:'d'.repeat(64),observedAt:'2026-10-10T16:03:00Z'});
 assert.equal(OPS.replay(p).status,'blocked-replay-history');
});
t('invalid epoch order rejected',()=>{
 const p=replay();p.epochs.records[1].epoch=1;
 assert.equal(OPS.replay(p).status,'blocked-replay-history');
});
t('external journal entry mismatch denied',()=>{
 const p=replay();p.epochs.records[0].originalSourceRecordDigest='f'.repeat(64);
 assert.equal(OPS.replay(p).status,'blocked-local-ledger-binding');
});
t('wrong ledger reviewer roots rejected',()=>{
 const p=replay();p.roots=require('./a18-review-roots.json');
 assert.equal(OPS.replay(p).status,'blocked-roots');
});
t('prior archive cannot be original A9 candidate',()=>{
 const p={rehearsal:{status:'prior-static-restore-documentary-review'},
 priorArchive:{format:'GomokuA19DistinctPriorArchive',version:19,a18Head:P.a18Head,
  sha256:P.a9NestedZipSha256},priorArchiveBytes:Buffer.from('fake')};
 assert.equal(DEVICE.restore(p).status,'blocked-prior-restore');
});
t('owner release decision still blocked without authentic sources and signoff',()=>{
 const r=OPS.beforeRelease();assert.equal(r.status,'blocked-precutover-gates');
 assert.equal(r.canMerge,false);
});
t('postrelease closure blocked absent real A12 24-72h monitoring',()=>{
 const r=OPS.afterRelease();assert.equal(r.status,'blocked-postrelease-originals');
 assert.equal(r.canCloseRelease,false);
});
t('trust rotation fails closed with no real prior keys',()=>{
 assert.equal(OPS.keyReview().status,'blocked-prior-roots');
});
t('default report keeps 0/18 acceptance with no production authority',()=>{
 const r=OPS.status();assert.equal(r.status,'NO_GO');assert.equal(r.realSigningKeys,0);
 for(const k of ['canMerge','canDeploy','canTag','canCloseRelease','canCertifyPhysical','canGrantOwnerAuthority'])
 assert.equal(r[k],false);
});
console.log(passed+' A19 adversarial original-host/device/accessibility/prior/replay/owner synthetic tests passed. NO REAL HARDWARE/HUMAN/RELEASE ACCEPTANCE.');
