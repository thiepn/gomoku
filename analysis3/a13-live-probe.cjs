/* Explicitly scoped read-only production asset observer. NEVER executes without human operator opt-in. */
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const A9=require('./rc9-core.cjs');
const A12=require('./a12-cutover-preflight.cjs');
const LOCK=require('./a10-source-lock.json');
const SHA=/^[a-f0-9]{64}$/i;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function probe({origin,candidate,deploymentId,approved=false,fetchFn=fetch,clock=()=>new Date()}={}){
 if(approved!==true)throw Error('A13 read-only production probing requires explicit operator authorization.');
 if(!A12.origin(origin))throw Error('Production origin must be an explicitly scoped clean HTTPS domain, never localhost or a preview.');
 if(typeof deploymentId!=='string'||!deploymentId.trim())
   throw Error('Exact production deployment identity required.');
 if(!candidate||candidate.sourceSha!==LOCK.sourceSha||
   candidate.sourceBranch!==LOCK.upstreamBranch||
   String(candidate.workflowRunId)!==LOCK.githubRunId||!A9.automated(candidate).ok||
   A9.ASSETS.some(p=>!SHA.test(candidate.assets?.[p]||'')))
   throw Error('Unqualified A9 immutable source or eight asset hashes.');
 const verifiedAssets=[];
 for(const name of A9.ASSETS){
  const url=new URL(name,origin).toString();
  const r=await fetchFn(url,{method:'GET',redirect:'manual',cache:'no-store',
    credentials:'omit',headers:{'Accept':'*/*','Cache-Control':'no-cache'}});
  if(!r||r.status!==200||r.redirected||r.type==='opaqueredirect'||
    (r.url&&r.url!==url))
   throw Error('Production redirected, cross-origin, or non-200 at '+name);
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length===0||bytes.length>10*1024*1024)
   throw Error('Unexpected response length for '+name);
  const sha256=hash(bytes);
  if(sha256!==candidate.assets[name])
   throw Error('Production differs from immutable qualified A9 asset: '+name);
  verifiedAssets.push({path:name,sha256,bytes:bytes.length});
 }
 const observedAt=clock().toISOString();
 return Object.freeze({format:'GomokuAnalysis3A13ProductionProbe',version:13,
  origin,sourceSha:LOCK.sourceSha,deploymentId,observedAt,verifiedAssets,
  originalResponseDigest:hash(JSON.stringify({origin,deploymentId,verifiedAssets})),
  statement:'Eight HTTP responses observed and matched immutable source. Must still independently witness and authenticate production evidence.'});
}
if(require.main===module){
 (async()=>{
  const [origin,receiptPath,deploymentId]=process.argv.slice(2);
  if(process.env.A13_READONLY_PROBE_APPROVAL!=='I_APPROVE_A13_READONLY_HTTPS_PROBE'||
     !origin||origin!==process.env.A13_EXACT_PRODUCTION_ORIGIN)
   throw Error('No explicit read-only operator approval and exact host match; absolutely no request sent.');
  const candidate=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  const result=await probe({origin,candidate,deploymentId,approved:true});
  console.log(JSON.stringify(result,null,2));
 })().catch(e=>{console.error(String(e));process.exitCode=2});
}
module.exports={probe,hash};
