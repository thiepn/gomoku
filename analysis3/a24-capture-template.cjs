/* Generate an EXPLICITLY UNAUTHORIZED/UNVERIFIED offline HTTP-original capture worksheet.
   Never sends a request, captures evidence or conveys host owner approval. */
'use strict';
const fs=require('node:fs');
const A10=require('./a10-preview-integrity.cjs'),PIN=require('./a10-source-lock.json');
const {parseOrigin}=require('./a24-offline-intake.cjs');
const HEAD='d36610bc49aa0cee03f3a649108fda98e99094ee';
function template({previewOrigin,operatorId}={}){
 const origin=parseOrigin(previewOrigin);
 if(typeof operatorId!=='string'||operatorId.trim().length<3)
  throw Error('Capture operator identification required even for a draft');
 return{format:'GomokuA24OfflineHostedResponseIntake',version:24,repository:'thiepn/gomoku',
  sourceSha:PIN.sourceSha,a23Head:HEAD,purpose:'MANUAL_OFFLINE_REVIEW_ONLY',
  previewOrigin:origin,captureOperatorId:operatorId.trim(),
  captureTool:'NOT_CAPTURED_REQUIRES_OWNER_PERMISSION',
  ownerAuthorizationState:'NOT_GRANTED',verifiedHumanWitnesses:0,
  productionOriginTouched:false,
  instructions:'BLANK TEMPLATE ONLY. Obtain separate verified owner permission before any hosted access. Fill status, timing, SHA256, length, provider bytes and preserve all original response bodies offline. Running the verifier NEVER grants approval.',
  responses:A10.ASSETS.map(asset=>({
   asset,file:'captured/'+asset,method:'GET',status:null,
   redirected:null,credentialsSent:null,cookiesSent:null,hasSetCookie:null,
   originalRequestUrl:new URL(asset,origin).toString(),
   originalResponseUrl:null,originalRightsApproved:false,
   contentEncoding:'identity',capturedSha256:null,
   providerObjectSha256:null,byteLength:null,capturedAt:null
  }))};
}
function cli(argv){
 const args={};for(let i=0;i<argv.length;i+=2){
  if(!argv[i]?.startsWith('--')||!argv[i+1]||args[argv[i]])throw Error('Named flags + values required');
  args[argv[i]]=argv[i+1];
 }
 if(!args['--origin']||!args['--operator']||!args['--out'])
  throw Error('Usage: --origin https://specific.vercel.app/ --operator ORIGINAL_OPERATOR --out NEW_TEMPLATE.json');
 const result=template({previewOrigin:args['--origin'],operatorId:args['--operator']});
 fs.writeFileSync(args['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('A24: eight unapproved host-response template entries created OFFLINE. No HTTPS requests or approval.');
}
module.exports={template,cli};
if(require.main===module){try{cli(process.argv.slice(2))}catch(e){console.error('A24 FAIL CLOSED: '+e.message);process.exitCode=1}}
