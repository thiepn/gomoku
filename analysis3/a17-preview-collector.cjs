/* A17 explicitly scoped eight-asset read-only preview capture, never automated CI/live deployment. */
'use strict';
const crypto=require('node:crypto');
const G=require('./a17-operator-gate.cjs'),A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const A10=require('./a10-preview-integrity.cjs');
const CAP=10*1024*1024,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function boundedBytes(r,name){
 if(r.headers?.get){
  const length=r.headers.get('content-length');
  if(length!==null&&(length===''||!/^\d+$/.test(length)||Number(length)>CAP||Number(length)<1))
   throw Error('Invalid or oversized Content-Length for '+name);
 }
 if(r.body&&typeof r.body.getReader==='function'){
  const reader=r.body.getReader();let size=0;const chunks=[];
  try{
   while(true){
    const v=await reader.read();if(v.done)break;
    size+=v.value.byteLength;
    if(size>CAP)throw Error('Oversized streaming asset: '+name);
    chunks.push(Buffer.from(v.value));
   }
  }catch(e){await reader.cancel().catch(()=>{});throw e}
  if(size<1)throw Error('Empty response: '+name);
  return Buffer.concat(chunks,size);
 }
 const b=Buffer.from(await r.arrayBuffer());
 if(b.length<1||b.length>CAP)throw Error('Empty/oversized response: '+name);
 return b;
}
function sourceOk(c){
 return c?.sourceSha===LOCK.sourceSha&&c.sourceBranch===LOCK.upstreamBranch&&
  String(c.workflowRunId)===LOCK.githubRunId&&A9.automated(c).ok&&
  A9.ASSETS.every(x=>/^[a-f0-9]{64}$/.test(c.assets?.[x]||''));
}
async function collect({approval,approved=false,origin,candidate,fetchFn,clock=()=>new Date()}={}){
 const gate=G.validate({approval,approved,operation:'preview-read',targetOrigin:origin,now:clock()});
 if(gate.status!=='scoped-document-only')return gate;
 if(!sourceOk(candidate))
  return G.result('blocked-source','Original A9 seven qualified stages and eight source hashes not supplied.');
 let base;try{base=A10.previewUrl(origin);}catch{
  return G.result('blocked-origin','Invalid isolated HTTPS preview origin.');
 }
 if(base.port||base.username||base.password||base.pathname!=='/')
  return G.result('blocked-origin','Preview requires default HTTPS port and exact root.');
 if(typeof fetchFn!=='function')
  return G.result('blocked-client','Caller must explicitly supply a read-only HTTP transport.');
 const assets=[];
 try{
  for(const p of A9.ASSETS){
   const url=new URL(p,base).toString();
   const r=await fetchFn(url,{method:'GET',redirect:'manual',cache:'no-store',
    credentials:'omit',headers:{Accept:'*/*','Cache-Control':'no-store'}});
   if(!r||r.status!==200||r.redirected===true||r.type==='opaqueredirect'||r.url!==url)
    throw Error('Redirected, wrong-host, unknown-URL, or non-200 asset '+p);
   const b=await boundedBytes(r,p),digest=sha(b);
   if(digest!==candidate.assets[p])throw Error('Actual HTTPS asset SHA mismatch: '+p);
   assets.push({path:p,sha256:digest,bytes:b.length});
  }
  const observedAt=clock().toISOString();
  return G.result('preview-bytes-observed-unsigned','Eight exactly scoped HTTP responses hash-match original A9 bytes, but no real physical or human acceptance is inferred.',
   {sourceSha:LOCK.sourceSha,origin,observedAt,assets,originalZipSha256:LOCK.offlineZipSha256,
    bytesDigest:sha(Buffer.from(JSON.stringify({origin,assets}))),
    approvalScopeDigest:gate.scopeDigest,actualHostedAccepted:false});
 }catch(e){
  return G.result('blocked-preview-capture',String(e?.message||e),{assetsChecked:assets.length});
 }
}
if(require.main===module){
 console.log(JSON.stringify(G.result('blocked-direct-execution','A17 preview collection is disabled without a separately approved scope and explicitly injected read-only transport.'),null,2));
 process.exitCode=2;
}
module.exports={collect,boundedBytes,sourceOk,CAP};
