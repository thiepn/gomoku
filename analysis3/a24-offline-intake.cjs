/* A24: REAL FILE-BYTE offline intake of externally supplied original HTTP responses.
 * No network, no credentials, no deployment. Original CI bytes != authorized hosted proof.
 * Usage: node analysis3/a24-offline-intake.cjs --manifest ./capture.json
 *   --capture-root ./captured --original-root ./original-A9 --out ./pending.json
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A10=require('./a10-preview-integrity.cjs'),PIN=require('./a10-source-lock.json');
const P23=require('./a23-parent-evidence.json');
const H=/^[a-f0-9]{64}$/;
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex')}
function readUnder(root,relative,{max=10*1024*1024}={}){
 if(typeof root!=='string'||!root||typeof relative!=='string'||!relative||
  relative.startsWith('/')||relative.includes('\\')||
  relative.split('/').some(x=>x===''||x==='.'||x==='..')||
  /^[A-Za-z]:/.test(relative))throw Error('Blocked unsafe original-byte path');
 const base=fs.realpathSync(root),full=path.resolve(base,relative);
 if(!full.startsWith(base+path.sep))throw Error('Original bytes escaped approved root');
 let cur=base;
 for(const segment of relative.split('/')){
  cur=path.join(cur,segment);
  const st=fs.lstatSync(cur);
  if(st.isSymbolicLink())throw Error('Symlinked original evidence forbidden');
 }
 const st=fs.statSync(full);
 if(!st.isFile()||st.size===0||st.size>max)throw Error('Original byte object empty, oversized or not a regular file');
 const bytes=fs.readFileSync(full);
 if(bytes.length!==st.size||bytes.length>max)throw Error('Original file changed during read');
 return bytes;
}
function parseOrigin(value){
 const u=A10.previewUrl(value);
 if(u.protocol!=='https:'||u.port||u.search||u.hash||u.pathname!=='/')
  throw Error('Dedicated isolated HTTPS origin only');
 return u.origin+'/';
}
function utc(value,now){
 if(typeof value!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))
  throw Error('Original UTC capture timestamp required');
 const t=Date.parse(value);
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19)!==value.slice(0,19)||
  t>now.getTime()||t<new Date('2020-01-01T00:00:00Z').getTime())
  throw Error('Invalid or future original timestamp');
 return t;
}
function intake({manifest,captureRoot,originalRoot,now=new Date()}={}){
 if(!manifest||manifest.format!=='GomokuA24OfflineHostedResponseIntake'||
  manifest.version!==24||manifest.repository!=='thiepn/gomoku'||
  manifest.sourceSha!==PIN.sourceSha||
  manifest.a23Head!=='d36610bc49aa0cee03f3a649108fda98e99094ee'||
  manifest.purpose!=='MANUAL_OFFLINE_REVIEW_ONLY'||
  manifest.ownerAuthorizationState!=='NOT_GRANTED'||
  manifest.verifiedHumanWitnesses!==0||manifest.productionOriginTouched!==false||
  typeof manifest.captureOperatorId!=='string'||manifest.captureOperatorId.trim().length<3||
  typeof manifest.captureTool!=='string'||manifest.captureTool.trim().length<3||
  !Array.isArray(manifest.responses)||manifest.responses.length!==A10.ASSETS.length)
  throw Error('Rejected original intake: scope, human authorization and exact A9 source');
 const origin=parseOrigin(manifest.previewOrigin);
 const ids=new Set(),fileIds=new Set(),receipts=[];
 for(const asset of A10.ASSETS){
  const r=manifest.responses.find(x=>x?.asset===asset);
  if(!r||ids.has(r.asset)||typeof r.file!=='string'||fileIds.has(r.file)||
   r.file!=='captured/'+asset||r.method!=='GET'||r.status!==200||
   r.redirected!==false||r.credentialsSent!==false||
   r.cookiesSent!==false||r.hasSetCookie!==false||
   r.originalRequestUrl!==new URL(asset,origin).toString()||
   r.originalResponseUrl!==r.originalRequestUrl||
   r.originalRightsApproved!==false||
   typeof r.contentEncoding!=='string'||r.contentEncoding!=='identity'||
   !H.test(r.capturedSha256||'')||!Number.isSafeInteger(r.byteLength)||
   r.byteLength<=0||!H.test(r.providerObjectSha256||'')||
   r.providerObjectSha256!==r.capturedSha256)
   throw Error('Rejected original response metadata: '+asset);
  utc(r.capturedAt,now);
  const actual=readUnder(captureRoot,r.file),expected=readUnder(originalRoot,asset);
  if(actual.length!==r.byteLength||sha(actual)!==r.capturedSha256||
   sha(actual)!==sha(expected))
   throw Error('Original body SHA/length does not match immutable A9 candidate: '+asset);
  ids.add(r.asset);fileIds.add(r.file);
  receipts.push({asset,sourceSha:PIN.sourceSha,sha256:sha(actual),bytes:actual.length,
   claimedOrigin:origin,claimOnlyCapturedAt:r.capturedAt,
   status:'MATCHED_BYTES_PENDING_REAL_PROVIDER_AND_OWNER_REVIEW'});
 }
 if(ids.size!==A10.ASSETS.length||manifest.responses.some(x=>!ids.has(x.asset)))
  throw Error('Unknown original HTTP asset response');
 return {format:'GomokuA24UnsignedHostedByteReview',version:24,
  a23Head:'d36610bc49aa0cee03f3a649108fda98e99094ee',
  originalA9SourceSha:PIN.sourceSha,originalA9OfflineZipSha256:PIN.offlineZipSha256,
  claimedDedicatedPreviewOrigin:origin,receivedFromOperator:manifest.captureOperatorId,
  actualOriginalByteObjects:receipts.length,receipts,
  originalBytesComparedToRealA9CI:true,actualHostedRequestPerformedByTool:false,
  originalHostedResponsesIndependentlyAuthenticated:false,
  realHumanRightsOrOwnerApproval:false,actualDeviceAcceptance:0,
  canMerge:false,canTag:false,canDeploy:false,canModifyProductionData:false,
  canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
  decision:'NO_GO',status:'PENDING_INDEPENDENT_HOST_AND_ORIGINAL_RIGHTS_REVIEW'};
}
function cli(argv){
 const args={};for(let i=0;i<argv.length;i+=2){
  if(!argv[i]?.startsWith('--')||!argv[i+1]||args[argv[i]])throw Error('Explicit argument name + value required');
  args[argv[i]]=argv[i+1];
 }
 for(const p of ['--manifest','--capture-root','--original-root','--out'])
  if(!args[p])throw Error('Missing '+p);
 const manifest=JSON.parse(fs.readFileSync(args['--manifest'],'utf8'));
 const result=intake({manifest,captureRoot:args['--capture-root'],originalRoot:args['--original-root']});
 fs.writeFileSync(args['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('A24: 8/8 original bytes matched A9. Host/owner rights and 0/18 physical acceptance still UNVERIFIED. NO_GO.');
}
module.exports={intake,readUnder,parseOrigin,utc,sha,cli};
if(require.main===module){try{cli(process.argv.slice(2))}catch(e){console.error('A24 FAIL CLOSED: '+e.message);process.exitCode=1}}
