'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('sw.js','utf8'),listeners={};
const CACHE=script.match(/const CACHE_NAME = '([^']+)'/)[1],base='https://thiepn.dev/gomoku/';
const data=new Map(),opened=[],removed=[];let online=true,networkCalls=[];
const cache={
 addAll:async paths=>{for(const p of paths){const url=new URL(p,base).href;data.set(url,new ResponseStub('INSTALL:'+p,{url}));}},
 match:async path=>data.get(typeof path==='string'?path:path.url)||null,
 put:async(path,response)=>data.set(typeof path==='string'?path:path.url,response)
};
const caches={
 open:async name=>{opened.push(name);return cache;},
 keys:async()=>[CACHE,'gomoku-old-safe','other-app-cache'],
 delete:async name=>{removed.push(name);return true;}
};
class ResponseStub{
 constructor(body,{url=base+'index.html',ok=true,type='text/html'}={}){
  this.body=body;this.url=url;this.ok=ok;this.headers={get:k=>k==='content-type'?type:null};
 }
 clone(){return new ResponseStub(this.body,{url:this.url,ok:this.ok,type:this.headers.get('content-type')});}
 static error(){return new ResponseStub('NETWORK ERROR',{ok:false,type:''});}
}
const self={location:{href:base+'sw.js'},addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting(){self.skip=true;},clients:{claim:async()=>{self.claimed=true;}}};
const sandbox={self,caches,URL,Response:ResponseStub,AbortController,setTimeout,clearTimeout,
 fetch:async (req,opts)=>{networkCalls.push({url:req.url,opts});if(!online)throw Error('offline');return new ResponseStub('ONLINE',{url:req.url});},
 console};
vm.runInNewContext(script,sandbox,{timeout:1000});
let n=0;
async function test(name,fn){await fn();console.log('PASS '+name);n++;}
const event=(url,mode='navigate',method='GET')=>{let promise=null;const e={request:{url,mode,method},
 respondWith:v=>{promise=v;}};listeners.fetch(e);return {promise};};
(async()=>{
 await test('A6 offline install caches only approved scoped game assets',async()=>{
  let p;listeners.install({waitUntil:q=>p=q});await p;
  assert.equal(data.has(base+'index.html'),true);
  assert.equal(data.has(base+'icons/icon-192.png'),true);
  assert.equal(data.has('https://thiepn.dev/room/index.html'),false);
 });
 await test('A6 existing other app caches survive activation',async()=>{
  let p;listeners.activate({waitUntil:q=>p=q});await p;
  assert.deepEqual(removed,['gomoku-old-safe']);assert.equal(self.claimed,true);
 });
 await test('A6 online navigation refreshes only the canonical scoped shell',async()=>{
  const r=await event(base+'?q=1').promise;assert.equal(r.body,'ONLINE');
  assert.equal(data.get(base+'index.html').body,'ONLINE');
  assert.equal(networkCalls.at(-1).opts.cache,'no-store');
 });
 await test('A6 offline navigation reuses last-known-good shell',async()=>{
  online=false;
  const r=await event(base+'index.html?offline=1').promise;
  assert.equal(r.body,'ONLINE');online=true;
 });
 await test('A6 json or opaque replacement cannot poison offline cache',async()=>{
  sandbox.fetch=async(req)=>new ResponseStub('NOT HTML',{url:req.url,type:'application/json'});
  const r=await event(base+'index.html').promise;
  assert.equal(r.body,'ONLINE');assert.equal(data.get(base+'index.html').body,'ONLINE');
 });
 await test('A6 cross-origin redirected response cannot replace scoped game',async()=>{
  sandbox.fetch=async()=>new ResponseStub('LOGIN',{url:'https://accounts.example/login'});
  await event(base+'index.html').promise;
  assert.equal(data.get(base+'index.html').body,'ONLINE');
 });
 await test('A6 sibling app navigation cannot be intercepted',async()=>{
  assert.equal(event('https://thiepn.dev/room/').promise,null);
  assert.equal(event('https://thiepn.dev/gomoku/an-unrelated-page').promise,null);
 });
 await test('A6 POST and other origin cannot be intercepted',async()=>{
  assert.equal(event(base+'index.html','navigate','POST').promise,null);
  assert.equal(event('https://example.com/gomoku/index.html').promise,null);
 });
 await test('A6 cache only serves explicit static assets',async()=>{
  const route=event(base+'private-api','cors');assert.equal(route.promise,null);
  const asset=await event(base+'icons/icon-192.png?cachebust=2','cors').promise;
  assert.ok(asset);
 });
 await test('A6 skip waiting and status message require deliberate message type',async()=>{
  let status=null;
  listeners.message({data:{type:'GOMOK_OFFLINE_STATUS'},source:{postMessage:p=>status=p}});
  assert.equal(status.type,'GOMOK_OFFLINE_STATUS');assert.equal(status.scopePath,'/gomoku/');
  listeners.message({data:{type:'SKIP_WAITING'}});assert.equal(self.skip,true);
 });
 console.log(n+' A6 service worker scope/offline tests passed');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
