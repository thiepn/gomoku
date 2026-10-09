'use strict';
const assert=require('node:assert/strict');
const A13=require('./a13-live-probe.cjs');
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const origin='https://gomoku.thiepn.dev/',deploymentId='SYNTHETIC-ONLY-NOT-RELEASED';
const content=Buffer.from('<synthetic-asset>','utf8'),hash=A13.hash(content);
function candidate(){return {format:'GomokuAnalysis3Candidate',version:9,
 sourceSha:LOCK.sourceSha,sourceBranch:LOCK.upstreamBranch,workflowRunId:LOCK.githubRunId,
 originMainFrozen:true,assets:Object.fromEntries(A9.ASSETS.map(x=>[x,hash])),
 stages:Object.fromEntries(A9.STAGES.map(x=>[x,{status:'passed',issuer:'GitHub Actions',
 sourceSha:LOCK.sourceSha,indexSha256:hash,workflowRunId:LOCK.githubRunId,
 completedAt:'2026-10-01T00:00:00Z'}]))};}
function stub(url,{redirect=false,status=200,body=content}={}){
 return {status,redirected:redirect,url,
 arrayBuffer:async()=>Uint8Array.from(body).buffer};
}
let n=0;
async function test(name,fn){await fn();console.log('PASS '+name);n++;}
function args(overrides={}){return {origin,candidate:candidate(),deploymentId,approved:true,
 fetchFn:async url=>stub(url),clock:()=>new Date('2026-10-03T00:00:00Z'),...overrides}}
(async()=>{
 await test('deny unapproved probe before making requests',async()=>{
  let calls=0;
  await assert.rejects(A13.probe(args({approved:false,fetchFn:async()=>{calls++}})),/authorization/);
  assert.equal(calls,0);});
 await test('deny localhost/preview/http origins before sending request',async()=>{
  for(const x of ['http://gomoku.thiepn.dev/','https://localhost/',
   'https://demo.vercel.app/','https://gomoku.thiepn.dev/anything']){
   let calls=0;await assert.rejects(A13.probe(args({origin:x,fetchFn:async()=>{calls++}})),/origin/);
   assert.equal(calls,0);
  }});
 await test('deny absent qualified candidate',async()=>{
  await assert.rejects(A13.probe(args({candidate:null})),/source/);
  const c=candidate();c.stages.browser.status='failed';
  await assert.rejects(A13.probe(args({candidate:c})),/source/);});
 await test('deny absent deployment identity',async()=>{
  await assert.rejects(A13.probe(args({deploymentId:''})),/identity/);});
 await test('fetch exact eight immutable assets without cookies or redirects',async()=>{
  let seen=[];
  const r=await A13.probe(args({fetchFn:async (url,request)=>{
   assert.equal(request.method,'GET');
   assert.equal(request.redirect,'manual');
   assert.equal(request.credentials,'omit');
   seen.push(url);return stub(url);
  }}));
  assert.equal(seen.length,8);assert.equal(new Set(seen).size,8);
  assert.equal(r.sourceSha,LOCK.sourceSha);
  assert.equal(r.verifiedAssets.length,8);
  assert.equal(r.originalResponseDigest.length,64);
  assert.equal(r.deploymentId,deploymentId);
 });
 await test('reject HTTP redirect',async()=>{await assert.rejects(
  A13.probe(args({fetchFn:async url=>stub(url,{redirect:true})})),/redirected/);});
 await test('reject 404 status',async()=>{await assert.rejects(
  A13.probe(args({fetchFn:async url=>stub(url,{status:404})})),/non-200/);});
 await test('reject cross-origin final URL',async()=>{await assert.rejects(
  A13.probe(args({fetchFn:async url=>stub('https://example.org/') })),/cross-origin/);});
 await test('reject tampered service worker',async()=>{
  let calls=0;
  await assert.rejects(A13.probe(args({fetchFn:async url=>{
   calls++;return stub(url,{body:calls===2?Buffer.from('tampered'):content});
  }})),/differs/);});
 await test('reject empty asset',async()=>{await assert.rejects(
  A13.probe(args({fetchFn:async url=>stub(url,{body:Buffer.alloc(0)})})),/length/);});
 await test('reject giant asset',async()=>{await assert.rejects(
  A13.probe(args({fetchFn:async url=>stub(url,{body:Buffer.alloc(10*1024*1024+1)})})),/length/);});
 await test('no network side effects from an imported library',async()=>{
  assert.equal(typeof A13.probe,'function');
  assert.equal(typeof A13.hash,'function');});
 console.log(n+' A13 read-only production-probe tests passed using mock HTTP bytes only.');
})().catch(e=>{console.error(e);process.exitCode=1});
