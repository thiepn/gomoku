'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const E=require('./a15-public-evidence.cjs'),P=require('./a15-evidence-pins.json');
const Ledger=require('./a15-local-ledger.cjs'),Operator=require('./a15-operator-closure.cjs');
const A14=require('./a14-custody.cjs'),LOCK=require('./a10-source-lock.json');
let n=0;function pass(s){n++;console.log('PASS '+s);}
const manifest=P;
function mocks({failRun,failArtifact,alterRun,alterArtifact}={}){
 const calls=[];
 const fetchFn=async(url,opts)=>{
  calls.push(url);
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');assert.equal(opts.credentials,'omit');
  const id=Number(url.split('/').pop()),isRun=url.includes('/runs/');
  let payload;
  if(isRun){
   const p=[{id:P.a9RunId,sha:P.a9SourceSha},...P.requiredRuns].find(y=>y.id===id);
   assert(p,'Only pinned run fetched');
   payload={id,head_sha:p.sha,status:'completed',conclusion:'success',run_attempt:1,
    event:id===P.a9RunId?'push':'pull_request',repository:{full_name:'thiepn/gomoku'}};
   if(id===failRun)payload.conclusion='failure';
   if(id===alterRun)payload.head_sha='f'.repeat(40);
  }else{
   const p=[{...P.a9Artifact,runId:P.a9RunId},...P.additionalArtifacts].find(y=>y.id===id);
   assert(p,'Only pinned artifact fetched');
   payload={id,name:p.name,digest:p.digest,expired:false,size_in_bytes:4096,workflow_run:{id:p.runId}};
   if(id===failArtifact)payload.expired=true;
   if(id===alterArtifact)payload.digest='sha256:'+'f'.repeat(64);
  }
  return {status:200,url,redirected:false,text:async()=>JSON.stringify(payload)};
 };
 return {fetchFn,calls};
}
async function sourceTests(){
 assert.equal(E.pinsValid(P),true);pass('Pinned GitHub origins and immutable A9/A14 sources agree');
 const m=mocks();const complete=await E.readback({approved:true,fetchFn:m.fetchFn});
 assert.equal(complete.status,'ready-for-original-byte-and-independent-review');
 assert.equal(m.calls.length,10);assert.equal(complete.validatedRuns.length,7);
 assert.equal(complete.validatedArtifacts.length,3);
 assert(complete.canDeploy===false);pass('7 run and 3 artifact readbacks use public pinned resources only');
 const no=mocks();assert.equal((await E.readback({approved:false,fetchFn:no.fetchFn})).status,'blocked-permission');
 assert.equal(no.calls.length,0);pass('No public network calls without explicit opt-in');
 for(const [label,opt,status] of [
  ['failed exact-head check',{failRun:38035130920},'blocked-run'],
  ['branch head SHA mismatch',{alterRun:38035130942},'blocked-run'],
  ['expired original archive',{failArtifact:11612273760},'blocked-artifact'],
  ['wrong SHA256 of protected evidence archive',{alterArtifact:11664320609},'blocked-artifact']]){
  const f=mocks(opt);assert.equal((await E.readback({approved:true,fetchFn:f.fetchFn})).status,status);pass(label+' refused');
 }
 const drift=structuredClone(P);drift.a9SourceSha='1'.repeat(40);
 const disallow=mocks();assert.equal((await E.readback({approved:true,pins:drift,fetchFn:disallow.fetchFn})).status,'blocked-pins');
 assert.equal(disallow.calls.length,0);pass('Pinned A9 source drift blocks before networking');
 await assert.rejects(E.readJson('https://api.github.com/repos/elsewhere/repo/actions/runs/1',m.fetchFn),/only use explicitly pinned/);
 pass('Reject unscoped GitHub REST URLs');
 assert.equal(E.verifyOriginalOfflineZip(Buffer.from('not a zip')).status,'blocked-offline-zip');
 assert.equal(E.verifyOriginalOfflineZip(Buffer.from('PK\x03\x04but-wrong-content')).status,'blocked-offline-zip');
 pass('Original offline ZIP byte mismatch remains strictly blocked');
}
function ledgerTests(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gomoku-a15-synthetic-'));
 const scope='9'.repeat(64),id='SYNTHETIC-DEPLOYMENT',actor='SYNTHETIC-TEST-OPERATOR',base=Date.parse('2026-10-10T07:00:00Z');
 const a={directory,approved:true,actor,deploymentId:id,scopeDigest:scope,nowMs:base};
 try{
  assert.equal(Ledger.transact({...a,approved:false,action:'issue'}).status,'blocked-permission');
  assert.equal(fs.readdirSync(directory).length,0);pass('Unapproved local ledger leaves filesystem unchanged');
  const first=Ledger.transact({...a,action:'issue',ttlMs:600000});
  assert.equal(first.status,'issued-local-challenge');assert.match(first.challenge,/^[0-9a-f]{32}$/);
  pass('Durable single-use challenge issued on isolated local filesystem');
  const started=Ledger.inspect(directory);assert.equal(started.status,'local-chain-valid-unanchored');
  assert.equal(started.issued,1);assert.equal(started.consumed,0);pass('Atomic fsync journal verifies chain');
  const consume={...a,action:'consume',challenge:first.challenge,packetDigest:'a'.repeat(64)};
  assert.equal(Ledger.transact({...consume,nowMs:base+1000,scopeDigest:'b'.repeat(64)}).status,'blocked-replay');
  pass('Replay claim cannot change pinned evidence scope');
  assert.equal(Ledger.transact({...consume,nowMs:base+600001}).status,'blocked-replay');
  pass('Challenge expires before replay consumption');
  assert.equal(Ledger.transact({...consume,nowMs:base+10}).status,'consumed-local-challenge');
  assert.equal(Ledger.transact({...consume,nowMs:base+11}).status,'blocked-replay');
  pass('Successful consume is durable and second consume denied');
  const end=Ledger.inspect(directory);assert.equal(end.count,2);assert.equal(end.consumed,1);
  pass('Committed issue/consume chain survives disk reread');
  const lock=path.join(directory,'.a15-replay-ledger.lock');fs.writeFileSync(lock,'SYNTHETIC LOCK');
  assert.equal(Ledger.transact({...a,action:'issue'}).status,'blocked-ledger');
  fs.unlinkSync(lock);pass('Concurrent filesystem lock denied without bypass');
  const docPath=path.join(directory,'a15-replay-ledger.json');
  const original=fs.readFileSync(docPath,'utf8'),mut=JSON.parse(original);
  mut.entries[0].actor='forged-reviewer';fs.writeFileSync(docPath,JSON.stringify(mut));
  assert.equal(Ledger.inspect(directory).status,'blocked-ledger');
  assert.equal(Ledger.transact({...a,action:'issue'}).status,'blocked-ledger');
  fs.writeFileSync(docPath,original);pass('Tampered replay journal is refused before append');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
function makeKey(role,id){
 const pair=crypto.generateKeyPairSync('ed25519');
 return {id,role,person:'SYNTHETIC PERSON '+id,
  publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
  spkiSha256:crypto.createHash('sha256').update(pair.publicKey.export({format:'der',type:'spki'})).digest('hex')};
}
function rotationTests(){
 assert.equal(Operator.rotation().status,'blocked-unprovisioned');
 pass('Real trust roots intentionally empty; production rotation impossible');
 const current={format:'GomokuA14PinnedTrustRoots',version:1,repository:'thiepn/gomoku',
  a12HeadSha:'e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07',
  a13HeadSha:'0801c96d9317c625646eb20bf69ffecbd4f731f9',
  keys:['owner','independent-reviewer','release-operator'].map((role,i)=>makeKey(role,'OLD-'+i)),
  revokedKeyIds:[]};
 const original=structuredClone(current),proposal={format:'GomokuA15TrustRotationProposal',version:15,
  sourceSha:LOCK.sourceSha,a14HeadSha:P.a14HeadSha,priorPolicyDigest:A14.sha(current),
  keys:[...current.keys],revokedKeyIds:[],changeEvidenceDigest:'3'.repeat(64)};
 proposal.keys[0]=makeKey('owner','NEW-OWNER');
 proposal.revokedKeyIds.push(original.keys[0].id);
 const review={format:'GomokuA15IndependentRotationReview',priorPolicyDigest:A14.sha(current),
  proposedPolicyDigest:A14.sha(proposal),originalsDigest:'6'.repeat(64),
  witnessReportDigest:'7'.repeat(64),owner:'SYNTHETIC OWNER',independentReviewer:'SYNTHETIC REVIEWER',
  reviewedAt:'2026-10-10T07:00:00Z',changeTicket:'SYNTHETIC ONLY'};
 const good=Operator.rotation({current,proposal,review});
 assert.equal(good.status,'ready-for-external-key-review');
 assert.equal(good.canApplyKeys,false);pass('Synthetic rotation produces manual review only, never edits trust roots');
 const p2=structuredClone(proposal);p2.revokedKeyIds=[];
 assert.equal(Operator.rotation({current,proposal:p2,review}).status,'blocked-review');
 pass('Rotation review cryptographically bound to exact proposed content');
 const p3=structuredClone(proposal);p3.keys[0].id=original.keys[0].id;
 assert.equal(Operator.rotation({current,proposal:p3,review}).status,'blocked-key-reuse');
 pass('Pinned historical key ID cannot be reassigned silently');
 const p4=structuredClone(proposal);p4.keys[1].publicKeyPem+='PRIVATE KEY';
 assert.equal(Operator.rotation({current,proposal:p4,review}).status,'blocked-roles');
 pass('Malformed/unreviewed public key material denied');
 const p5=structuredClone(proposal);p5.keys[1].person=p5.keys[0].person;
 assert.equal(Operator.rotation({current,proposal:p5,review}).status,'blocked-roles');
 pass('Distinct signing roles cannot share the same human identity');
}
function closureTests(){
 assert.equal(Operator.closure().status,'blocked-github');
 const github={status:'ready-for-original-byte-and-independent-review',a14HeadSha:P.a14HeadSha,
  validatedRuns:[P.a9RunId,...P.requiredRuns.map(x=>x.id)]};
 const offlineZip={status:'ready-for-independent-zip-review',offlineZipSha256:LOCK.offlineZipSha256};
 const ledger={status:'local-chain-valid-unanchored',head:'1'.repeat(64),consumed:1};
 const custody={status:'ready-for-independent-ledger-and-originals-review',chainDigest:'2'.repeat(64),
  replayLedgerNotIndependentlyAuthenticated:true};
 const stability={format:'GomokuAnalysis3A13StabilityReview',status:'ready-for-manual-stability-review',
  sourceSha:LOCK.sourceSha,hoursObserved:24,canCloseRelease:false};
 const external={format:'GomokuA15IndependentClosureReview',a14HeadSha:P.a14HeadSha,
  originalsDigest:'3'.repeat(64),externalReplayLedgerDigest:'4'.repeat(64),
  humanSignoffDigest:'5'.repeat(64),reviewedAt:'2026-10-10T08:00:00Z',
  owner:'SYNTHETIC OWNER',reviewer:'SYNTHETIC REVIEWER',originalEvidenceIndependentlyWitnessed:true};
 const p={github,offlineZip,ledger,custody,stability,external};
 const r=Operator.closure(p);assert.equal(r.status,'ready-for-separate-owner-closure-decision');
 for(const k of ['canMerge','canTag','canDeploy','canCloseRelease','canCertifyStable','canModifyProductionData'])
  assert.equal(r[k],false);
 pass('Complete SYNTHETIC closure packet can only reach separate owner decision');
 assert.equal(Operator.closure({...p,ledger:{...ledger,consumed:0}}).status,'blocked-ledger');
 pass('Replayed or never-consumed challenge stops closure');
 assert.equal(Operator.closure({...p,external:{...external,reviewer:external.owner}}).status,'blocked-independent-review');
 pass('Self-reviewed owner handoff stops closure');
 assert.equal(Operator.closure({...p,stability:{...stability,hoursObserved:23}}).status,'blocked-stability');
 pass('Early stability closure under 24 hours denied');
}
(async()=>{await sourceTests();ledgerTests();rotationTests();closureTests();
 console.log(n+' A15 adversarial tests passed. All witnesses, deployments, archives and keys except public A9/A14 pins are SYNTHETIC and NOT acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1});
