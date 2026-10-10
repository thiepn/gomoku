'use strict';
/* All keys, signers, approvals and evidence below are SYNTHETIC fixtures only. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const A=require('./a14-custody.cjs');
const LOCK=require('./a10-source-lock.json');
const H='a'.repeat(64),source=LOCK.sourceSha;
const A12='e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07';
const A13='0801c96d9317c625646eb20bf69ffecbd4f731f9';
const challenge='1'.repeat(32),deployment='SYNTHETIC-NOT-A-LIVE-DEPLOYMENT',commit='d'.repeat(40);
const origin='https://gomoku.thiepn.dev/',clock=new Date('2026-10-09T10:00:00.000Z');
const issueTimes=['2026-10-06T00:00:00.000Z','2026-10-07T02:00:00.000Z','2026-10-07T04:00:00.000Z'];
const expiry='2026-10-12T00:00:00.000Z';
const fixtureRoles=A.roles;
function make(){
 const privateKeys={};
 const keys=fixtureRoles.map((role,i)=>{
  const pair=crypto.generateKeyPairSync('ed25519');
  const id='SYNTHETIC-TEST-KEY-'+i;
  privateKeys[id]=pair.privateKey;
  const spki=pair.publicKey.export({format:'der',type:'spki'});
  return {id,role,person:'SYNTHETIC PERSON '+i,
   publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
   spkiSha256:crypto.createHash('sha256').update(spki).digest('hex'),revoked:false};
 });
 const policy={format:'GomokuA14PinnedTrustRoots',version:1,repository:'thiepn/gomoku',
  a12HeadSha:A12,a13HeadSha:A13,keys,revokedKeyIds:[]};
 const evidence={
  cutover:{format:'GomokuAnalysis3A13ExecutedCutover',status:'completed-production-cutover',
   sourceSha:source,productionCommitSha:commit,productionOrigin:origin,deploymentId:deployment,
   signerNote:'SYNTHETIC TEST, NEVER VERIFIED'},
  stability:{format:'GomokuAnalysis3A13StabilityReview',
   status:'ready-for-manual-stability-review',sourceSha:source,hoursObserved:24,
   canCertifyStable:false,canDeployProduction:false},
  handoff:{format:'GomokuAnalysis3A13OperationalHandoff',
   status:'accepted-by-owner-for-independent-review',deploymentId:deployment}
 };
 const packet={format:'GomokuA14CustodyPacket',version:14,repository:'thiepn/gomoku',
   sourceSha:source,a12HeadSha:A12,a13HeadSha:A13,productionCommitSha:commit,
   deploymentId:deployment,productionOrigin:origin,challenge,evidence,records:[]};
 function sign(){
  packet.records=[];
  for(let i=0;i<3;i++){
   const kind=A.stages[i],k=keys[i],prev=packet.records[i-1]||null;
   const record={format:'GomokuA14SignedRecord',kind,sequence:i+1,role:k.role,
    keyId:k.id,signer:k.person,nonce:String(i+2).repeat(32),challenge,
    previousDigest:prev?A.sha(prev):null,issuedAt:issueTimes[i],expiresAt:expiry,
    repository:'thiepn/gomoku',sourceSha:source,a12HeadSha:A12,a13HeadSha:A13,
    productionCommitSha:commit,deploymentId:deployment,productionOrigin:origin,
    evidenceSha256:A.sha(evidence[kind])};
   const signature=crypto.sign(null,Buffer.from(A.canonical(record)),privateKeys[k.id]);
   record.signature=signature.toString('base64');
   packet.records.push(record);
  }
 }
 sign();
 return {packet,policy,sign,keys,privateKeys};
}
let n=0;
function test(title,mutate,expected){
 const x=make();if(mutate)mutate(x);
 const r=A.verify({packet:x.packet,policy:x.policy,now:clock});
 assert.equal(r.status,expected,title+': '+r.reason);
 for(const key of ['canMerge','canTag','canDeploy','canCertifyStable','canCloseRelease','canModifyProductionData'])
  assert.equal(r[key],false,title);
 n++;console.log('PASS '+title);
}
const ready='ready-for-independent-ledger-and-originals-review';
test('three entirely synthetic signatures only reach manual originals review',null,ready);
test('default repository trust roots are empty; no live trust granted',x=>x.policy=require('./a14-trust-roots.json'),'blocked-trust-root');
test('missing trust key',x=>x.policy.keys.pop(),'blocked-trust-root');
test('wrong fingerprint',x=>x.policy.keys[1].spkiSha256=H,'blocked-trust-root');
test('revoked role key',x=>x.policy.revokedKeyIds.push(x.keys[1].id),'blocked-revocation');
test('signer role reused',x=>x.policy.keys[2].role='release-operator','blocked-revocation');
test('same person cannot self approve',x=>x.policy.keys[2].person=x.policy.keys[0].person,'blocked-revocation');
test('operator signature tamper',x=>{const sig=x.packet.records[0].signature;x.packet.records[0].signature=(sig[0]==='A'?'B':'A')+sig.slice(1)},'blocked-signature');
test('source SHA changed',x=>x.packet.sourceSha='e'.repeat(40),'blocked-scope');
test('A12 head drift',x=>x.packet.a12HeadSha='e'.repeat(40),'blocked-scope');
test('A13 head drift',x=>x.packet.a13HeadSha='e'.repeat(40),'blocked-scope');
test('wrong production host denied',x=>x.packet.productionOrigin='https://127.0.0.1/','blocked-scope');
test('wrong deployment commit',x=>x.packet.productionCommitSha='!','blocked-scope');
test('unknown challenge',x=>x.packet.challenge='f'.repeat(32),'blocked-chain');
test('duplicate nonce',x=>x.packet.records[1].nonce=x.packet.records[0].nonce,'blocked-chain');
test('out-of-order custody sequence',x=>x.packet.records[1].sequence=3,'blocked-chain');
test('removed evidence link',x=>x.packet.records[2].previousDigest=null,'blocked-chain');
test('evidence silently changed',x=>x.packet.evidence.stability.hoursObserved=25,'blocked-evidence');
test('wrong source bound in signature',x=>x.packet.records[1].sourceSha='e'.repeat(40),'blocked-evidence');
test('invalid signature encoding',x=>x.packet.records[0].signature='not-base64','blocked-signature');
test('expired custody signature',x=>x.packet.records[2].expiresAt='2026-10-08T00:00:00.000Z','blocked-time');
test('future-issued custody signature',x=>x.packet.records[2].issuedAt='2027-01-01T00:00:00.000Z','blocked-time');
test('fully signed early stability witness under 24h',x=>{const saved=issueTimes[1];issueTimes[1]='2026-10-06T01:00:00.000Z';x.sign();issueTimes[1]=saved},'blocked-time');
test('incomplete A13 stability 23 hours even when signatures re-created',x=>{x.packet.evidence.stability.hoursObserved=23;x.sign()},'blocked-evidence');
test('wrong A13 status when re-signed',x=>{x.packet.evidence.stability.status='released';x.sign()},'blocked-evidence');
test('duplicate public key ID',x=>x.policy.keys[2].id=x.policy.keys[1].id,'blocked-trust-root');
test('untrusted signer key substituted',x=>{const t=crypto.generateKeyPairSync('ed25519');x.policy.keys[0].publicKeyPem=t.publicKey.export({format:'pem',type:'spki'})},'blocked-trust-root');
test('unknown supporting evidence stage',x=>x.packet.evidence.extra={status:'PASSED'},'blocked-scope');
test('source production target disallows localhost',x=>x.packet.productionOrigin='http://localhost:3000/','blocked-scope');
const x=make();
const replay=A.verify({packet:x.packet,policy:x.policy,now:clock,usedChallenges:[challenge]});
assert.equal(replay.status,'blocked-replay');n++;console.log('PASS operator ledger marks a challenge already seen');
assert.throws(()=>A.canonical({a:Infinity}),/Only plain canonical JSON/);
assert.throws(()=>A.canonical({constructor:'oops'}),/Unsafe JSON/);
const rekey=make();const fresh=A.verify({packet:rekey.packet,policy:rekey.policy,now:clock,usedChallenges:['f'.repeat(32)]});
assert.equal(fresh.status,ready);
console.log(n+' A14 synthetic crypto/revocation/replay/scope tests passed. NO actual human keys or approvals.');
