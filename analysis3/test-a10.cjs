'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),P=require('./a10-preview-integrity.cjs');
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='fca45816ed7d3a95bae550b9aa644e29053875f6';
const expected=()=>({sourceSha:source,offlineZipSha256:h('zip'),
 assets:Object.fromEntries(P.ASSETS.map(p=>[p,h(p)]))});
let n=0;async function test(name,run){await run();console.log('PASS '+name);n++;}
(async()=>{
 await test('A10 refuses production domain',async()=>assert.throws(()=>P.previewUrl('https://gomoku.thiepn.dev/'),/dedicated/));
 await test('A10 requires HTTPS for remote previews',async()=>assert.throws(()=>P.previewUrl('http://gomoku-a10-preview.vercel.app/'),/dedicated/));
 await test('A10 refuses unrelated HTTPS origin',async()=>assert.throws(()=>P.previewUrl('https://example.org/'),/dedicated/));
 await test('A10 refuses userinfo credentials in URL',async()=>assert.throws(()=>P.previewUrl('https://user:pass@gomoku-a10-preview.vercel.app/'),/clean/));
 await test('A10 refuses URL query-based bypass',async()=>assert.throws(()=>P.previewUrl('https://gomoku-a10-preview.vercel.app/?preview=true'),/clean/));
 await test('A10 refuses non-root scope',async()=>assert.throws(()=>P.previewUrl('https://gomoku-a10-preview.vercel.app/not-gomoku'),/clean/));
 await test('A10 accepts dedicated HTTPS candidate host',async()=>assert.equal(P.previewUrl('https://gomoku-a10-preview.vercel.app/').hostname,'gomoku-a10-preview.vercel.app'));
 await test('A10 permits localhost only in deliberate browser-test mode',async()=>{
   assert.throws(()=>P.previewUrl('http://127.0.0.1:8021/'),/dedicated/);
   assert.equal(P.previewUrl('http://127.0.0.1:8021/',{allowLocal:true}).hostname,'127.0.0.1');
 });
 await test('A10 requires all eight immutable assets',async()=>{const c=expected();delete c.assets['icons/favicon-32.png'];assert.throws(()=>P.validate(c),/Missing/);});
 await test('A10 refuses malformed git source SHA',async()=>{const c=expected();c.sourceSha='faked';assert.throws(()=>P.validate(c),/Missing/);});
 await test('A10 refuses missing archive provenance',async()=>{const c=expected();delete c.offlineZipSha256;assert.throws(()=>P.validate(c),/archive/);});
 await test('A10 successful HTTPS probe validates eight exact bytes',async()=>{
   const r=await P.probe('https://gomoku-a10-preview.vercel.app/',expected(),{fetchFn:async url=>{
     const name=new URL(url).pathname.slice(1);const content=Buffer.from(name);
     return {status:200,redirected:false,url,arrayBuffer:async()=>content};}});
   assert.equal(r.verifiedAssets.length,8);assert.equal(r.sourceSha,source);
 });
 await test('A10 rejects partial missing icon',async()=>{
   await assert.rejects(()=>P.probe('https://gomoku-a10-preview.vercel.app/',expected(),{fetchFn:async url=>{
     const name=new URL(url).pathname.slice(1);
     return {status:name==='icons/favicon-32.png'?404:200,url,arrayBuffer:async()=>Buffer.from(name)};}}),/non-200/);
 });
 await test('A10 refuses changed HTML even with HTTP 200',async()=>{
   await assert.rejects(()=>P.probe('https://gomoku-a10-preview.vercel.app/',expected(),{fetchFn:async url=>{
     const name=new URL(url).pathname.slice(1),body=Buffer.from(name==='index.html'?'mutated':name);
     return {status:200,url,arrayBuffer:async()=>body};}}),/diverges/);
 });
 await test('A10 refuses host redirection even with successful status',async()=>{
   await assert.rejects(()=>P.probe('https://gomoku-a10-preview.vercel.app/',expected(),{fetchFn:async url=>({
     status:200,url:'https://gomoku.thiepn.dev/index.html',arrayBuffer:async()=>Buffer.from('index.html')})}),/redirected/);
 });
 await test('A10 refuses any candidate asset containing wrong bytes',async()=>{
   for(const asset of P.ASSETS){
     await assert.rejects(()=>P.probe('https://gomoku-a10-preview.vercel.app/',expected(),{fetchFn:async url=>{
       const name=new URL(url).pathname.slice(1);
       return {status:200,url,arrayBuffer:async()=>Buffer.from(name===asset?'bad':name)};}}),/diverges/);
   }
 });
 console.log(n+' A10 isolated host, immutable hash and fail-closed preview tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
