/* A16: synthetic-only crypto, PWA, externally witnessed replay and owner decision contract tests. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const A9=require('./rc9-core.cjs'),A11=require('./a11-release-admission.cjs');
const A14=require('./a14-custody.cjs'),LOCK=require('./a10-source-lock.json');
const Ledger=require('./a15-local-ledger.cjs'),OBS=require('./a15-public-archive-observation.json');
const Public=require('./a16-original-physical.cjs'),C=require('./a16-independent-custody.cjs');
const Owner=require('./a16-owner-decision.cjs');
const A15=require('./a15-operator-closure.cjs');
const h='a'.repeat(64),url='https://gomoku-a16-preview-only.vercel.app/';
const a15Head='df2b958494460d650574351472770458e5ab5f62';
const now='2026-10-09T15:00:00Z',earlier='2026-10-09T14:00:00Z';
let count=0;function check(name,fn){fn();console.log('PASS '+name);count++;}
function candidate(){
 const c={format:'GomokuAnalysis3Candidate',version:9,sourceBranch:LOCK.upstreamBranch,
  sourceSha:LOCK.sourceSha,originMainFrozen:true,workflowRunId:LOCK.githubRunId,
  assets:{...OBS.a9.assetByteHashes}};
 c.stages=Object.fromEntries(A9.STAGES.map(x=>[x,{status:'passed',issuer:'GitHub Actions',
  sourceSha:c.sourceSha,indexSha256:c.assets['index.html'],workflowRunId:LOCK.githubRunId,
  completedAt:earlier}]));
 return c;
}
const roles=['external-ledger-custodian','independent-evidence-reviewer','release-owner'];
function identities(){
 const privateKeys={};
 const keys=roles.map((role,i)=>{
  const kp=crypto.generateKeyPairSync('ed25519'),id='SYNTHETIC-ONLY-'+i;
  privateKeys[role]=kp.privateKey;
  return {id,role,person:'SYNTHETIC PERSON '+role,
   publicKeyPem:kp.publicKey.export({format:'pem',type:'spki'}),
   spkiSha256:crypto.createHash('sha256').update(kp.publicKey.export({format:'der',type:'spki'})).digest('hex')};
 });
 return {roots:{format:'GomokuA16ExternalWitnessTrustRoots',version:16,repository:'thiepn/gomoku',
  a15HeadSha:a15Head,keys,revokedKeyIds:[]},privateKeys};
}
const deployment='SYNTHETIC-A16-NOT-REAL',productionCommitSha='f'.repeat(40);
function envelope(kind,payload,{roots,privateKeys},rolesToSign,extra={}){
 const e={format:'GomokuA16SignedEvidenceEnvelope',version:16,kind,repository:'thiepn/gomoku',
  sourceSha:LOCK.sourceSha,a15HeadSha:a15Head,productionCommitSha,
  deploymentId:deployment,evidenceDigest:A14.sha(payload),payload,...extra};
 e.signatures=[];
 const {signatures:_,...bare}=e;
 for(const role of rolesToSign){
  const key=roots.keys.find(x=>x.role===role);
  e.signatures.push({role,keyId:key.id,signer:key.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(bare)),privateKeys[role]).toString('base64')});
 }
 return e;
}
function device(id,c){
 return {status:'passed',sha:c.sourceSha,artifactHash:c.assets['index.html'],
  device:'SYNTHETIC fixture device not physical',osVersion:'Synthetic OS 15',browserVersion:'Synthetic browser 120',
  testedUrl:url,tester:'SYNTHETIC PERSON',signature:'NOT A REAL HUMAN SIGNATURE',
  issuer:'Synthetic fixture',timestamp:now,testCases:A9.DEVICE_CHECKS[id].map(id=>({
   id,status:'passed',observation:'SYNTHETIC NEVER REAL physical test evidence'}))};
}
function physicalFixture(i){
 const c=candidate();
 const worksheet={sourceSha:c.sourceSha,indexSha256:c.assets['index.html'],
  serviceWorkerSha256:c.assets['sw.js'],manifestSha256:c.assets['manifest.webmanifest'],
  candidatePreviewUrl:url,physicalEvidence:Object.fromEntries(A9.PHYSICAL.map(k=>[k,device(k,c)])),
  ownerApproval:{status:'approved',sha:c.sourceSha,artifactHash:c.assets['index.html'],
   approvedBy:'SYNTHETIC NOT APPROVED',approvedAt:now}};
 const probe={url,sourceSha:c.sourceSha,archiveSha256:LOCK.offlineZipSha256,
  verifiedAssets:A9.ASSETS.map(path=>({path,sha256:c.assets[path],bytes:1000}))};
 const controlledUpdate={format:'GomokuAnalysis3A11ControlledUpdate',status:'passed',
  originalSourceSha:c.sourceSha,originalServiceWorkerSha256:c.assets['sw.js'],
  updatedServiceWorkerSha256:'d'.repeat(64),revertedServiceWorkerSha256:c.assets['sw.js'],
  candidatePreviewUrl:url,updatedPreviewUrl:url,previewOnly:true,productionUnaffected:true,
  authorizedBy:'SYNTHETIC FIXTURE',authorizedAt:earlier,device:'SYNTHETIC FIXTURE',
  tester:'SYNTHETIC FIXTURE',observedAt:now,
  observation:'SYNTHETIC: no actual controlled SW install or update occurred.',
  evidenceReference:'synthetic',evidenceSha256:h,rollbackObserved:true};
 const rollback={format:'GomokuAnalysis3A11RollbackRehearsal',status:'passed',
  sourceSha:c.sourceSha,immutableZipSha256:LOCK.offlineZipSha256,indexSha256:c.assets['index.html'],
  previewOnly:true,productionUnaffected:true,backupVerified:true,backupReference:'synthetic',
  executedBy:'SYNTHETIC FIXTURE',executedAt:now,
  observation:'SYNTHETIC: no actual previous-stable restore occurred.',
  evidenceReference:'synthetic',evidenceSha256:h,restoredAllEightAssets:true,restoredOfflineAndSavedRecords:true};
 const a11=A11.audit({candidate:c,worksheet,probe,updateEvidence:controlledUpdate,rollbackEvidence:rollback});
 const p={candidate:c,worksheet,probe,controlledUpdate,rollback,a11};
 const witnessPayload={sourceSha:LOCK.sourceSha,previewOrigin:url,
  originalsDigest:A14.sha(p),physicalCases:18,productionCommitSha};
 const witness=envelope('physical-acceptance',witnessPayload,i,['independent-evidence-reviewer']);
 return {...p,witness,roots:i.roots};
}
function localLedger(){
 const id=deployment,scope='a'.repeat(64),challenge='1'.repeat(32),at=1728500000000;
 const doc=Ledger.genesis();
 const issue={seq:1,action:'issue',challenge,scopeDigest:scope,deploymentId:id,
  actor:'SYNTHETIC operator',atMs:at,previous:doc.head,expiresAtMs:at+3600000};
 issue.digest=A14.sha(issue);doc.entries.push(issue);doc.head=issue.digest;
 const consume={seq:2,action:'consume',challenge,scopeDigest:scope,deploymentId:id,
  actor:'SYNTHETIC reviewer',atMs:at+10000,previous:doc.head,packetDigest:'b'.repeat(64)};
 consume.digest=A14.sha(consume);doc.entries.push(consume);doc.head=consume.digest;
 Ledger.validate(doc);
 return doc;
}
function replayFixture(i){
 const ledger=localLedger(),row=ledger.entries[1];
 const payload={a15HeadSha:a15Head,challenge:row.challenge,ledgerHead:ledger.head,
  ledgerDigest:A14.sha(ledger),scopeDigest:row.scopeDigest,packetDigest:row.packetDigest,
  issuedAtMs:ledger.entries[0].atMs,consumedAtMs:row.atMs,productionCommitSha};
 const receipt=envelope('replay-ledger',payload,i,['external-ledger-custodian','independent-evidence-reviewer']);
 return {ledger,receipt,roots:i.roots};
}
function gitFixture(){
 return {candidate:candidate(),github:{status:'ready-for-original-byte-and-independent-review',
  a9SourceSha:LOCK.sourceSha,a14HeadSha:'20ed712041029930b41fd76e5c895a6f43c29e1d',
  validatedRuns:[Number(LOCK.githubRunId),...require('./a15-evidence-pins.json').requiredRuns.map(x=>x.id)],
  validatedArtifacts:[]},
 offlineZip:{status:'ready-for-independent-zip-review',offlineZipSha256:LOCK.offlineZipSha256}};
}
const z=identities();
check('no witness registry provisioned; default denies',()=>{
 assert.equal(C.trust(),null);
 assert.equal(C.replay({}).status,'blocked-ledger');
 assert.equal(C.verifySigned().status,'blocked-trust');
});
check('synthetic public source byte hash and all 7 A9 stages reconcile',()=>{
 assert.equal(Public.source(gitFixture()).status,'original-ci-bytes-ready-for-independent-review');
});
check('source drift blocks all original trust',()=>{
 const x=gitFixture();x.candidate.sourceSha='0'.repeat(40);
 assert.equal(Public.source(x).status,'blocked-a9-source');
});
check('A9 staged source absent blocks source gate',()=>{
 const x=gitFixture();x.candidate.stages.package.status='skipped';
 assert.equal(Public.source(x).status,'blocked-a9-source');
});
check('tampered actual CI archived asset digest is denied',()=>{
 const x=gitFixture(),obs=structuredClone(OBS);obs.a9.assetByteHashes['sw.js']='0'.repeat(64);
 assert.equal(Public.source({...x,observed:obs}).status,'blocked-artifact-original');
});
check('missing original GitHub readback blocks source gate',()=>{
 const x=gitFixture();x.github=null;assert.equal(Public.source(x).status,'blocked-github');
});
check('physical remains blocked with zero observed hosted bytes',()=>{
 assert.equal(Public.hosted({candidate:candidate()}).status,'blocked-hosted-https');
});
check('synthetic complete A11 physical worksheet is only manual review',()=>{
 const x=physicalFixture(z);
 assert.equal(x.a11.status,'ready-for-independent-release-review');
 assert.equal(Public.hosted(x).status,'ready-for-independent-original-physical-review');
});
check('18/18 synthetic case observations still never create release grant',()=>{
 const r=Public.hosted(physicalFixture(z));
 assert.equal(r.canCertifyPhysical,false);assert.equal(r.canDeploy,false);
});
check('hosted source cannot be localhost nor production host',()=>{
 const x=physicalFixture(z);x.probe.url='https://gomoku.thiepn.dev/';
 assert.equal(Public.hosted(x).status,'blocked-hosted-https');
});
check('tampered HTTPS asset fails',()=>{
 const x=physicalFixture(z);x.probe.verifiedAssets[3].sha256='0'.repeat(64);
 assert.equal(Public.hosted(x).status,'blocked-hosted-https');
});
check('wrong physical case blocks',()=>{
 const x=physicalFixture(z);x.worksheet.physicalEvidence['android-chrome'].testCases.pop();
 assert.equal(Public.hosted(x).status,'blocked-physical');
});
check('same-version SW update never qualifies',()=>{
 const x=physicalFixture(z);x.controlledUpdate.updatedServiceWorkerSha256=x.candidate.assets['sw.js'];
 assert.equal(Public.hosted(x).status,'blocked-sw-update');
});
check('missing prior preview rollback not allowed',()=>{
 const x=physicalFixture(z);x.rollback.restoredOfflineAndSavedRecords=false;
 assert.equal(Public.hosted(x).status,'blocked-rollback');
});
check('distinct physical witness signs exact original packet',()=>{
 const x=physicalFixture(z);assert.equal(Public.hosted(x).status,'ready-for-independent-original-physical-review');
});
check('physical witness digest mutation blocked',()=>{
 const x=physicalFixture(z);x.witness.payload.originalsDigest='f'.repeat(64);
 assert.equal(Public.hosted(x).status,'blocked-witness');
});
check('physical evidence cannot use unprovisioned real roots',()=>{
 const x=physicalFixture(z);x.roots=require('./a16-witness-roots.json');
 assert.equal(Public.hosted(x).status,'blocked-trust');
});
check('local ledger replayed challenge independently witnessed synthetically only',()=>{
 assert.equal(C.replay(replayFixture(z)).status,'ready-for-external-ledger-review');
});
check('local ledger without consumption is blocked',()=>{
 const x=replayFixture(z);x.ledger.entries.pop();x.ledger.head=x.ledger.entries[0].digest;
 assert.equal(C.replay(x).status,'blocked-replay');
});
check('external witness cannot attest different ledger head',()=>{
 const x=replayFixture(z);x.receipt.payload.ledgerHead='0'.repeat(64);
 assert.equal(C.replay(x).status,'blocked-replay');
});
check('unreviewed replay custodian cannot self-sign independently',()=>{
 const x=replayFixture(z);x.roots.keys[1].person=x.roots.keys[0].person;
 assert.equal(C.replay(x).status,'blocked-trust');
});
check('replayed signature mutation blocked',()=>{
 const x=replayFixture(identities());const sig=x.receipt.signatures[0].signature;
 x.receipt.signatures[0].signature=(sig[0]==='A'?'B':'A')+sig.slice(1);
 assert.equal(C.replay(x).status,'blocked-signature');
});
check('independent key revoked denies replay attestation',()=>{
 const x=replayFixture(z);x.roots={...z.roots,revokedKeyIds:[z.roots.keys[0].id]};
 assert.equal(C.replay(x).status,'blocked-trust');
});
check('missing human owner decision blocks release',()=>{
 assert.equal(Owner.releaseDecision().status,'blocked-source');
});
check('precutover release consideration cannot use missing 18 physical cases',()=>{
 assert.equal(Owner.releaseDecision({source:Public.source(gitFixture())}).status,'blocked-physical');
});
check('postrelease closure cannot claim actual cutover',()=>{
 assert.equal(Owner.operationalClosure().status,'blocked-release');
});
check('rotation without provisioned A14 human roots is denied',()=>{
 assert.equal(Owner.rotation().status,'blocked-rotation');
});
check('owner decision is always nonauthorizing',()=>{
 const r=Owner.releaseDecision();
 for(const p of ['canMerge','canTag','canDeploy','canModifyProductionData','canCloseRelease'])
  assert.equal(r[p],false);
});
check('A16 signed envelope binds exact A15 head and deployment identity',()=>{
 const e=replayFixture(z);e.receipt.a15HeadSha='0'.repeat(40);
 assert.equal(C.replay(e).status,'blocked-binding');
});
check('A16 witness cannot claim wrong signed source hash',()=>{
 const e=replayFixture(z);e.receipt.sourceSha='0'.repeat(40);
 assert.equal(C.replay(e).status,'blocked-binding');
});
check('release and closure remain separated for 24-72h and independent decision',()=>{
 const r=Owner.operationalClosure({release:{status:'ready-for-separate-human-release-decision'}});
 assert.equal(r.status,'blocked-cutover');
});
console.log(count+' A16 adversarial synthetic source/host/physical/replay/owner gates passed; ZERO device or human approvals generated.');
