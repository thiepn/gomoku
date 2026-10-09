'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const P=require('./runtime-policy.js');
const board=Array(225).fill(0),now=10000;
let tests=0;
async function test(name,fn){await fn();tests++;console.log('PASS '+name);}
class FakeWorker{
  static all=[];
  constructor(url){this.url=url;this.dead=false;this.sent=[];FakeWorker.all.push(this);}
  postMessage(pkt){if(this.dead)throw Error('worker dead');this.sent.push(pkt);}
  terminate(){this.dead=true;}
  reply(result){const pkt=this.sent.at(-1);if(!pkt)throw Error('no pending message');this.onmessage({data:{id:pkt.id,result}});}
  error(msg='worker broken'){this.onerror({message:msg,preventDefault(){}});}
}
const activeTimers=new Map();let timerId=0;
const window={navigator:{deviceMemory:2,hardwareConcurrency:2,connection:{saveData:false}},
  matchMedia:()=>({matches:true}),GomokuRuntimePolicy6:P,dispatchEvent(){}};
const sandbox={window,Worker:FakeWorker,
 URL:{createObjectURL:()=> 'blob:test-worker',revokeObjectURL:()=>{}},
 Blob:class {constructor(parts){this.parts=parts;}},
 DOMException,Error,Map,Set,Array,JSON,Date,Number,Boolean,Object,Promise,Event:class {},
 setTimeout:(fn,ms)=>{const id=++timerId;activeTimers.set(id,{fn,ms});return id;},
 clearTimeout:id=>activeTimers.delete(id),
 v5WorkerPrelude:()=>'',createGuidedReviewCore:()=>null,
 createAnalysis2:()=>null,createEngine:()=>null,createStudioCore:()=>null,
 createV5EngineFactory:()=>null,V5_WASM_BASE64:'',indexedDB:{}};
vm.runInNewContext(fs.readFileSync('analysis/runtime.js','utf8'),sandbox,{timeout:1000});
const R=window.GomokuAnalysisRuntime;
const original=JSON.stringify(board);
(async()=>{
 await test('A6 policy adapts only opt-in budgets on constrained devices',()=>{
   assert.equal(P.deviceClass({memoryGb:2,cores:2}),'constrained');
   assert.equal(P.admission({timeMs:2200},{memoryGb:2,cores:2}).appliedMs,2200);
   const out=P.admission({timeMs:2200,adaptiveBudget:true},{memoryGb:2,cores:2});
   assert.equal(out.appliedMs,650);assert.equal(out.capped,true);
 });
 await test('A6 request keys canonicalize context property order',()=>{
   const a=P.key(board,1,'freestyle',110,{context:{passes:0,moveCount:4},multiPV:3});
   const b=P.key(board,1,'freestyle',110,{multiPV:3,context:{moveCount:4,passes:0}});
   assert.equal(a,b);
 });
 await test('A6 request keys include side, variant, played move and board',()=>{
   const k=P.key(board,1,'freestyle',110,{timeMs:500});
   assert.notEqual(k,P.key(board,2,'freestyle',110,{timeMs:500}));
   assert.notEqual(k,P.key(board,1,'exact-five',110,{timeMs:500}));
   assert.notEqual(k,P.key(board,1,'freestyle',111,{timeMs:500}));
   const b=board.slice();b[0]=1;assert.notEqual(k,P.key(b,1,'freestyle',110,{timeMs:500}));
 });
 await test('A6 untrusted board data rejects without cancelling a valid request',async()=>{
   const p=R.request(board,1,'freestyle',110,{timeMs:350});
   await assert.rejects(R.request(Array(225).fill(9),1,'freestyle',110,{}));
   assert.equal(R.stats().busy,true);
   FakeWorker.all.at(-1).reply({label:'Best found'});
   assert.equal((await p).label,'Best found');
 });
 await test('A6 reuses worker after completed search',async()=>{
   const p=R.request(board,1,'freestyle',111,{timeMs:350});
   FakeWorker.all.at(-1).reply({label:'Good'});await p;
   assert.equal(R.stats().workersCreated,1);
 });
 await test('A6 identical inflight requests share one worker search',async()=>{
   const opts={timeMs:720,multiPV:3,context:{passes:0}};
   const a=R.request(board,1,'freestyle',112,opts),b=R.request(board,1,'freestyle',112,opts);
   assert.equal(FakeWorker.all.at(-1).sent.length,3); // two earlier searches plus one new
   assert.equal(R.stats().subscribers,2);
   FakeWorker.all.at(-1).reply({label:'Mistake',nested:{score:2}});
   const [x,y]=await Promise.all([a,b]);
   assert.equal(x.label,y.label);assert.equal(R.stats().coalescedRequests,1);
   x.nested.score=999;assert.equal(y.nested.score,2);
 });
 await test('A6 cached result is deep cloned on every hit',async()=>{
   const opts={timeMs:720,multiPV:3,context:{passes:0}};
   const a=await R.request(board,1,'freestyle',112,opts);
   assert.equal(a.cacheHit,true);a.nested.score=555;
   const b=await R.request(board,1,'freestyle',112,opts);
   assert.equal(b.nested.score,2);assert.equal(R.stats().cacheHits,2);
 });
 await test('A6 context change can never reuse stale evidence',async()=>{
   const p=R.request(board,1,'freestyle',112,{timeMs:720,multiPV:3,context:{passes:1}});
   assert.equal(R.stats().busy,true);
   FakeWorker.all.at(-1).reply({label:'Context-specific'});
   assert.equal((await p).label,'Context-specific');
 });
 await test('A6 aborting one subscriber does not cancel its peer',async()=>{
   const ac=new AbortController(),opts={timeMs:450,context:{passes:2}};
   const a=R.request(board,1,'freestyle',113,{...opts,signal:ac.signal});
   const b=R.request(board,1,'freestyle',113,opts);
   ac.abort();
   await assert.rejects(a,{name:'AbortError'});
   assert.equal(R.stats().busy,true);assert.equal(R.stats().subscribers,1);
   FakeWorker.all.at(-1).reply({label:'Works'});assert.equal((await b).label,'Works');
 });
 await test('A6 final subscriber abort terminates worker and rejects stale answers',async()=>{
   const ac=new AbortController();
   const a=R.request(board,2,'freestyle',114,{timeMs:500,signal:ac.signal});
   const old=FakeWorker.all.at(-1);ac.abort();
   await assert.rejects(a,{name:'AbortError'});
   assert.equal(old.dead,true);assert.equal(R.stats().busy,false);
   old.reply({label:'STALE'});
   assert.equal(R.stats().busy,false);
 });
 await test('A6 a superseding request rejects prior subscribers',async()=>{
   const a=R.request(board,2,'freestyle',115,{timeMs:500});
   const b=R.request(board,2,'freestyle',116,{timeMs:500});
   await assert.rejects(a,{name:'AbortError'});
   FakeWorker.all.at(-1).reply({label:'New'});assert.equal((await b).label,'New');
 });
 await test('A6 cache has bounded entry and serialized byte limits',()=>{
   let clock=5000;const C=new P.ResultCache({maxEntries:2,maxBytes:4096,ttlMs:2000,now:()=>clock});
   assert.equal(C.put('a',{r:1}),true);assert.equal(C.put('b',{r:2}),true);
   C.get('a');C.put('c',{r:3});assert.equal(C.get('b'),null);
   assert.deepEqual(C.get('a'),{r:1});assert.ok(C.stats().cacheBytes<=4096);
   assert.equal(C.put('big',{payload:'x'.repeat(5000)}),false);
   clock+=3000;assert.equal(C.get('a'),null);
 });
 await test('A6 verified proof-only work never contaminates position cache',async()=>{
   const a=R.request(board,1,'freestyle',117,{timeMs:500,verifyOnly:true,certificate:{proof:{move:110}}});
   FakeWorker.all.at(-1).reply({valid:false});await a;
   const b=R.request(board,1,'freestyle',117,{timeMs:500,verifyOnly:true,certificate:{proof:{move:110}}});
   assert.equal(R.stats().busy,true);FakeWorker.all.at(-1).reply({valid:false});await b;
 });
 await test('A6 foreground worker errors reject and safely rebuild worker',async()=>{
   const p=R.request(board,1,'freestyle',118,{timeMs:330});
   const old=FakeWorker.all.at(-1);old.error();
   await assert.rejects(p,/worker broken/);assert.equal(old.dead,true);
   const fresh=R.request(board,1,'freestyle',118,{timeMs:330});
   assert.notEqual(FakeWorker.all.at(-1),old);
   FakeWorker.all.at(-1).reply({label:'Recovered'});await fresh;
 });
 await test('A6 runtime releases worker but retains bounded cache',()=>{
   R.release();assert.equal(R.stats().busy,false);
   assert.equal(JSON.stringify(board),original);
   assert.ok(R.stats().cacheBytes<=R.stats().maxCacheBytes);
 });
 console.log(tests+' A6 runtime and policy contracts passed');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
