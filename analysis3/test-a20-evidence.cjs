/* A20 synthetic-only adversarial regression: real original A9 archive used only for independent source hashes. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const A14=require('./a14-custody.cjs'),A18=require('./a18-signer-reconciliation.cjs');
const LOCK=require('./a10-source-lock.json'),ROOT=require('./a20-external-roots.json');
const Intake=require('./a20-original-intake.cjs'),M=require('./a20-multioperator-recovery.cjs');
const Review=require('./a20-release-review.cjs'),A9=require('./rc9-core.cjs');
const NOW=new Date('2026-10-10T17:30:00Z'),origin='https://synthetic-a20-only.vercel.app/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const challenge='a'.repeat(32),scope='b'.repeat(64),prior='c'.repeat(64),roles=[...A18.ROLES];
let count=0;
function test(name,fn){fn();count++;console.log('PASS A20 '+name);}
const k={},keys=roles.map((role,i)=>{
 const pair=crypto.generateKeyPairSync('ed25519');k[role]=pair.privateKey;
 return{role,keyId:'TEST-ONLY-'+i,person:'SYNTHETIC NOT REAL '+i,
  publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
  spkiSha256:sha(pair.publicKey.export({format:'der',type:'spki'}))};
});
const signedRoots={format:'GomokuA18IndependentOperatorRoots',version:18,repo:'thiepn/gomoku',
 a17Head:require('./a18-source-pins.json').upstreamA17,issuerKeys:keys,revokedKeys:[],rotationHistory:[]};
function sign(kind,payload){
 const base={format:'GomokuA18SignedOriginals',version:18,kind,repository:'thiepn/gomoku',
 originalSourceSha:LOCK.sourceSha,a17Head:require('./a18-source-pins.json').upstreamA17,
 productionCommitSha:'f'.repeat(40),deploymentId:'SYNTHETIC-NOT-DEPLOYED',
 payloadDigest:A18.hash(payload),challengeDigest:scope,issuedAt:'2026-10-10T16:00:00Z',expiresAt:'2026-10-10T18:00:00Z'};
 return{...base,signatures:A18.KINDS[kind].map(role=>{
  const row=keys.find(x=>x.role===role);
  return {role,keyId:row.keyId,person:row.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(base)),k[role]).toString('base64')};
 })};
}
function original(){
 const bytes=Buffer.from('SYNTHETIC fake host original immutable file; NOT hosted');
 const rec={format:'GomokuA20OriginalReceipt',version:20,repository:'thiepn/gomoku',
 a19Head:ROOT.a19Head,originalA9Source:LOCK.sourceSha,ownerPermissionState:'OPEN',
 actualProductionHostAccessed:false,rightsOriginalOwnerApproval:'PENDING',
 independentProviderAuthenticatedClaimed:true,challengeDigest:scope,
 objectSha256:sha(bytes),previousObjectSha256:prior,sequence:1,
 deploymentId:'SYNTHETIC-NOT-DEPLOYED',capturedAt:'2026-10-10T16:30:00Z',
 origin,requestMethod:'GET',redirected:false,cookiesOrCredentialsSent:false,
 separateOriginalsVaultClaimed:true,originalEightAssetsDigest:'d'.repeat(64)};
 const payload={sourceSha:LOCK.sourceSha,a19Head:ROOT.a19Head,originalObjectSha256:rec.objectSha256,
  receiptDigest:A18.hash(rec),challengeDigest:rec.challengeDigest,
  originalEightAssetsDigest:rec.originalEightAssetsDigest};
 return{receipt:rec,originalBytes:bytes,priorA19:{status:'host-original-bytes-reviewable',
  originalHostBytesChecked:8,originalsDigest:rec.originalEightAssetsDigest},witness:sign('host-byte-intake',payload),
 roots:signedRoots,now:NOW};
}
function device(){
 const cases=[],originalMedia={};
 for(const [platform,ids] of Object.entries(A9.DEVICE_CHECKS))for(const caseId of ids){
  const id=platform+':'+caseId,bytes=Buffer.from('SYNTHETIC NOT REAL device '+id);
  originalMedia[id]=bytes;
  cases.push({platform,caseId,reviewState:'pending-independent-witness',
   originalSha256:sha(bytes),observedAt:'2026-10-10T16:30:00Z',
   deviceId:'SYNTHETIC fake device',operator:'SYNTHETIC TESTER'});
 }
 const accessibilityMedia=Object.fromEntries(require('./a18-physical-and-restore.cjs').ACCESSIBILITY.map((id,i)=>[id,Buffer.from('SYNTHETIC assisted QA '+i)]));
 const packet={format:'GomokuA20DeviceWitnessIntake',version:20,
  sourceSha:LOCK.sourceSha,a19Head:ROOT.a19Head,humanApprovalStatus:'OPEN',physicalAccepted:0,
  cases,accessibility:require('./a18-physical-and-restore.cjs').ACCESSIBILITY.map((id,i)=>({
   id,state:'pending-independent-accessibility-review',
   originalDigest:sha(Buffer.from('SYNTHETIC assisted QA '+i)),
   notes:'SYNTHETIC browser observation; no actual physical test was performed.'}))};
 const independent={format:'GomokuA20DeviceIndependentReview',version:20,
  sourceSha:LOCK.sourceSha,a19Head:ROOT.a19Head,deviceOriginalsDigest:A18.hash(packet),
  ownerPermissionStatus:'OPEN',humanSignersIndependentlyAuthenticated:false,
  originalReviewerPacketDigest:prior};
 return{packet,originalMedia,accessibilityMedia,priorA19:{status:'physical-original-custody-reviewable',
  physicalAccepted:0},independent,now:NOW};
}
function ledger(){
 const local={entries:[{action:'issue',challenge,packetDigest:undefined},
  {action:'consume',challenge,packetDigest:scope}]};
 const first='e'.repeat(64),next='f'.repeat(64),last='1'.repeat(64);
 const log={format:'GomokuA20MultiOperatorJournal',version:20,repository:'thiepn/gomoku',
  sourceSha:LOCK.sourceSha,a19Head:ROOT.a19Head,productionTouched:false,
  ownerApprovalStatus:'OPEN',globalProviderAttestedClaimed:true,
  firstRoot:first,finalRoot:last,revokedKeyIds:[],originalProviderArchiveDigest:'2'.repeat(64),
  externalProviderAuditDigest:'3'.repeat(64),entries:[
   {action:'issue',index:1,challenge,eventId:'4'.repeat(64),previousRoot:first,
    nextRoot:next,operator:'SYNTHETIC ISSUER',payloadDigest:scope,
    providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:00:00Z'},
   {action:'consume',index:2,challenge,eventId:'5'.repeat(64),previousRoot:next,
    nextRoot:last,operator:'SYNTHETIC SEPARATE CONSUMER',payloadDigest:scope,
    providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:01:00Z'}]};
 const roots={...ROOT,keys:[{keyId:'SYNTHETIC KEY NOT REAL',operator:'SYNTHETIC KEY OWNER'}],
  providerTrustRoots:['SYNTHETIC PROVIDER']};
 return{log,originalLocal:local,roots,now:NOW};
}
test('original A19 source head pinned, no human trust roots',()=>{
 assert.equal(ROOT.a19Head,'5faa7cf25c9d5e5968a069d6ecc094f16c4bb83c');
 assert.equal(ROOT.keys.length,0);assert.equal(ROOT.providerTrustRoots.length,0);
 assert.equal(Review.state().status,'NO_GO');
});
test('synthetic original byte escrow consistent, no human authority',()=>{
 const r=Intake.inspect(original());assert.equal(r.status,'external-originals-documentary-ready',r.reason);
 assert.equal(r.independentRealEvidenceAccepted,false);assert.equal(r.canDeploy,false);
});
test('tampered original bytes rejected',()=>{
 const a=original();a.originalBytes=Buffer.from('tampered');assert.equal(Intake.inspect(a).status,'blocked-original-intake');
});
test('wrong hosted origin rejected',()=>{
 const a=original();a.receipt.origin='https://gomoku.thiepn.dev/';
 assert.equal(Intake.inspect(a).status,'blocked-origin');
});
test('missing real human roots rejects synthetic signature fixture',()=>{
 const a=original();a.roots=require('./a18-review-roots.json');
 assert.equal(Intake.inspect(a).status,'blocked-roots');
});
test('changed signed object digest rejected',()=>{
 const a=original();a.receipt.originalEightAssetsDigest='9'.repeat(64);
 assert.equal(Intake.inspect(a).status,'blocked-host-binding');
});
test('original receipt chain source and byte checks',()=>{
 const a=original(),next={...a.receipt,sequence:2,capturedAt:'2026-10-10T16:35:00Z',
  previousObjectSha256:a.receipt.objectSha256};
 const b=Buffer.from('Distinct synthetic byte original');
 next.objectSha256=sha(b);
 assert.equal(Intake.verifyPriorOriginal({oldOriginal:a.receipt,newOriginal:next,
  priorBytes:a.originalBytes,newBytes:b}).status,'prior-original-chain-documentary');
});
test('wrong prior archive chain blocks',()=>{
 const a=original(),next={...a.receipt,sequence:2,previousObjectSha256:'0'.repeat(64),
  capturedAt:'2026-10-10T16:35:00Z'};
 assert.equal(Intake.verifyPriorOriginal({oldOriginal:a.receipt,newOriginal:next,
  priorBytes:a.originalBytes,newBytes:a.originalBytes}).status,'blocked-original-chain');
});
test('18 binary physical originals and 7 accessibility notes always remain pending',()=>{
 const r=Review.device(device());assert.equal(r.status,'device-originals-documentary-only',r.reason);
 assert.equal(r.casesPending,18);assert.equal(r.accessibilityPending,7);assert.equal(r.physicalAccepted,0);
});
test('missing phone original blocks review',()=>{
 const x=device();delete x.originalMedia['android-chrome:fresh-launch'];
 assert.equal(Review.device(x).status,'blocked-original-device');
});
test('one actual byte mutation rejected',()=>{
 const x=device();x.originalMedia['installed-android-pwa:offline-launch']=Buffer.from('tampered');
 assert.equal(Review.device(x).status,'blocked-original-device');
});
test('missing screen reader original blocks',()=>{
 const x=device();x.packet.accessibility[0].id='wrong';
 assert.equal(Review.device(x).status,'blocked-assistive-originals');
});
test('tampered original accessibility media bytes denied',()=>{
 const x=device();x.accessibilityMedia['screen-reader']=Buffer.from('TAMPERED');
 assert.equal(Review.device(x).status,'blocked-assistive-originals');
});
test('missing accessible original media byte object denied',()=>{
 const x=device();delete x.accessibilityMedia['zoom-200'];
 assert.equal(Review.device(x).status,'blocked-assistive-originals');
});
test('fake owner-approved physical outcome forbidden',()=>{
 const x=device();x.packet.physicalAccepted=18;
 assert.equal(Review.device(x).status,'blocked-device-intake');
});
test('multi operator issue/consume once-only sources match but no global authority',()=>{
 const x=ledger(),r=M.reconcile(x);
 assert.equal(r.status,'multioperator-documentary-consistent',r.reason);
 assert.equal(r.globalLedgerAuthenticated,false);assert.equal(r.nonceStates[0],'consumed');
});
test('unprovisioned global provider/keys refuse any multioperator history',()=>{
 const x=ledger();x.roots=ROOT;assert.equal(M.reconcile(x).status,'blocked-provider-trust');
});
test('double consumed challenge invalidates journal',()=>{
 const x=ledger();x.log.entries.push({...x.log.entries[1],index:3,
  eventId:'6'.repeat(64),previousRoot:'1'.repeat(64),nextRoot:'7'.repeat(64),
  observedAt:'2026-10-10T16:02:00Z'});
 x.log.finalRoot='7'.repeat(64);
 assert.equal(M.reconcile(x).status,'blocked-consumption-race');
});
test('same operator cannot self-attest issue and consume',()=>{
 const x=ledger();x.log.entries[1].operator=x.log.entries[0].operator;
 assert.equal(M.reconcile(x).status,'blocked-consumption-race');
});
test('provider CAS root drift blocked',()=>{
 const x=ledger();x.log.entries[1].previousRoot='0'.repeat(64);
 assert.equal(M.reconcile(x).status,'blocked-event-order');
});
test('missing provider original archive digest refused',()=>{
 const x=ledger();x.log.originalProviderArchiveDigest=null;
 assert.equal(M.reconcile(x).status,'blocked-provider-originals');
});
test('independent signer revocation event preserves monotonic provider root history',()=>{
 const x=ledger(),e={action:'revoke',index:3,challenge,eventId:'6'.repeat(64),
  previousRoot:'1'.repeat(64),nextRoot:'7'.repeat(64),
  operator:'SYNTHETIC INDEPENDENT REVOKER',revokedKeyId:'SYNTHETIC KEY NOT REAL',
  payloadDigest:scope,providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:02:00Z'};
 x.log.entries.push(e);x.log.finalRoot=e.nextRoot;
 x.log.revokedKeyIds=['SYNTHETIC KEY NOT REAL'];
 const r=M.reconcile(x);
 assert.equal(r.status,'multioperator-documentary-consistent',r.reason);
 assert.deepEqual(r.revokedKeys,['SYNTHETIC KEY NOT REAL']);
});
test('revoked signer cannot self-revoke as independent operator',()=>{
 const x=ledger(),e={action:'revoke',index:3,challenge,eventId:'6'.repeat(64),
  previousRoot:'1'.repeat(64),nextRoot:'7'.repeat(64),
  operator:'SYNTHETIC KEY OWNER',revokedKeyId:'SYNTHETIC KEY NOT REAL',
  payloadDigest:scope,providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:02:00Z'};
 x.log.entries.push(e);x.log.finalRoot=e.nextRoot;
 x.log.revokedKeyIds=['SYNTHETIC KEY NOT REAL'];
 assert.equal(M.reconcile(x).status,'blocked-revocation');
});
test('independently proposed prior-stable recovery is a review only, never execution',()=>{
 const x=ledger(),e={action:'recover',index:3,challenge,eventId:'6'.repeat(64),
  previousRoot:'1'.repeat(64),nextRoot:'7'.repeat(64),
  operator:'SYNTHETIC DISTINCT RECOVERY OPERATOR',
  previousStableArchiveSha256:'8'.repeat(64),realRecoveryExecuted:false,
  payloadDigest:scope,providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:02:00Z'};
 x.log.entries.push(e);x.log.finalRoot=e.nextRoot;
 const r=M.reconcile(x);
 assert.equal(r.status,'multioperator-documentary-consistent',r.reason);
 assert.deepEqual(r.nonceStates,['recovery-reviewed']);assert.equal(r.canExecuteRecovery,false);
});
test('recovery self-reviewed by original consumer fails closed',()=>{
 const x=ledger(),e={action:'recover',index:3,challenge,eventId:'6'.repeat(64),
  previousRoot:'1'.repeat(64),nextRoot:'7'.repeat(64),
  operator:'SYNTHETIC SEPARATE CONSUMER',
  previousStableArchiveSha256:'8'.repeat(64),realRecoveryExecuted:false,
  payloadDigest:scope,providerRootId:'SYNTHETIC PROVIDER',observedAt:'2026-10-10T16:02:00Z'};
 x.log.entries.push(e);x.log.finalRoot=e.nextRoot;
 assert.equal(M.reconcile(x).status,'blocked-recovery');
});
test('key compromise rotation from no real previous public roots denied',()=>{
 assert.equal(M.compromisedKey({globalReport:M.reconcile(ledger())}).status,'blocked-prior-roots');
});
test('distinct previous stable evidence requires original bytes',()=>{
 const archive=Buffer.from('DIFFERENT FAKE PRIOR STABLE ZIP bytes');
 const review={status:'prior-archive-reviewable-only'};
 const a={format:'GomokuA20DistinctStableEscrow',version:20,sourceSha:LOCK.sourceSha,
  a19Head:ROOT.a19Head,releaseState:'NOT_EXECUTED',priorSha256:sha(archive)};
 const receipt={format:'GomokuA20PriorRecoveryWitness',priorSha256:a.priorSha256,
  actualRestorePerformed:false,personalPlayerDataAccessed:false,currentProductionChanged:false,
  offlineSyntheticRehearsalDigest:prior,observedAt:'2026-10-10T16:30:00Z'};
 assert.equal(Review.previousStable({priorArchive:a,originalBytes:archive,a19Review:review,
  receipt,now:NOW}).status,'previous-stable-custody-documentary');
});
test('original A9 ZIP never accepted as prior stable restore',()=>{
 const r=Review.previousStable({a19Review:{status:'prior-archive-reviewable-only'},
  priorArchive:{format:'GomokuA20DistinctStableEscrow',version:20,sourceSha:LOCK.sourceSha,
   a19Head:ROOT.a19Head,releaseState:'NOT_EXECUTED',priorSha256:ROOT.originalOfflineZipSHA256}});
 assert.equal(r.status,'blocked-prior-recovery');
});
test('before release remains blocked absent originals and human owner signoff',()=>{
 const r=Review.release();assert.equal(r.status,'blocked-release-prerequisites');assert.equal(r.canDeploy,false);
});
test('postrelease closure requires real separately authorized A12 and 24–72h A13',()=>{
 const r=Review.closure();assert.equal(r.status,'blocked-real-postrelease');assert.equal(r.canCloseRelease,false);
});
test('all NO_GO authority flags false and physical real case 0',()=>{
 const r=Review.state();
 assert.equal(r.status,'NO_GO');assert.equal(r.humanSignerRoots,0);
 for(const k of ['canDeploy','canMerge','canTag','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])assert.equal(r[k],false);
});
console.log(count+' A20 synthetic adversarial original-byte/device/global replay/recovery/owner tests passed. No real human signer, device, provider or release access.');
