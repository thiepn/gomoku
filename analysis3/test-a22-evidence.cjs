/* A22: real original A9 source bytes; all external providers, humans and devices SYNTHETIC. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const P=require('./a22-qualified-parent.json'),A9=require('./rc9-core.cjs');
const W=require('./a18-signer-reconciliation.cjs'),A14=require('./a14-custody.cjs');
const E=require('./a22-external-witness.cjs'),I=require('./a22-incidents.cjs'),A=require('./a22-acceptance.cjs');
const HEX='a'.repeat(64),HEX2='b'.repeat(64),HEX3='c'.repeat(64);
const NOW=new Date('2026-10-10T18:00:00Z');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let count=0;function test(label,run){run();count++;console.log('PASS A22 '+label)}
const roles=[...W.ROLES],key={};
const keys=roles.map((role,i)=>{const kp=crypto.generateKeyPairSync('ed25519');key[role]=kp.privateKey;return {
 role,keyId:'SYNTHETIC A22 '+i,person:'NONREAL WITNESS '+i,
 publicKeyPem:kp.publicKey.export({format:'pem',type:'spki'}),
 spkiSha256:sha(kp.publicKey.export({format:'der',type:'spki'}))
}});
const roots={format:'GomokuA18IndependentOperatorRoots',version:18,repo:'thiepn/gomoku',
 a17Head:require('./a18-source-pins.json').upstreamA17,issuerKeys:keys,revokedKeys:[],rotationHistory:[]};
function sign(kind,payload){
 const e={format:'GomokuA18SignedOriginals',version:18,kind,repository:'thiepn/gomoku',
 originalSourceSha:P.originalA9Source,a17Head:require('./a18-source-pins.json').upstreamA17,
 productionCommitSha:'f'.repeat(40),deploymentId:'SYNTHETIC NOT DEPLOYED',
 payloadDigest:W.hash(payload),challengeDigest:HEX,
 issuedAt:'2026-10-10T17:00:00Z',expiresAt:'2026-10-10T19:00:00Z'};
 return{...e,signatures:W.KINDS[kind].map(role=>{const k=keys.find(v=>v.role===role);
 return{role,keyId:k.keyId,person:k.person,signature:crypto.sign(null,Buffer.from(A14.canonical(e)),key[role]).toString('base64')};})};
}
function escrow(){
 const original=fs.readFileSync(path.resolve(__dirname,'..','analysis22-test-output/preview-static/index.html'));
 const body=Buffer.from('SYNTHETIC external byte document, NEVER an original hosted response');
 const items=[],bodies={};
 let prev='e'.repeat(64);
 for(const [i,b] of [original,body].entries()){
  const row={seq:i+1,objectId:'A22-TEST-ORIGINAL-'+i,
   kind:i===0?'original-a9-ci':'dedicated-preview-response',
   sha256:sha(b),bytes:b.length,previousRoot:prev,
   receivedAt:'2026-10-10T17:0'+i+':00Z',originalRightsStatus:'NOT_APPROVED',
   custodian:'SYNTHETIC CUSTODIAN',issuer:'SYNTHETIC DIFFERENT ISSUER'};
  row.receiptRoot=W.hash(row);prev=row.receiptRoot;items.push(row);bodies[row.objectId]=b;
 }
 const packet={format:'GomokuA22ExternallyWitnessedOriginals',version:22,
  repository:'thiepn/gomoku',sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  escrowPreviousRoot:'e'.repeat(64),ownerRightsDecision:'OPEN',
  humanHostPermissionGranted:false,actualProductionHostTouched:false,
  remoteProviderAuthenticated:false,separateProviderObjectDigest:HEX2,items,finalRoot:prev};
 const payload={sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  previousRoot:packet.escrowPreviousRoot,finalRoot:packet.finalRoot,
  packetDigest:W.hash(packet),providerObjectDigest:packet.separateProviderObjectDigest};
 return{packet,bodies,upstream:{status:'escrow-originals-documentary-only',
  realOwnerConsent:false,finalReceiptDigest:packet.escrowPreviousRoot},
  signatures:sign('host-byte-intake',payload),roots,now:NOW};
}
function incidents(){
 const challenge='9'.repeat(32);
 const sourceLocal={entries:[{action:'issue',challenge},{action:'consume',challenge}]};
 const s=[{action:'issue',actor:'SYNTHETIC A',scopeDigest:HEX,originalPacketDigest:HEX2},
  {action:'consume',actor:'SYNTHETIC B',scopeDigest:HEX,originalPacketDigest:HEX2},
  {action:'compromise',actor:'SYNTHETIC C',keyId:'OLD-SYNTHETIC-KEY',keyOwner:'SYNTHETIC D',
   keyFingerprint:HEX3,independentRightsDigest:HEX},
  {action:'rotate',actor:'SYNTHETIC E',previousKeyId:'OLD-SYNTHETIC-KEY',
   newKeyId:'NEW-SYNTHETIC-KEY',oldFingerprint:HEX3,newFingerprint:'d'.repeat(64),
   independentOwnerReceiptDigest:HEX2,keyOwner:'SYNTHETIC D'},
  {action:'recover-review',actor:'SYNTHETIC C',priorStableSha256:'f'.repeat(64),
   actualRestorePerformed:false,isolatedRecoveryDigest:HEX3}];
 let head='1'.repeat(64);
 const events=s.map((o,i)=>{const e={...o,index:i+1,challenge,
  previousRoot:head,nextRoot:sha(Buffer.from('next-root-'+i)),
  eventId:sha(Buffer.from('event-'+i)),originalPacketDigest:o.originalPacketDigest||HEX2,
  observedAt:'2026-10-10T17:0'+i+':00Z'};
  head=e.nextRoot;return e;
 });
 const audit=Buffer.from('SYNTHETIC original third-party audit bytes');
 return {incident:{format:'GomokuA22CrossOperatorIncident',version:22,
   sourceSha:P.originalA9Source,a21Head:P.sourceHead,realHumanDecision:'OPEN',
   productionTouched:false,providerIndependentlyAuthenticated:false,
   initialRoot:'1'.repeat(64),finalRoot:head,events,
   revokedKeyIds:['OLD-SYNTHETIC-KEY'],originalProofSha256:sha(audit)},
  localJournal:sourceLocal,originalProof:audit,provenance:E.original(escrow()),now:NOW};
}
function hardware(){
 const cases=[],physicalBytes={},assistive=[],accessibilityBytes={};
 for(const [platform,ids] of Object.entries(A9.DEVICE_CHECKS)){
  for(const caseId of ids){
   const name=platform+':'+caseId,bytes=Buffer.from('SYNTHETIC NOT A DEVICE A22 '+name);
   physicalBytes[name]=bytes;
   cases.push({platform,caseId,status:'pending-independent-source-witness',
    sha256:sha(bytes),rightsOriginalSha256:HEX,deviceId:'FAKE DEVICE '+platform,
    operatorId:'FAKE OPERATOR '+platform,browserVersion:'FAKE 130',osVersion:'FAKE 15',
    capturedAt:'2026-10-10T17:02:00Z'});
  }
 }
 for(const id of require('./a21-hardware.cjs').ACCESS){
  const bytes=Buffer.from('SYNTHETIC NO ACCESSIBILITY TEST '+id);
  accessibilityBytes[id]=bytes;assistive.push({
   id,status:'pending-independent-assistive-review',sha256:sha(bytes),
   capturedAt:'2026-10-10T17:03:00Z',witnessRightsDigest:HEX2});
 }
 const swBytes={before:Buffer.from('fake before SW'),update:Buffer.from('fake update SW'),
  revert:Buffer.from('fake before SW')};
 const priorStableBytes=Buffer.from('FAKE distinct previous stable archive, NOT original deployment');
 const packet={format:'GomokuA22OriginalPhysicalWitness',version:22,
  sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  ownerApprovalState:'OPEN',reviewerApprovalState:'OPEN',physicalCasesActuallyApproved:0,
  actualInstalledPwaRollbackPerformed:false,productionOriginTouched:false,
  cases,assistive,serviceWorker:{format:'GomokuA22ServiceWorkerOriginals',
   beforeSha256:sha(swBytes.before),updateSha256:sha(swBytes.update),
   revertSha256:sha(swBytes.revert),realServiceWorkerUpdateAuthorized:false},
  previousStable:{format:'GomokuA22DistinctPreviousStableOriginal',
   status:'REAL_ROLLBACK_NOT_PERFORMED',sha256:sha(priorStableBytes),
   playerStateRestored:false,originalCustodianDigest:HEX3}};
 return{packet,physicalBytes,accessibilityBytes,swBytes,priorStableBytes,prior:{
  status:'physical-and-restore-originals-documentary-only',physicalAccepted:0},now:NOW};
}
test('immutable A21 original head, A9 and actual 0/18 acceptance pinned',()=>{
 assert.equal(P.sourceHead,'283a6db789132cf8e4184cb088cd110671b6cde7');
 assert.equal(P.runs.length,6);assert.equal(P.realPhysicalAccepted,0);assert.equal(P.signerRoots.length,0);
});
test('original A9 CI byte escrow is only documentary and never host approved',()=>{
 const r=E.original(escrow());
 assert.equal(r.status,'external-original-receipts-documentary-only',r.reason);
 assert.equal(r.providerAuthenticated,false);assert.equal(r.canDeploy,false);
});
test('original byte mutation denied',()=>{
 const a=escrow();a.bodies['A22-TEST-ORIGINAL-1']=Buffer.from('tampered');
 assert.equal(E.original(a).status,'blocked-original-byte');
});
test('extra unknown original denied',()=>{
 const a=escrow();a.bodies['EXTRA']=Buffer.from('extra');
 assert.equal(E.original(a).status,'blocked-original-final');
});
test('signer trust roots remain EMPTY in real source and fail closed',()=>{
 const a=escrow();a.roots=require('./a18-review-roots.json');
 assert.equal(E.original(a).status,'blocked-roots');
});
test('invalid detached signer signature denied',()=>{
 const a=escrow();a.signatures.signatures[0].signature='A'.repeat(88);
 assert.equal(E.original(a).status,'blocked-signature');
});
test('missing external provider custodial separation denied',()=>{
 const a=escrow();a.packet.items[0].issuer=a.packet.items[0].custodian;
 assert.equal(E.original(a).status,'blocked-original-byte');
});
test('fork mismatch requires manual original provider arbitration',()=>{
 const a=escrow(),r=structuredClone(a.packet.items);
 r[1].receiptRoot='f'.repeat(64);
 const v=E.resolveFork({base:a.packet.escrowPreviousRoot,left:a.packet.items,right:r});
 assert.equal(v.status,'independent-provider-fork-conflict');assert.equal(v.automaticMerge,false);
});
test('shared immutable escrow chain remains only documentary',()=>{
 const a=escrow(),r=E.resolveFork({base:a.packet.escrowPreviousRoot,left:a.packet.items,right:a.packet.items});
 assert.equal(r.status,'provider-branches-documents-consistent');
});
test('cross-operator original issue consume compromised signer rotation recovery is document-only',()=>{
 const a=incidents(),r=I.reconcile(a);
 assert.equal(r.status,'incident-originals-documentary-only',r.reason);
 assert.deepEqual(r.revokedKeyIds,['OLD-SYNTHETIC-KEY']);
 assert.deepEqual(r.rotations,['NEW-SYNTHETIC-KEY']);assert.equal(r.globalCASAuthenticated,false);
});
test('tampered independent provider original bytes rejected',()=>{
 const a=incidents();a.originalProof=Buffer.from('bad');
 assert.equal(I.reconcile(a).status,'blocked-incident-origin');
});
test('two consumers racing for one challenge rejected',()=>{
 const a=incidents();a.incident.events[1].actor='SYNTHETIC A';
 assert.equal(I.reconcile(a).status,'blocked-consume-race');
});
test('provider head CAS drift detected',()=>{
 const a=incidents();a.incident.events[1].previousRoot=HEX;
 assert.equal(I.reconcile(a).status,'blocked-incident-sequence');
});
test('original signer cannot self-approve compromise',()=>{
 const a=incidents();a.incident.events[2].actor='SYNTHETIC D';
 assert.equal(I.reconcile(a).status,'blocked-key-compromise');
});
test('rotation missing verified old fingerprint denied',()=>{
 const a=incidents();a.incident.events[3].oldFingerprint=HEX;
 assert.equal(I.reconcile(a).status,'blocked-key-rotation');
});
test('duplicated compromised key revocation denied',()=>{
 const a=incidents();a.incident.events[2].keyId='OLD-SYNTHETIC-KEY';
 a.incident.events[3].previousKeyId='DIFFERENT KEY';
 assert.equal(I.reconcile(a).status,'blocked-key-rotation');
});
test('actual recovery operation cannot be sneaked into documentary review',()=>{
 const a=incidents();a.incident.events[4].actualRestorePerformed=true;
 assert.equal(I.reconcile(a).status,'blocked-recovery-custody');
});
test('unauthorized second consumer operator proposal collision is unresolved',()=>{
 const s=[{format:'GomokuA22OperatorRace',sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  baseRoot:HEX,challenge:'9'.repeat(32),proposedDigest:HEX,operation:'consume',
  operator:'A',actualTransactionExecuted:false},
  {format:'GomokuA22OperatorRace',sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  baseRoot:HEX,challenge:'9'.repeat(32),proposedDigest:HEX2,operation:'consume',
  operator:'B',actualTransactionExecuted:false}];
 const r=I.collide({proposals:s,expectedRoot:HEX});
 assert.equal(r.status,'independent-incident-conflict');assert.equal(r.automaticResolution,false);
});
test('18 Chrome/Samsung/installed PWA and seven accessibility original byte buffers remain unaccepted',()=>{
 const r=A.intake(hardware());
 assert.equal(r.status,'physical-witness-originals-documentary-only',r.reason);
 assert.equal(r.cases,18);assert.equal(r.accessibility,7);assert.equal(r.realPhysicalAccepted,0);
});
test('wrong physical original asset bytes denied',()=>{
 const a=hardware();a.physicalBytes['android-chrome:fresh-launch']=Buffer.from('bad');
 assert.equal(A.intake(a).status,'blocked-case-originals');
});
test('missing real installed PWA case denied',()=>{
 const a=hardware();delete a.physicalBytes['installed-android-pwa:offline-launch'];
 assert.equal(A.intake(a).status,'blocked-case-originals');
});
test('seven real accessibility byte SHA originals required',()=>{
 const a=hardware();a.accessibilityBytes['screen-reader']=Buffer.from('wrong');
 assert.equal(A.intake(a).status,'blocked-accessibility-originals');
});
test('same service worker binary upgrade denied',()=>{
 const a=hardware();a.swBytes.update=a.swBytes.before;a.packet.serviceWorker.updateSha256=a.packet.serviceWorker.beforeSha256;
 assert.equal(A.intake(a).status,'blocked-recovery-originals');
});
test('real A9 ZIP cannot be previous stable image',()=>{
 const a=hardware();a.packet.previousStable.sha256=P.originalOfflineZipSha256;
 assert.equal(A.intake(a).status,'blocked-recovery-originals');
});
test('owner review cannot proceed absent three documentary evidence streams',()=>{
 assert.equal(A.decide().status,'blocked-owner-evidence');
});
test('two separate owner receipt digests and unchanged A12 are required',()=>{
 const er=E.original(escrow()),ir=I.reconcile(incidents()),hr=A.intake(hardware());
 const packet={format:'GomokuA22OwnerReleaseDecision',version:22,
  sourceSha:P.originalA9Source,a21Head:P.sourceHead,phase:'precutover-review-only',
  humanOwnerSignoff:'OPEN',independentReviewerSignoff:'OPEN',actualA12Cutover:false,
  previewHostIndependentlyAuthorized:false,physicalCasesApproved:0,
  ownerOriginalDigest:HEX,reviewerOriginalDigest:HEX2,
  escrowRoot:er.finalRoot,hardwareOriginalDigest:hr.originalsDigest,
  reviewedAt:'2026-10-10T17:30:00Z'};
 const r=A.decide({escrow:er,incident:ir,physical:hr,packet,now:NOW});
 assert.equal(r.status,'owner-precutover-review-only',r.reason);
 assert.equal(r.canDeploy,false);
});
test('genuine A12 and A13 missing means later closure blocked',()=>{
 const r=A.after();assert.equal(r.status,'blocked-postrelease-real-world');assert.equal(r.canCloseRelease,false);
});
test('exact empty release trust and external provider NO_GO',()=>{
 const r=A.status();assert.equal(r.status,'NO_GO');assert.equal(r.humanKeys,0);
 for(const k of ['canMerge','canDeploy','canTag','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])
  assert.equal(r[k],false);
});
console.log(count+' A22 adversarial Node source/escrow/incident/physical/owner tests passed. ZERO real people, hosts, devices, or releases.');
