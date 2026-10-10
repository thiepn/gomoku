/* A15: opt-in PUBLIC GitHub metadata and offline bytes verification, no API write authority. */
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const LOCK=require('./a10-source-lock.json');
const PINS=require('./a15-evidence-pins.json');
const HEX=/^[a-f0-9]{64}$/;
const API='https://api.github.com/repos/thiepn/gomoku/';
const DIGEST=x=>crypto.createHash('sha256').update(x).digest('hex');
function blocked(code,detail,extra={}){
 return Object.freeze({format:'GomokuA15GitHubReadback',version:15,status:code,detail,...extra,
  canMerge:false,canTag:false,canDeploy:false,canCloseRelease:false,canCertifyPhysical:false,
  note:'Read-back is verifiable public GitHub metadata only; independently authenticate original bytes, device evidence, human signers and replay-ledger custody.'});
}
function pinsValid(p=PINS){
 return p?.format==='GomokuA15PublicGitHubEvidencePins'&&p.version===15&&
  p.repository==='thiepn/gomoku'&&p.a14HeadSha==='20ed712041029930b41fd76e5c895a6f43c29e1d'&&
  p.a9SourceSha===LOCK.sourceSha&&p.a9RunId===Number(LOCK.githubRunId)&&
  p.a9Artifact?.id===Number(LOCK.githubArtifactId)&&
  p.a9Artifact?.name===LOCK.githubArtifactName&&
  p.a9Artifact?.offlineZipSha256===LOCK.offlineZipSha256&&
  /^sha256:[a-f0-9]{64}$/.test(p.a9Artifact.digest||'')&&
  Array.isArray(p.requiredRuns)&&p.requiredRuns.length===6&&
  new Set(p.requiredRuns.map(x=>x.check)).size===6&&
  p.requiredRuns.every(x=>Number.isSafeInteger(x.id)&&x.id>0&&x.sha===p.a14HeadSha)&&
  ['p19-supply-chain','a14-nondeploying-custody','p20-slo','evidence-and-baseline','p21-capacity','p23-security']
   .every(x=>p.requiredRuns.some(y=>y.check===x))&&
  Array.isArray(p.additionalArtifacts)&&p.additionalArtifacts.length===2&&
  p.additionalArtifacts.every(x=>Number.isSafeInteger(x.id)&&Number.isSafeInteger(x.runId)&&
   typeof x.name==='string'&&/^sha256:[a-f0-9]{64}$/.test(x.digest||''));
}
function validateRun(r,pin){
 return r&&r.id===pin.id&&r.head_sha===pin.sha&&r.status==='completed'&&
  r.conclusion==='success'&&r.run_attempt===1&&
  ['push','pull_request'].includes(r.event)&&r.repository?.full_name==='thiepn/gomoku';
}
function validateArtifact(a,pin){
 return a&&a.id===pin.id&&a.name===pin.name&&
  a.digest===pin.digest&&a.expired===false&&
  Number.isSafeInteger(a.size_in_bytes)&&a.size_in_bytes>0&&
  a.workflow_run?.id===pin.runId;
}
async function readJson(url,fetchFn){
 if(!url.startsWith(API)||!/^https:\/\/api\.github\.com\/repos\/thiepn\/gomoku\/actions\/(?:runs|artifacts)\/[1-9][0-9]*$/.test(url))
  throw Error('A15 GitHub read may only use explicitly pinned public REST resource URLs.');
 const r=await fetchFn(url,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
  headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 if(!r||r.status!==200||r.redirected===true||r.url&&r.url!==url)
  throw Error('GitHub HTTPS response was redirected or did not return HTTP 200.');
 const s=await r.text();if(s.length>2_000_000)throw Error('GitHub metadata response unexpectedly large.');
 return JSON.parse(s);
}
async function readback({approved=false,fetchFn=fetch,pins=PINS}={}){
 if(approved!==true)return blocked('blocked-permission','A15 public GitHub source readback needs an explicit opt-in.');
 if(!pinsValid(pins))return blocked('blocked-pins','A9 or A14 pinned source and artifact metadata changed.');
 try{
  const origPin={id:pins.a9RunId,sha:pins.a9SourceSha};
  const runs=[origPin,...pins.requiredRuns];
  for(const p of runs){
   const r=await readJson(API+'actions/runs/'+p.id,fetchFn);
   if(!validateRun(r,p))
    return blocked('blocked-run','GitHub run ID/head SHA/conclusion/event/attempt/repository mismatch.',{failedRunId:p.id});
  }
  const archives=[{...pins.a9Artifact,runId:pins.a9RunId},...pins.additionalArtifacts];
  for(const p of archives){
   const r=await readJson(API+'actions/artifacts/'+p.id,fetchFn);
   if(!validateArtifact(r,p))
    return blocked('blocked-artifact','GitHub archive provenance, content digest, origin run or expiry mismatch.',{failedArtifactId:p.id});
  }
  return blocked('ready-for-original-byte-and-independent-review','Public GitHub A9 and A14 run and artifact metadata re-fetched at this instant. ZIP contents and human evidence not authenticated.',
   {a14HeadSha:pins.a14HeadSha,a9SourceSha:pins.a9SourceSha,validatedRuns:runs.map(x=>x.id),
    validatedArtifacts:archives.map(x=>({id:x.id,digest:x.digest}))});
 }catch(e){return blocked('blocked-readback',String(e?.message||e));}
}
function verifyOriginalOfflineZip(bytes,{pins=PINS}={}){
 if(!pinsValid(pins)||!Buffer.isBuffer(bytes)||bytes.length<4||bytes.length>50_000_000)
  return blocked('blocked-offline-zip','Only a locally provided, bounded, original A9 offline ZIP is accepted.');
 if(bytes.subarray(0,4).toString('hex')!=='504b0304')return blocked('blocked-offline-zip','Original package has no ZIP local-file header.');
 const digest=DIGEST(bytes);
 if(digest!==LOCK.offlineZipSha256)return blocked('blocked-offline-zip','Original A9 nested offline ZIP bytes differ from locked SHA-256.');
 return blocked('ready-for-independent-zip-review','Exact A9 offline candidate ZIP hash matches locked original; origin and extracted contents still require independent review.',
  {offlineZipSha256:digest,bytes:bytes.length});
}
if(require.main===module){
 const [zipPath]=process.argv.slice(2);
 // CLI intentionally NEVER contacts GitHub or any production host.
 const report=zipPath?verifyOriginalOfflineZip(fs.readFileSync(zipPath)):blocked('blocked-no-input','Provide explicit original ZIP file to inspect; no remote request was made.');
 console.log(JSON.stringify(report,null,2));
 if(!report.status.startsWith('ready-for-'))process.exitCode=2;
}
module.exports={readback,verifyOriginalOfflineZip,validateRun,validateArtifact,pinsValid,readJson,DIGEST};
