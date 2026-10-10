/* A21 genuine A9 CI file bytes only; all signer/device/external/provider/owner evidence SYNTHETIC. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const LOCK=require('./a10-source-lock.json'),P=require('./a21-qualified-parent.json'),A9=require('./rc9-core.cjs');
const W=require('./a18-signer-reconciliation.cjs'),A14=require('./a14-custody.cjs');
const E=require('./a21-escrow.cjs'),R=require('./a21-recovery.cjs'),D=require('./a21-hardware.cjs'),G=require('./a21-governance.cjs');
const {hash}=E,NOW=new Date('2026-10-10T16:25:00Z'),HEX='a'.repeat(64),HEX2='b'.repeat(64),HEX3='c'.repeat(64);
let n=0;function t(name,f){f();n++;console.log('PASS A21 '+name)}
const roles=[...W.ROLES],signer={};
const keys=roles.map((role,i)=>{
 const pair=crypto.generateKeyPairSync('ed25519');signer[role]=pair.privateKey;
 return {role,keyId:'SYNTHETIC-'+i,person:'TEST WITNESS NOT HUMAN '+i,
  publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
  spkiSha256:hash(pair.publicKey.export({format:'der',type:'spki'}))};
});
const roots={format:'GomokuA18IndependentOperatorRoots',version:18,repo:'thiepn/gomoku',
 a17Head:require('./a18-source-pins.json').upstreamA17,
 issuerKeys:keys,revokedKeys:[],rotationHistory:[]};
function envelope(kind,payload,change={}){
 const base={format:'GomokuA18SignedOriginals',version:18,kind,repository:'thiepn/gomoku',
  originalSourceSha:LOCK.sourceSha,a17Head:require('./a18-source-pins.json').upstreamA17,
  productionCommitSha:'f'.repeat(40),deploymentId:'SYNTHETIC NEVER RELEASED',
  challengeDigest:HEX,payloadDigest:W.hash(payload),
  issuedAt:'2026-10-10T15:30:00Z',expiresAt:'2026-10-10T17:30:00Z',...change};
 return {...base,signatures:W.KINDS[kind].map(role=>{
  const who=keys.find(x=>x.role===role);
  return{role,keyId:who.keyId,person:who.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(base)),signer[role]).toString('base64')};
 })};
}
function escrow(){
 const originals=[fs.readFileSync(path.join(__dirname,'..','analysis21-test-output','preview-static','index.html')),
  Buffer.from('SYNTHETIC external host body; not an actual hosted response')];
 const initial='e'.repeat(64);let previous=initial;
 const items=originals.map((b,i)=>{
  const o={sequence:i+1,objectId:'SYNTHETIC-OBJECT-'+i,
   kind:i?'preview-response-original':'a9-ci-original',
   sha256:hash(b),prevReceiptDigest:previous,observedAt:i?'2026-10-10T16:01:00Z':'2026-10-10T16:00:00Z',
   providerCustodianId:'SYNTHETIC PROVIDER',operatorId:'SYNTHETIC SEPARATE OPERATOR',
   originalCopyImmutableClaimed:true};
  o.receiptDigest=W.hash(o);previous=o.receiptDigest;return o;
 });
 const archive={format:'GomokuA21EscrowOriginals',version:21,repository:'thiepn/gomoku',
  sourceSha:LOCK.sourceSha,a20Head:P.head,ownerRightsDecision:'UNAPPROVED',
  actualHostAccessed:false,productionPlayerDataIncluded:false,approvedByRealHuman:false,
  providerExternalIndependenceVerified:false,items,parentManifestDigest:initial,
  sourceEvidenceDigest:'f'.repeat(64),finalReceiptDigest:previous};
 const payload={sourceSha:LOCK.sourceSha,a20Head:P.head,parentManifestDigest:initial,
  sourceEvidenceDigest:archive.sourceEvidenceDigest,escrowFinalDigest:previous,originalObjects:2};
 return{archive,originals,prior:{status:'external-originals-documentary-ready',
  receiptDigest:archive.sourceEvidenceDigest},signatures:envelope('host-byte-intake',payload),roots,now:NOW};
}
function hardware(){
 const cases=[],caseOriginals={};
 for(const [platform,ids] of Object.entries(A9.DEVICE_CHECKS)){
  for(const caseId of ids){
   const id=platform+':'+caseId,b=Buffer.from('SYNTHETIC NOT REAL DEVICE MEDIA '+id);
   caseOriginals[id]=b;
   cases.push({platform,caseId,status:'pending-independent-original-review',
    mediaSha256:hash(b),hardwareId:'FAKE '+platform,
    browserVersion:'synthetic 130',osVersion:'synthetic 15',operatorId:'FAKE OPERATOR '+platform,
    observedAt:'2026-10-10T16:00:00Z',sourceRightsDigest:HEX});
  }
 }
 const assistiveOriginals={},accessibility=D.ACCESS.map((id,i)=>{
  const b=Buffer.from('SYNTHETIC assistive byte '+i);assistiveOriginals[id]=b;
  return{id,sha256:hash(b),status:'pending-independent-accessibility-review',
   originalObservation:'TEST ONLY: no genuine screen reader or physical hardware observation.',
   observedAt:'2026-10-10T16:01:00Z'};
 });
 const swOriginals={before:Buffer.from('fake previous SW'),updated:Buffer.from('fake updated SW'),
   reverted:Buffer.from('fake previous SW')};
 const priorBytes=Buffer.from('SYNTHETIC distinct previous stable archive; not real data');
 const packet={format:'GomokuA21PhysicalEscrow',version:21,sourceSha:LOCK.sourceSha,
  a20Head:P.head,ownerHumanAuthorization:'OPEN',reviewerHumanAuthorization:'OPEN',
  realPhysicalAccepted:0,deploymentExecuted:false,productionOriginTouched:false,
  originalPreviewOrigin:'https://synthetic-a21.vercel.app/',
  cases,accessibility,serviceWorker:{format:'GomokuA21ServiceWorkerOriginals',
   origin:'https://synthetic-a21.vercel.app/',beforeSha256:hash(swOriginals.before),
   updatedSha256:hash(swOriginals.updated),revertedSha256:hash(swOriginals.reverted),
   updateActuallyWitnessedAndApproved:false},
  priorStable:{format:'GomokuA21PreviousStableOriginal',status:'ORIGINAL_RESTORE_NOT_EXECUTED',
   archiveSha256:hash(priorBytes),playerRecordsTouched:false,realPwaRollbackAccepted:false,
   independentArchiveReceiptSha256:HEX2}};
 return {packet,caseOriginals,assistiveOriginals,swOriginals,priorBytes,
  priorA20:{status:'device-originals-documentary-only',physicalAccepted:0},now:NOW};
}
function recovery(){
 const challenge='f'.repeat(32),originalProofBytes=Buffer.from('SYNTHETIC private provider original proof');
 let previous='1'.repeat(64);const steps=[
  {action:'issue',operator:'ISSUER',scopeDigest:HEX},
  {action:'consume',operator:'DIFFERENT CONSUMER',scopeDigest:HEX},
  {action:'recover',operator:'THIRD RECOVERY REVIEWER',priorStableArchiveSha256:HEX2,
   actualRestorePerformed:false,isolatedRehearsalSha256:HEX3}
 ];
 const operations=steps.map((e,i)=>{
  const n={...e,index:i+1,challenge,
   previousRoot:previous,nextRoot:hash(Buffer.from('provider-next-root-'+i)),
   eventDigest:hash(Buffer.from('event-'+i)),
   observedAt:'2026-10-10T16:0'+i+':00Z'};
  previous=n.nextRoot;return n;
 });
 const journal={format:'GomokuA21IndependentRecoveryProof',version:21,sourceSha:LOCK.sourceSha,
  a20Head:P.head,ownerDecision:'NOT_APPROVED',productionRestored:false,
  productionPlayerDataAccessed:false,originalProviderRoot:'1'.repeat(64),
  externalAuditDigest:HEX3,priorStableArchiveSha256:HEX2,
  operations,finalProviderRoot:previous,revokedKeys:[],
  originalProofSha256:hash(originalProofBytes)};
 const sourceLocal={entries:[{action:'issue',challenge},{action:'consume',challenge}]};
 return{journal,prior:{status:'multioperator-documentary-consistent'},
  originalProofBytes,sourceLocal,roots:{keys:[]},now:NOW};
}
t('original A9 and A20 parent source fully pinned, real roots empty',()=>{
 assert.equal(P.head,'7b07f8497d60d6b7c3a97bef09c06e481d2db067');
 assert.equal(P.ci.length,6);assert.equal(P.realTrustRoots.length,0);
 assert.equal(P.realPhysicalAccepted,0);
});
t('real original A9 CI file used in byte-backed synthetic escrow',()=>{
 assert.equal(E.validate(escrow()).status,'escrow-originals-documentary-only');
});
t('default empty real public keys always block signed escrow',()=>{
 const x=escrow();x.roots=require('./a18-review-roots.json');
 assert.equal(E.validate(x).status,'blocked-roots');
});
t('missing actual original bytes fails',()=>{
 const x=escrow();x.originals[0]=null;assert.equal(E.validate(x).status,'blocked-escrow-original');
});
t('one tampered object byte fails',()=>{
 const x=escrow();x.originals[1]=Buffer.from('altered');assert.equal(E.validate(x).status,'blocked-escrow-original');
});
t('wrong previous receipt hash breaks external chain',()=>{
 const x=escrow();x.archive.items[1].prevReceiptDigest='9'.repeat(64);
 assert.equal(E.validate(x).status,'blocked-escrow-original');
});
t('duplicated object ID or reinserted hash fails',()=>{
 const x=escrow();x.archive.items[1].objectId=x.archive.items[0].objectId;
 assert.equal(E.validate(x).status,'blocked-escrow-original');
});
t('human approval never accepted from editable JSON',()=>{
 const x=escrow();x.archive.approvedByRealHuman=true;
 assert.equal(E.validate(x).status,'blocked-escrow-context');
});
t('forks with disagreeing append-only receipts require arbitration',()=>{
 const x=escrow(),left=x.archive.items,right=structuredClone(left);
 right[1].receiptDigest='7'.repeat(64);
 const r=E.reconcileForks({left,right,baseRoot:x.archive.parentManifestDigest});
 assert.equal(r.status,'custody-fork-conflict');assert.equal(r.automaticallyResolve,false);
});
t('same escrow history remains nonauthorizing',()=>{
 const x=escrow();assert.equal(E.reconcileForks({left:x.archive.items,right:x.archive.items,baseRoot:x.archive.parentManifestDigest}).status,'escrow-branches-documentary-consistent');
});
t('full 18+7 physical original bytes and SW/prior archive only documentary',()=>{
 const r=D.inspect(hardware());
 assert.equal(r.status,'physical-and-restore-originals-documentary-only',r.reason);
 assert.equal(r.physicalAccepted,0);assert.equal(r.assistiveOriginals,7);
});
t('missing installed PWA original never qualifies',()=>{
 const x=hardware();delete x.caseOriginals['installed-android-pwa:offline-launch'];
 assert.equal(D.inspect(x).status,'blocked-hardware-original');
});
t('cross-platform wrong hardware source rejected',()=>{
 const x=hardware();x.packet.cases[1].hardwareId='DIFFERENT HARDWARE';
 assert.equal(D.inspect(x).status,'blocked-device-series');
});
t('duplicate media SHA across cases rejected',()=>{
 const x=hardware();x.packet.cases[1].mediaSha256=x.packet.cases[0].mediaSha256;
 assert.equal(D.inspect(x).status,'blocked-hardware-original');
});
t('no TalkBack original byte or corrupted accessibility media allowed',()=>{
 const x=hardware();x.assistiveOriginals['screen-reader']=Buffer.from('tampered');
 assert.equal(D.inspect(x).status,'blocked-assistive-media');
});
t('service-worker nonversion-changing content rejected',()=>{
 const x=hardware();x.swOriginals.updated=x.swOriginals.before;x.packet.serviceWorker.updatedSha256=x.packet.serviceWorker.beforeSha256;
 assert.equal(D.inspect(x).status,'blocked-sw-originals');
});
t('A9 candidate ZIP cannot act as distinct prior stable source',()=>{
 const x=hardware();x.packet.priorStable.archiveSha256=P.originalNestedZipSha256;
 assert.equal(D.inspect(x).status,'blocked-prior-stable');
});
t('physical original evidence conflict creates independent manual dispute',()=>{
 const r=D.conflicts({observations:[
  {platform:'android-chrome',caseId:'fresh-launch',sha256:HEX,witnessId:'REVIEWER A',status:'pending-review'},
  {platform:'android-chrome',caseId:'fresh-launch',sha256:HEX2,witnessId:'REVIEWER B',status:'pending-review'}]});
 assert.equal(r.status,'device-originals-disputed');assert.equal(r.automatedArbitration,false);
});
t('original provider issue-consume-third-operator recovery remains review-only',()=>{
 const r=R.prove(recovery());assert.equal(r.status,'original-recovery-documentary-only',r.reason);
 assert.equal(r.canExecuteRecovery,false);
});
t('recovery reviewer cannot be original consumer',()=>{
 const x=recovery();x.journal.operations[2].operator='DIFFERENT CONSUMER';
 assert.equal(R.prove(x).status,'blocked-recovery-conflict');
});
t('issuer cannot self-consume a challenge',()=>{
 const x=recovery();x.journal.operations[1].operator='ISSUER';
 assert.equal(R.prove(x).status,'blocked-replay-consume');
});
t('provider CAS root conflict detected',()=>{
 const x=recovery();x.journal.operations[1].previousRoot='9'.repeat(64);
 assert.equal(R.prove(x).status,'blocked-recovery-order');
});
t('tampered provider original external byte proof denied',()=>{
 const x=recovery();x.originalProofBytes=Buffer.from('tampered provider archive');
 assert.equal(R.prove(x).status,'blocked-recovery-proof');
});
t('recovery cannot execute a real restore through source review',()=>{
 const x=recovery();x.journal.operations[2].actualRestorePerformed=true;
 assert.equal(R.prove(x).status,'blocked-recovery-conflict');
});
t('conflicting operator CAS consumption is never auto-won',()=>{
 const packets=[{format:'GomokuA21OperatorProposal',sourceSha:LOCK.sourceSha,a20Head:P.head,
  previousRoot:HEX,challenge:'c'.repeat(32),operation:'consume',
  packetSha256:HEX,operator:'ONE',authorityGranted:false},
  {format:'GomokuA21OperatorProposal',sourceSha:LOCK.sourceSha,a20Head:P.head,
  previousRoot:HEX,challenge:'c'.repeat(32),operation:'consume',
  packetSha256:HEX2,operator:'TWO',authorityGranted:false}];
 const r=R.reconcileOperators({packets,externalRoot:HEX});
 assert.equal(r.status,'operator-cas-conflict');assert.equal(r.automaticWinner,null);
});
t('one operator cannot duplicate identical proposal',()=>{
 const p={format:'GomokuA21OperatorProposal',sourceSha:LOCK.sourceSha,a20Head:P.head,
  previousRoot:HEX,challenge:'c'.repeat(32),operation:'consume',
  packetSha256:HEX,operator:'ONE',authorityGranted:false};
 assert.equal(R.reconcileOperators({packets:[p,p],externalRoot:HEX}).status,'blocked-duplicate-operator');
});
t('pre-release signed document cannot be evaluated without external originals',()=>{
 const r=G.preflight();assert.equal(r.status,'blocked-prerequisite');assert.equal(r.canDeploy,false);
});
t('synthetic signed pre-release assembly stays staging proposal only',()=>{
 const er=E.validate(escrow()),hr=D.inspect(hardware()),rr=R.prove(recovery());
 const packet={format:'GomokuA21PrecutoverReview',version:21,sourceSha:LOCK.sourceSha,
  a20Head:P.head,phase:'staging-review-only',actualHumanApproval:'OPEN',
  actualA12CutoverExecuted:false,hostedPreviewApproved:false,physicalAccepted:0,
  escrowDigest:er.finalReceiptDigest,hardwareDigest:hr.sourceDigest,
  recoveryOriginalDigest:HEX,independentOwnerIntakeDigest:HEX2,
  independentReviewerIntakeDigest:HEX3,deploymentId:'SYNTHETIC NEVER RELEASED'};
 const payload={sourceSha:LOCK.sourceSha,a20Head:P.head,escrowDigest:packet.escrowDigest,
  hardwareDigest:packet.hardwareDigest,recoveryOriginalDigest:packet.recoveryOriginalDigest,
  ownerDigest:packet.independentOwnerIntakeDigest,reviewerDigest:packet.independentReviewerIntakeDigest,
  stage:'staging-review-only'};
 const r=G.preflight({escrow:er,hardware:hr,recovery:rr,
  prior:{status:'previous-stable-custody-documentary'},packet,
  signatures:envelope('precutover-owner-review',payload),roots,now:NOW});
 assert.equal(r.status,'precutover-signed-documents-only',r.reason);assert.equal(r.ownerApproved,false);
});
t('pre-release proposal and post-release closure remain distinct with no genuine A12',()=>{
 assert.equal(G.closure().status,'blocked-genuine-postrelease');assert.equal(G.status().status,'NO_GO');
});
t('real physical/device/human approval unchanged after ALL synthetic tests',()=>{
 const r=G.status();assert.equal(r.physicalAccepted,0);assert.equal(r.realHumanKeys,0);
 for(const key of ['canMerge','canDeploy','canTag','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])
  assert.equal(r[key],false);
});
console.log(n+' A21 adversarial original-source escrow/device/CAS/compromise/staging tests passed. ALL device, host, human and provider identities SYNTHETIC.');
