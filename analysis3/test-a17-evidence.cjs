/* A17 CI: all operator identities, hosted responses and physical observations here are SYNTHETIC. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json'),A14=require('./a14-custody.cjs');
const Gate=require('./a17-operator-gate.cjs'),Preview=require('./a17-preview-collector.cjs');
const Physical=require('./a17-physical-worksheet.cjs'),Restore=require('./a17-isolated-restore.cjs');
const External=require('./a17-external-custody.cjs'),Desk=require('./a17-release-desk.cjs');
const Local=require('./a15-local-ledger.cjs');
const ROOT=path.resolve(__dirname,'..'),SITE=path.join(ROOT,'analysis17-test-output','preview-static');
const RECEIPT=JSON.parse(fs.readFileSync(path.join(ROOT,'.a17-input','analysis9-test-output','rc9-candidate.json'),'utf8'));
const NOW=new Date('2026-10-10T12:00:00.000Z'),origin='https://synthetic-a17-stage.vercel.app/';
const h=x=>crypto.createHash('sha256').update(x).digest('hex'),HEX='b'.repeat(64);
let n=0;function test(title,fn){return Promise.resolve().then(fn).then(()=>{n++;console.log('PASS '+title)})}
function scope(allowedOperations=Gate.OPERATIONS){
 return {format:'GomokuA17OperatorScope',version:17,repository:'thiepn/gomoku',
 originalSourceSha:LOCK.sourceSha,a16HeadSha:'bb868a84d24f622f8f5dcab64756c803228db8d0',
 allowedOperations:[...allowedOperations],operator:'SYNTHETIC OPERATOR',authorizedBy:'SYNTHETIC DISTINCT APPROVER',
 originalAuthorizationDigest:HEX,scopeRecordDigest:'c'.repeat(64),nonce:'d'.repeat(32),
 issuedAt:'2026-10-10T11:30:00.000Z',expiresAt:'2026-10-10T12:30:00.000Z',
 exactPreviewOrigin:origin};
}
const opts=(operation)=>({approval:scope(),approved:true,operation,now:NOW,
 targetOrigin:['preview-read','physical-draft'].includes(operation)?origin:undefined});
function fileBytes(p){return fs.readFileSync(path.join(SITE,p))}
function mocked({changePath='',status=200,redirect=false,size=0}={}){
 const calls=[];
 const fetchFn=async(url,options)=>{
  calls.push({url,options});
  const p=new URL(url).pathname.slice(1);
  const body=changePath===p?Buffer.from('MODIFIED WRONG ASSET'):fileBytes(p);
  return {status,redirected:redirect,url:redirect?'https://wrong.example/':url,
   headers:{get:k=>k==='content-length'?(size?String(size):String(body.length)):null},
   arrayBuffer:async()=>body};
 };
 return {fetchFn,calls};
}
function ledgerFixture(){
 const doc=Local.genesis(),at=Date.parse('2026-10-10T10:00:00Z'),challenge='9'.repeat(32);
 const first={seq:1,action:'issue',challenge,scopeDigest:HEX,deploymentId:'SYNTHETIC DEPLOYMENT',
  actor:'SYNTHETIC ISSUER',atMs:at,previous:doc.head,expiresAtMs:at+3600000};
 first.digest=A14.sha(first);doc.entries.push(first);doc.head=first.digest;
 const last={seq:2,action:'consume',challenge,scopeDigest:HEX,deploymentId:first.deploymentId,
  actor:'SYNTHETIC CONSUMER',atMs:at+300000,previous:doc.head,packetDigest:'e'.repeat(64)};
 last.digest=A14.sha(last);doc.entries.push(last);doc.head=last.digest;
 Local.validate(doc);
 return doc;
}
function receiptFixture(doc){
 const kinds=['external-ledger-custodian','independent-evidence-reviewer','release-owner'];
 const priv={},keys=kinds.map((role,i)=>{
  const pair=crypto.generateKeyPairSync('ed25519'),id='SYNTHETIC-'+i;
  priv[role]=pair.privateKey;
  return {id,person:'SYNTHETIC PERSON '+i,role,
   publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),
   spkiSha256:h(pair.publicKey.export({format:'der',type:'spki'}))};
 });
 const roots={format:'GomokuA16ExternalWitnessTrustRoots',version:16,repository:'thiepn/gomoku',
  a15HeadSha:'df2b958494460d650574351472770458e5ab5f62',keys,revokedKeyIds:[]};
 const [first,last]=doc.entries;
 const payload={externalReceiptDigest:'1'.repeat(64),externalRootDigest:'2'.repeat(64),
  localLedgerDigest:A14.sha(doc),localLedgerHead:doc.head,originalSourceSha:LOCK.sourceSha,
  challenge:last.challenge,packetDigest:last.packetDigest,deploymentId:last.deploymentId};
 const envelope={format:'GomokuA16SignedEvidenceEnvelope',version:16,kind:'replay-ledger',
  repository:'thiepn/gomoku',sourceSha:LOCK.sourceSha,
  a15HeadSha:'df2b958494460d650574351472770458e5ab5f62',
  productionCommitSha:'f'.repeat(40),deploymentId:last.deploymentId,
  evidenceDigest:A14.sha(payload),payload};
 const signatures=kinds.slice(0,2).map(role=>{
  const key=keys.find(x=>x.role===role);
  return {role,keyId:key.id,signer:key.person,
   signature:crypto.sign(null,Buffer.from(A14.canonical(envelope)),priv[role]).toString('base64')};
 });
 const independent={format:'GomokuA17IndependentCustodySnapshot',version:17,
  repository:'thiepn/gomoku',originalSourceSha:LOCK.sourceSha,
  a16HeadSha:'bb868a84d24f622f8f5dcab64756c803228db8d0',
  localLedgerDigest:A14.sha(doc),localLedgerHead:doc.head,
  externalRootDigest:payload.externalRootDigest,externalReceiptDigest:payload.externalReceiptDigest,
  disposition:'append-only-custody-claimed',privatePlayerDataIncluded:false,
  sequence:2,observedAt:'2026-10-10T10:05:00Z',receipts:[
   {action:'issue',challenge:first.challenge,digest:first.digest,sequence:1,remoteTimestamp:'2026-10-10T10:00:00Z'},
   {action:'consume',challenge:last.challenge,digest:last.digest,sequence:2,remoteTimestamp:'2026-10-10T10:05:00Z'}],
  witness:{...envelope,signatures}};
 return {local:doc,independent,roots};
}
async function main(){
 const bad=()=>Gate.validate({operation:'preview-read',targetOrigin:origin,approval:scope(),now:NOW});
 await test('no explicit opt-in rejects preview before any network',()=>assert.equal(bad().status,'blocked-permission'));
 await test('production origin rejected even with synthetic permission',()=>{
  assert.equal(Gate.validate({...opts('preview-read'),targetOrigin:'https://gomoku.thiepn.dev/'}).status,'blocked-origin');
 });
 await test('wrong source and scope digest are refused',()=>{
  const a=scope();a.originalSourceSha='f'.repeat(40);
  assert.equal(Gate.validate({approval:a,approved:true,operation:'preview-read',targetOrigin:origin,now:NOW}).status,'blocked-scope');
 });
 await test('expired scope cannot authorize collection',()=>{
  const a=scope();a.expiresAt='2026-10-10T11:45:00Z';
  assert.equal(Gate.validate({approval:a,approved:true,operation:'preview-read',targetOrigin:origin,now:NOW}).status,'blocked-time');
 });
 await test('no fetch on unapproved scope',async()=>{
  const f=mocked();const r=await Preview.collect({approval:scope(),approved:false,origin,
   candidate:RECEIPT,clock:()=>NOW,fetchFn:f.fetchFn});
  assert.equal(r.status,'blocked-permission');assert.equal(f.calls.length,0);
 });
 await test('eight REAL A9 file bytes accepted only as mock HTTPS and unsigned',async()=>{
  const f=mocked();const r=await Preview.collect({approval:scope(),approved:true,origin,
   candidate:RECEIPT,clock:()=>NOW,fetchFn:f.fetchFn});
  assert.equal(r.status,'preview-bytes-observed-unsigned');assert.equal(r.assets.length,8);
  assert.equal(f.calls.length,8);
  assert.equal(r.actualHostedAccepted,false);
  for(const c of f.calls){
   assert.equal(c.options.method,'GET');assert.equal(c.options.redirect,'manual');
   assert.equal(c.options.credentials,'omit');assert(c.url.startsWith(origin));
  }
 });
 await test('redirects fail closed',async()=>{
  const r=await Preview.collect({approval:scope(),approved:true,origin,
   candidate:RECEIPT,clock:()=>NOW,fetchFn:mocked({redirect:true}).fetchFn});
  assert.equal(r.status,'blocked-preview-capture');
 });
 await test('real A9 byte mismatch rejected',async()=>{
  const r=await Preview.collect({approval:scope(),approved:true,origin,
   candidate:RECEIPT,clock:()=>NOW,fetchFn:mocked({changePath:'sw.js'}).fetchFn});
  assert.equal(r.status,'blocked-preview-capture');
 });
 await test('unbounded reported content length refused',async()=>{
  const r=await Preview.collect({approval:scope(),approved:true,origin,
   candidate:RECEIPT,clock:()=>NOW,fetchFn:mocked({size:20*1024*1024}).fetchFn});
  assert.equal(r.status,'blocked-preview-capture');
 });
 await test('all 18 physical real-device cases initialize as not tested',()=>{
  const w=Physical.empty({origin});
  assert.equal(Physical.count(w).notTested,18);assert.equal(Physical.count(w).pending,0);
  assert.equal(Physical.summary(w).status,'awaiting-independent-physical-review');
 });
 let edited;
 await test('physically witnessed CASE DRAFT requires original evidence hash, never acceptance',()=>{
  const worksheet=Physical.empty({origin});
  const r=Physical.record({worksheet,platform:'android-chrome',caseId:'fresh-launch',
   observation:'SYNTHETIC observation. No Android phone was actually touched.',
   originalEvidenceDigest:HEX,observedAt:'2026-10-10T11:35:00Z',
   device:'SYNTHETIC PHONE',osVersion:'synthetic 15',browserVersion:'synthetic Chrome',
   operator:'SYNTHETIC OPERATOR',approval:scope(),approved:true,clock:()=>NOW});
  assert.equal(r.status,'draft-observation-recorded');edited=r.worksheet;
  assert.equal(r.counts.pending,1);assert.equal(r.counts.accepted,0);
  assert.equal(edited.physicalAcceptance,'OPEN');
 });
 await test('duplicate physical result and device switch rejected',()=>{
  const kw={worksheet:edited,platform:'android-chrome',caseId:'fresh-launch',
   observation:'SYNTHETIC observation. No Android phone was actually touched.',
   originalEvidenceDigest:HEX,observedAt:'2026-10-10T11:35:00Z',
   device:'SYNTHETIC PHONE',osVersion:'synthetic 15',browserVersion:'synthetic Chrome',
   operator:'SYNTHETIC OPERATOR',approval:scope(),approved:true,clock:()=>NOW};
  assert.equal(Physical.record(kw).status,'blocked-duplicate');
  assert.equal(Physical.record({...kw,caseId:'rules-renju',device:'DIFFERENT'}).status,'blocked-device-switch');
 });
 await test('no physical case can be accepted through unapproved report',()=>{
  assert.equal(Physical.summary(edited).physicalAcceptance,'OPEN');
  assert.equal(Physical.summary(edited).counts.accepted,0);
 });
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gomoku-a17-synthetic-'));
 try{
  const workspace=path.join(dir,'isolated-workspace'),previous=path.join(dir,'previous-stable');
  fs.mkdirSync(workspace);fs.mkdirSync(previous);
  const previousHashes={};
  for(const p of A9.ASSETS){
   const file=path.join(previous,p);fs.mkdirSync(path.dirname(file),{recursive:true});
   const b=Buffer.from('SYNTHETIC previous stable byte '+p);fs.writeFileSync(file,b);
   previousHashes[p]=h(b);
  }
  const args={approval:scope(),approved:true,workspace,originalRoot:SITE,
   originalHashes:RECEIPT.assets,previousRoot:previous,previousHashes,
   previousStableArchiveSha256:'d'.repeat(64),
   syntheticRecord:'SYNTHETIC:fake-saved-game-data-never-a-real-player-record',clock:()=>NOW};
  await test('isolated eight-file image transition then previous stable restore and record preservation',()=>{
   const r=Restore.rehearse(args);
   assert.equal(r.status,'isolated-restore-rehearsed-only',r.reason);
   assert.equal(r.realRollbackAccepted,false);assert.equal(r.syntheticRecordPreserved,true);
   assert.equal(fs.readdirSync(workspace).length,0);
  });
  await test('rehearsal with unapproved operator scope leaves workspace empty',()=>{
   assert.equal(Restore.rehearse({...args,approved:false}).status,'blocked-permission');
   assert.equal(fs.readdirSync(workspace).length,0);
  });
  await test('previous stable archive cannot be original A9 package',()=>{
   assert.equal(Restore.rehearse({...args,previousStableArchiveSha256:LOCK.offlineZipSha256}).status,'blocked-previous-stable');
  });
  await test('real player data blocked instead of being copied',()=>{
   assert.equal(Restore.rehearse({...args,syntheticRecord:'PRIVATE RECORD DATA'}).status,'blocked-data');
  });
  await test('wrong previous stable byte hashes never cause writes',()=>{
   const hashes={...previousHashes,'sw.js':'f'.repeat(64)};
   assert.equal(Restore.rehearse({...args,previousHashes:hashes}).status,'blocked-isolated-rehearsal');
   assert.equal(fs.readdirSync(workspace).length,0);
  });
  await test('symlinked previous stable source is refused',()=>{
   const link=path.join(dir,'symlink-to-previous');fs.symlinkSync(previous,link);
   assert.equal(Restore.rehearse({...args,previousRoot:link}).status,'blocked-isolated-rehearsal');
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 await test('no provisioned independent witness keys blocks external custody claims',()=>{
  const f=receiptFixture(ledgerFixture());const r=External.review({
   ...f,roots:require('./a16-witness-roots.json'),approval:scope(),approved:true,clock:()=>NOW});
  assert.equal(r.status,'blocked-external-signature');
 });
 await test('two synthetic independent signatures only make documentary external custody',()=>{
  const f=receiptFixture(ledgerFixture());const r=External.review({
   ...f,approval:scope(),approved:true,clock:()=>NOW});
  assert.equal(r.status,'independent-custody-documents-ready-for-human-review',r.reason);
  assert.equal(r.replayConsumptionIndependentlyCertified,false);
 });
 await test('externally reported ledger digest mismatch blocks custody',()=>{
  const f=receiptFixture(ledgerFixture());f.independent.localLedgerDigest='f'.repeat(64);
  assert.equal(External.review({...f,approval:scope(),approved:true,clock:()=>NOW}).status,'blocked-external-custody');
 });
 await test('replay provider wrong consumption order blocks custody',()=>{
  const f=receiptFixture(ledgerFixture());f.independent.receipts.reverse();
  assert.equal(External.review({...f,approval:scope(),approved:true,clock:()=>NOW}).status,'blocked-chronology');
 });
 await test('no staged evidence implies owner governed release HOLD',()=>{
  const r=Desk.readiness();assert.equal(r.readiness,'HOLD');
  assert.equal(r.status,'human-approval-and-production-operation-open');
  for(const gate of r.gates)assert.equal(gate.status,'blocked');
  assert.equal(r.canDeploy,false);assert.equal(r.canCloseRelease,false);
 });
 console.log(n+' A17 adversarial source/host/physical/restore/custody/owner tests passed; ALL identities/evidence except original A9 CI bytes are synthetic.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
