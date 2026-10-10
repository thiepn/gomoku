'use strict';
/* All private keys and person records here are SYNTHETIC ephemeral test fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json'),A14=require('./a14-custody.cjs');
const PIN=require('./a18-source-pins.json'),W=require('./a18-signer-reconciliation.cjs');
const HOST=require('./a18-hosted-provenance.cjs'),DEVICE=require('./a18-physical-and-restore.cjs');
const RELEASE=require('./a18-release-reconciliation.cjs');
const Ledger=require('./a15-local-ledger.cjs');
const receipt=JSON.parse(fs.readFileSync(path.join(__dirname,'..','.a18-input','analysis9-test-output','rc9-candidate.json'),'utf8'));
const sourceRoot=path.join(__dirname,'..','analysis18-test-output','preview-static');
const site='https://synthetic-a18-review.vercel.app/',NOW=new Date('2026-10-10T14:00:00Z');
const HEX='a'.repeat(64),HEX2='b'.repeat(64);
const roles=[...W.ROLES];
let count=0;function test(label,fn){fn();count++;console.log('PASS A18 '+label)}
const auth={format:'GomokuA17OperatorScope',version:17,repository:'thiepn/gomoku',
 originalSourceSha:LOCK.sourceSha,a16HeadSha:'bb868a84d24f622f8f5dcab64756c803228db8d0',
 allowedOperations:['preview-read'],operator:'SYNTHETIC OPERATOR',authorizedBy:'SYNTHETIC OTHER REVIEWER',
 originalAuthorizationDigest:HEX,scopeRecordDigest:HEX2,nonce:'c'.repeat(32),
 issuedAt:'2026-10-10T13:30:00Z',expiresAt:'2026-10-10T14:30:00Z',exactPreviewOrigin:site};
function keys(){
 const signing=new Map(),people=[];
 for(let i=0;i<roles.length;i++){
  const pair=crypto.generateKeyPairSync('ed25519'),role=roles[i];
  signing.set(role,pair.privateKey);
  const pem=pair.publicKey.export({format:'pem',type:'spki'});
  people.push({keyId:'SYNTHETIC-'+i,role,person:'NOT REAL PERSON '+i,
   publicKeyPem:pem,spkiSha256:crypto.createHash('sha256').update(pair.publicKey.export({format:'der',type:'spki'})).digest('hex')});
 }
 return {signing,roots:{format:'GomokuA18IndependentOperatorRoots',version:18,repo:'thiepn/gomoku',
  a17Head:PIN.upstreamA17,issuerKeys:people,revokedKeys:[],rotationHistory:[]}};
}
const identity=keys();
function envelope(kind,payload,ctx=identity){
 const e={format:'GomokuA18SignedOriginals',version:18,kind,repository:'thiepn/gomoku',
  originalSourceSha:LOCK.sourceSha,a17Head:PIN.upstreamA17,productionCommitSha:'f'.repeat(40),
  deploymentId:'SYNTHETIC NEVER EXECUTED',payloadDigest:W.hash(payload),challengeDigest:HEX,
  issuedAt:'2026-10-10T13:00:00Z',expiresAt:'2026-10-10T15:00:00Z'};
 const signatures=W.KINDS[kind].map(role=>{
  const signer=ctx.roots.issuerKeys.find(x=>x.role===role);
  return {role,keyId:signer.keyId,person:signer.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(e)),ctx.signing.get(role)).toString('base64')};
 });
 return {...e,signatures};
}
function noAuthority(r){
 for(const k of ['canMerge','canDeploy','canTag','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])assert.equal(r[k],false,k);
}
function host(){
 const assets=A9.ASSETS.map(p=>({path:p,sha256:receipt.assets[p],bytes:fs.readFileSync(path.join(sourceRoot,p)).length}));
 const c={status:'preview-bytes-observed-unsigned',sourceSha:LOCK.sourceSha,origin:site,
  assets,originalZipSha256:LOCK.offlineZipSha256,actualHostedAccepted:false,
  approvalScopeDigest:crypto.createHash('sha256').update(JSON.stringify(auth)).digest('hex'),
  bytesDigest:crypto.createHash('sha256').update(JSON.stringify({origin:site,assets})).digest('hex')};
 const original={format:'GomokuA18HostOriginals',version:18,origin:site,
  originalSourceSha:LOCK.sourceSha,a17Head:PIN.upstreamA17,
  offlineZipSha256:LOCK.offlineZipSha256,observationDigest:W.hash(c),
  networkMethod:'GET-only-no-redirect-no-credentials',
  artifactBytesPreservedIndependently:true,preservedOriginalsSha256:HEX,
  assetCount:8,productionOriginTouched:false};
 return {candidate:receipt,scope:auth,approvalOptIn:true,operatorCapture:c,
  originals:original,signature:envelope('host-byte-intake',original),roots:identity.roots,now:NOW};
}
function physical(){
 const platforms={};let i=0;
 for(const platform of Object.keys(DEVICE.PLATFORM)){
  const cases=A9.DEVICE_CHECKS[platform].map(id=>({
   id,status:'observed_pending_independent_review',observation:'SYNTHETIC case entry, no real Android phone observation took place',
   originalEvidenceDigest:crypto.createHash('sha256').update('synthetic-device:'+i++).digest('hex'),
   observedAt:'2026-10-10T13:45:00Z'}));
  platforms[platform]={platform,device:'SYNTHETIC '+platform,osVersion:'simulated 15',
   browserVersion:'simulated 130',operator:'SYNTHETIC OPERATOR',cases};
 }
 const worksheet={format:'GomokuA17OriginalDeviceWorksheet',version:17,
  sourceSha:LOCK.sourceSha,createdAt:'2026-10-10T13:00:00Z',origin:site,
  physicalAcceptance:'OPEN',ownerAuthorization:'not_approved',independentReviewer:'not_approved',platforms};
 const accessibility={format:'GomokuA18OriginalA11Accessibility',version:18,sourceSha:LOCK.sourceSha,
  previewOrigin:site,realHardwareObservedClaimed:true,
  cases:DEVICE.ACCESSIBILITY.map((id,i)=>({id,result:'observed-pending-review',
   originalMediaSha256:crypto.createHash('sha256').update('fake-accessibility:'+i).digest('hex'),
   observation:'SYNTHETIC accessibility note from automation, NOT REAL HARDWARE'}))};
 const swReview={format:'GomokuA18OriginalServiceWorkerUpdate',version:18,
  sourceSha:LOCK.sourceSha,origin:site,beforeHash:receipt.assets['sw.js'],
  updatedHash:HEX,revertedHash:receipt.assets['sw.js'],
  originalObservationDigest:HEX2,updatePerformedOnRealDeviceClaimed:true};
 const rollbackReview={format:'GomokuA18PreviousStableRestoreReview',
  status:'originals-awaiting-human-review',sourceSha:LOCK.sourceSha,previewOrigin:site,
  productionDataAccessed:false,realRestoreObservedClaimed:true};
 const payload={worksheetDigest:W.hash(worksheet),accessibilityDigest:W.hash(accessibility),
  swDigest:W.hash(swReview),rollbackDigest:W.hash(rollbackReview),sourceSha:LOCK.sourceSha,
  a17Head:PIN.upstreamA17,previewOrigin:site,physicalCases:18};
 return {worksheet,accessibility,preview:{status:'hosted-originals-ready-for-independent-human-review',
  sourceSha:LOCK.sourceSha,origin:site},swReview,rollbackReview,
  signature:envelope('physical-device-review',payload),roots:identity.roots,now:NOW};
}
function local(){
 const data=Ledger.genesis(),challenge='f'.repeat(32),t=Date.parse('2026-10-10T13:00:00Z');
 const a={seq:1,action:'issue',challenge,scopeDigest:HEX,deploymentId:'SYNTHETIC NEVER EXECUTED',
  actor:'FAKE ISSUER',atMs:t,previous:data.head,expiresAtMs:t+600000};
 a.digest=A14.sha(a);data.entries.push(a);data.head=a.digest;
 const b={seq:2,action:'consume',challenge,scopeDigest:HEX,deploymentId:a.deploymentId,
  actor:'FAKE CONSUMER',atMs:t+1000,previous:data.head,packetDigest:HEX2};
 b.digest=A14.sha(b);data.entries.push(b);data.head=b.digest;
 Ledger.validate(data);return data;
}
function custody(){
 const l=local(),external={format:'GomokuA18ExternalLedgerReview',version:18,
  repository:'thiepn/gomoku',sourceSha:LOCK.sourceSha,a17Head:PIN.upstreamA17,
  localHead:l.head,providerRootDigest:HEX,remoteObjectDigest:HEX2,
  writePolicy:'independently-operated-append-only-claimed',
  previousEpochRevocationsReviewed:true,replayNonceNeverReissuedClaimed:true,
  originalProviderAuditLogPreservedClaimed:true,personalPlayerDataIncluded:false,
  events:l.entries.map((e,i)=>({sequence:i+1,localRecordDigest:e.digest,
   eventDigest:crypto.createHash('sha256').update('synthetic-event:'+i).digest('hex'),
   observedAt:i?'2026-10-10T13:02:00Z':'2026-10-10T13:01:00Z'}))};
 const payload={sourceSha:LOCK.sourceSha,a17Head:PIN.upstreamA17,
  localLedgerHead:l.head,externalDocumentDigest:W.hash(external),
  remoteObjectDigest:HEX2,providerRootDigest:HEX};
 return {a17Review:{status:'independent-custody-documents-ready-for-human-review',
  replayConsumptionIndependentlyCertified:false},local:l,external,
  signatures:envelope('external-replay-ledger',payload),roots:identity.roots,now:NOW};
}
test('no real public roots provisioned: all unsigned documentary approvals DENIED',()=>{
 assert.equal(W.verifiedRoots(),null);assert.equal(W.verify({kind:'host-byte-intake'}).status,'blocked-roots');
 assert.equal(RELEASE.defaultReport().originalRealPhysicalCases,0);noAuthority(RELEASE.defaultReport());
});
test('A17 and A9 source anchors permanently pinned',()=>{
 assert.equal(PIN.upstreamA17,'92cc778bb415ce8e7157d386f29e44056c5f9397');
 assert.equal(PIN.a9NestedSHA256,LOCK.offlineZipSha256);
 assert.equal(Object.keys(receipt.assets).length,8);
});
test('synthetic signed host source matches but grants NO real-host acceptance',()=>{
 const r=HOST.inspect(host());assert.equal(r.status,'hosted-originals-ready-for-independent-human-review',r.reason);noAuthority(r);
});
test('host authorization withheld fails before cryptographic acceptance',()=>{
 assert.equal(HOST.inspect({...host(),approvalOptIn:false}).status,'blocked-permission');
});
test('host original source byte mutation denied',()=>{
 const h=host();h.operatorCapture.assets[0].sha256=HEX;
 assert.equal(HOST.inspect(h).status,'blocked-capture');
});
test('host redirect/production origin substituted not accepted',()=>{
 const h=host();h.operatorCapture.origin='https://gomoku.thiepn.dev/';
 assert.equal(HOST.inspect(h).status,'blocked-permission');
});
test('host original separate archival digest required',()=>{
 const h=host();h.originals.preservedOriginalsSha256='xxx';
 assert.equal(HOST.inspect(h).status,'blocked-originals');
});
test('actual source-root missing/invalid signature fails closed',()=>{
 const h=host();h.roots=require('./a18-review-roots.json');
 assert.equal(HOST.inspect(h).status,'blocked-roots');
});
test('tampered Ed25519 host signature detected',()=>{
 const h=host();const s=h.signature.signatures[0].signature;
 h.signature.signatures[0].signature=(s[0]==='A'?'B':'A')+s.slice(1);
 assert.equal(HOST.inspect(h).status,'blocked-signature');
});
test('invalid UTC date normalized Feb 30 rejected',()=>{
 const h=host();h.signature.issuedAt='2026-02-30T00:00:00Z';
 assert.equal(HOST.inspect(h).status,'blocked-time');
});
test('18 SYNTHETIC Android/Samsung/PWA reviews remain 0 accepted',()=>{
 const r=DEVICE.inspect(physical());assert.equal(r.status,'physical-originals-ready-for-independent-review',r.reason);
 assert.equal(r.physicalCasesReviewable,18);assert.equal(r.physicalAccepted,0);noAuthority(r);
});
test('duplicate case original media SHA denied',()=>{
 const x=physical();const d=x.worksheet.platforms['android-chrome'].cases;
 d[1].originalEvidenceDigest=d[0].originalEvidenceDigest;
 assert.equal(DEVICE.inspect(x).status,'blocked-physical-evidence');
});
test('one inaccessible missing screen reader result denied',()=>{
 const x=physical();x.accessibility.cases[0].result='skipped';
 assert.equal(DEVICE.inspect(x).status,'blocked-accessibility');
});
test('same-version service worker is not an upgrade',()=>{
 const x=physical();x.swReview.updatedHash=x.swReview.beforeHash;
 assert.equal(DEVICE.inspect(x).status,'blocked-sw');
});
test('original prior-stable reversal packet is independent of synthetic rehearsal',()=>{
 const prior={format:'GomokuA18PriorStableSource',version:18,previousStableArchiveSha256:HEX,
  sourceRef:'SYNTHETIC PREVIOUS SOURCE',originalSourceManifestSha256:HEX2};
 const restore={status:'isolated-restore-rehearsed-only',originalSourceSha:LOCK.sourceSha,
  previousStableArchiveSha256:HEX,assets:8,candidateAppliedThenRestored:true,
  syntheticRecordPreserved:true,realRollbackAccepted:false};
 const payload={a17Head:PIN.upstreamA17,a9SourceSha:LOCK.sourceSha,
  priorArchiveSha256:HEX,originalsDigest:W.hash(prior),rehearsalDigest:W.hash(restore),syntheticOnly:true};
 const out=DEVICE.previousStable({candidate:receipt,restore,prior,
  signature:envelope('previous-stable-restore',payload),roots:identity.roots,now:NOW});
 assert.equal(out.status,'prior-static-restore-documentary-review',out.reason);noAuthority(out);
});
test('A9 release-candidate SHA cannot masquerade as prior stable archive',()=>{
 const r=DEVICE.previousStable({candidate:receipt,prior:{format:'GomokuA18PriorStableSource',
  version:18,previousStableArchiveSha256:LOCK.offlineZipSha256}});
 assert.equal(r.status,'blocked-prior-image');
});
test('globally administered provider only DOCUMENTARY despite two synthetic signatures',()=>{
 const r=RELEASE.ledger(custody());assert.equal(r.status,'ledger-documentary-only',r.reason);
 assert.equal(r.independentReplayAuthority,false);noAuthority(r);
});
test('forged external event chronology cannot qualify',()=>{
 const x=custody();x.external.events[1].sequence=1;
 assert.equal(RELEASE.ledger(x).status,'blocked-ledger-history');
});
test('unreviewed external ledger signing roots are invalid',()=>{
 const x=custody();x.roots=require('./a18-review-roots.json');
 assert.equal(RELEASE.ledger(x).status,'blocked-roots');
});
test('owner release cannot advance with missing actual human/physical',()=>{
 const r=RELEASE.release();assert.equal(r.status,'blocked-release-gates');noAuthority(r);
});
test('postrelease closure cannot advance without authorized actual A12',()=>{
 const r=RELEASE.closure();assert.equal(r.status,'blocked-postrelease');noAuthority(r);
});
test('revoked signer key fails all detached witness reports',()=>{
 const h=host();h.roots={...identity.roots,revokedKeys:[identity.roots.issuerKeys[0].keyId]};
 assert.equal(HOST.inspect(h).status,'blocked-roots');
});
test('new trust epoch cannot bootstrap without real prior roots',()=>{
 assert.equal(W.rotation().status,'blocked-prior-roots');
});
test('release report always records 0/18 actual device acceptance',()=>{
 const d=RELEASE.defaultReport();
 assert.equal(d.gaps.length,9);assert.equal(d.originalRealPhysicalCases,0);
 assert.equal(d.releaseAuthorized,false);
});
console.log(count+' A18 source/replay/key/host/physical/accessibility/owner adversarial tests passed — ALL human identities, environment authorizations and physical receipts are SYNTHETIC.');
