/* Synthetic-only independent owner decision and key-rotation witness tests. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const A14=require('./a14-custody.cjs'),A15=require('./a15-operator-closure.cjs');
const C=require('./a16-independent-custody.cjs'),Decision=require('./a16-owner-decision.cjs');
const LOCK=require('./a10-source-lock.json'),PINS=require('./a15-evidence-pins.json');
const A15HEAD='df2b958494460d650574351472770458e5ab5f62';
const H='a'.repeat(64),commit='f'.repeat(40),deploymentId='SYNTHETIC NEVER DEPLOYED';
const originalOrigin='https://gomoku.thiepn.dev/';
let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name);}
function key(role,id){
 const kp=crypto.generateKeyPairSync('ed25519');
 const pub=kp.publicKey.export({type:'spki',format:'der'});
 return {public:{id,role,person:'SYNTHETIC PERSON '+id,
   publicKeyPem:kp.publicKey.export({type:'spki',format:'pem'}),
   spkiSha256:crypto.createHash('sha256').update(pub).digest('hex')},privateKey:kp.privateKey};
}
const witnesses=[
 key('external-ledger-custodian','LEDGER-ONLY'),
 key('independent-evidence-reviewer','REVIEWER-ONLY'),
 key('release-owner','OWNER-ONLY')
];
const roots={format:'GomokuA16ExternalWitnessTrustRoots',version:16,repository:'thiepn/gomoku',
 a15HeadSha:A15HEAD,revokedKeyIds:[],keys:witnesses.map(x=>x.public)};
function envelope(kind,payload,signerRoles,alter){
 const doc={format:'GomokuA16SignedEvidenceEnvelope',version:16,kind,repository:'thiepn/gomoku',
  sourceSha:LOCK.sourceSha,a15HeadSha:A15HEAD,productionCommitSha:commit,
  deploymentId,evidenceDigest:A14.sha(payload),payload,productionOrigin:originalOrigin};
 if(alter)alter(doc);
 const signatures=signerRoles.map(role=>{
  const w=witnesses.find(x=>x.public.role===role);
  return {role,keyId:w.public.id,signer:w.public.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(doc)),w.privateKey).toString('base64')};
 });
 return {...doc,signatures};
}
function signed(kind,payload,rs,alter){return envelope(kind,payload,rs,alter)}
function assertNoPrivilege(r){
 for(const p of ['canMerge','canTag','canDeploy','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])
  assert.equal(r[p],false,p);
}
function rotation(){
 const oldRoles=['owner','independent-reviewer','release-operator'];
 const current={format:'GomokuA14PinnedTrustRoots',version:1,repository:'thiepn/gomoku',
  a12HeadSha:'e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07',
  a13HeadSha:'0801c96d9317c625646eb20bf69ffecbd4f731f9',
  keys:oldRoles.map((role,i)=>key(role,'SYNTHETIC-OLD-'+i).public),
  revokedKeyIds:[]};
 const proposal={format:'GomokuA15TrustRotationProposal',version:15,sourceSha:LOCK.sourceSha,
  a14HeadSha:PINS.a14HeadSha,priorPolicyDigest:A14.sha(current),
  keys:[...current.keys],revokedKeyIds:[current.keys[0].id],changeEvidenceDigest:H};
 proposal.keys[0]=key('owner','SYNTHETIC-NEW-OWNER').public;
 const review={format:'GomokuA15IndependentRotationReview',
  priorPolicyDigest:A14.sha(current),proposedPolicyDigest:A14.sha(proposal),
  originalsDigest:H,witnessReportDigest:H,owner:'SYNTHETIC OWNER',
  independentReviewer:'SYNTHETIC REVIEWER',changeTicket:'SYNTHETIC TICKET',
  reviewedAt:'2026-10-10T09:00:00Z'};
 const payload={priorPolicyDigest:proposal.priorPolicyDigest,
  proposedPolicyDigest:A14.sha(proposal),changeEvidenceDigest:proposal.changeEvidenceDigest,
  a15HeadSha:A15HEAD};
 return {current,proposal,review,payload,witness:signed('key-rotation',payload,
  ['external-ledger-custodian','independent-evidence-reviewer'])};
}
test('signed synthetic key rotation always remains separate external review',()=>{
 const r=Decision.rotation({...rotation(),roots});
 assert.equal(r.status,'rotation-ready-for-separate-operator-review');assertNoPrivilege(r);
});
test('revocation rollback in signed proposal invalidates key rotation',()=>{
 const x=rotation();x.proposal.revokedKeyIds=[];
 assert.equal(Decision.rotation({...x,roots}).status,'blocked-rotation');
});
test('signed key fingerprint and proposal drift are rejected',()=>{
 const x=rotation();x.witness.payload.proposedPolicyDigest=H;
 assert.equal(Decision.rotation({...x,roots}).status,'blocked-rotation-witness');
});
function release(){
 const source={status:'original-ci-bytes-ready-for-independent-review',
  originalSourceSha:LOCK.sourceSha,offlineZipSha256:LOCK.offlineZipSha256};
 const physical={status:'ready-for-independent-original-physical-review',physicalCases:18};
 const replay={status:'ready-for-external-ledger-review',ledgerHead:H,challenge:'1'.repeat(32)};
 const rotationReview={status:'rotation-ready-for-separate-operator-review'};
 const a12={format:'GomokuAnalysis3A12Preflight',sourceSha:LOCK.sourceSha,
  status:'manual-review-only',canDeployProduction:false,canMerge:false,canTag:false};
 const payload={state:'review-proposed-only',sourceSha:LOCK.sourceSha,
  a12HeadSha:'e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07',a15HeadSha:A15HEAD,
  originalZipSha256:LOCK.offlineZipSha256,challenge:replay.challenge,ledgerHead:replay.ledgerHead,
  physicalCases:18,productionOrigin:originalOrigin};
 const decision=signed('release-decision',payload,['independent-evidence-reviewer','release-owner']);
 return {source,physical,replay,rotationReview,a12,decision,roots};
}
test('complete wholly synthetic pre-cutover owner signatures grant no deploy',()=>{
 const x=release(),r=Decision.releaseDecision(x);
 assert.equal(r.status,'ready-for-separate-human-release-decision');assertNoPrivilege(r);
});
test('unqualified physical case count blocks pre-cutover owner review',()=>{
 const x=release();x.physical.physicalCases=17;
 assert.equal(Decision.releaseDecision(x).status,'blocked-physical');
});
test('owner signature tamper blocks pre-cutover review',()=>{
 const x=release();x.decision.signatures[1].signature='Z'+x.decision.signatures[1].signature.slice(1);
 assert.equal(Decision.releaseDecision(x).status,'blocked-signature');
});
test('unreviewed owner root blocks even apparently valid signed proposal',()=>{
 const x=release();x.roots=require('./a16-witness-roots.json');
 assert.equal(Decision.releaseDecision(x).status,'blocked-trust');
});
function closure(){
 const release={status:'ready-for-separate-human-release-decision'};
 const cutover={format:'GomokuAnalysis3A13ExecutedCutover',
  status:'completed-production-cutover',sourceSha:LOCK.sourceSha,
  productionDataMigration:'none',rollbackAvailable:true,
  deployedAt:'2026-10-09T09:00:00Z',deploymentId,
  productionCommitSha:commit,productionOrigin:originalOrigin};
 const stability={format:'GomokuAnalysis3A13StabilityReview',
  status:'ready-for-manual-stability-review',sourceSha:LOCK.sourceSha,
  canCloseRelease:false,hoursObserved:24};
 const independentLedger={status:'ready-for-external-ledger-review',ledgerHead:H};
 const payload={state:'closure-review-only',sourceSha:LOCK.sourceSha,
  ledgerHead:independentLedger.ledgerHead,deploymentId,productionCommitSha:commit,
  stabilityHours:24,productionOrigin:originalOrigin,reviewedAt:'2026-10-10T10:00:00Z'};
 const ownerClosure=signed('operational-closure',payload,
  ['independent-evidence-reviewer','release-owner']);
 return {release,cutover,stability,independentLedger,ownerClosure,roots};
}
test('fully synthetic postrelease closure review is separately denied authority',()=>{
 const r=Decision.operationalClosure(closure());
 assert.equal(r.status,'ready-for-separate-human-operational-closure');assertNoPrivilege(r);
});
test('postrelease closure rejects 23 hour purported observation',()=>{
 const x=closure();x.stability.hoursObserved=23;
 assert.equal(Decision.operationalClosure(x).status,'blocked-stability');
});
test('postrelease closure blocks unrelated deployment identity',()=>{
 const x=closure();x.cutover.deploymentId='DIFFERENT';
 assert.equal(Decision.operationalClosure(x).status,'blocked-closure-owner');
});
test('postrelease closure rejects unconsumed independent challenge',()=>{
 const x=closure();x.independentLedger={status:'missing'};
 assert.equal(Decision.operationalClosure(x).status,'blocked-replay');
});
test('revoked independent reviewer prevents even synthetically complete closure',()=>{
 const x=closure();x.roots={...roots,revokedKeyIds:[roots.keys[1].id]};
 assert.equal(Decision.operationalClosure(x).status,'blocked-trust');
});
console.log(n+' A16 synthetic owner/independent-replay trust/key-rotation/separate closure tests passed. No legitimate signers, real production, human decisions or device results.');
