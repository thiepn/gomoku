/* A10 physical-device acceptance: observational matrix, never automated attestation. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),A9=require('./rc9-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const get=p=>JSON.parse(fs.readFileSync(path.resolve(ROOT,p),'utf8'));
function evaluate(original,worksheet,live){
 const q=A9.qualify(original,worksheet);
 const errors=[...q.automation.issues,...q.physical.issues];
 if(!live||!Array.isArray(live.verifiedAssets)||live.verifiedAssets.length!==8)
   errors.push('No successful eight-asset actual HTTPS probe has been provided.');
 else {
   if(live.sourceSha!==original.sourceSha||live.url!==worksheet?.candidatePreviewUrl)
     errors.push('Live HTTPS probe refers to a different source or origin.');
   for(const f of A9.ASSETS)if(!live.verifiedAssets.some(a=>a.path===f&&a.sha256===original.assets?.[f]))
     errors.push('Live HTTPS asset is missing or mismatched: '+f);
 }
 const ready=errors.length===0&&q.status==='release-qualified';
 return {sourceSha:original.sourceSha,status:!q.automation.ok?'blocked-automation':
   errors.some(x=>/HTTPS|Live|origin|asset/i.test(x))?'blocked-preview':
   !q.physical.ok?'awaiting-physical':!q.ownerApproved?'awaiting-owner':'ready-for-separate-release-authorization',
   physical:q.physical.devices,checksRequired:Object.fromEntries(Object.entries(A9.DEVICE_CHECKS).map(([k,v])=>[k,v.length])),
   issues:errors,canMerge:false,canDeployProduction:false,
   note:'Readiness is documentary only. Any promotion requires a separate owner-approved production action; no deployment is possible through this checker.'};
}
if(require.main===module){
 const [receiptPath,worksheetPath,probePath]=process.argv.slice(2);
 if(!receiptPath||!worksheetPath||!probePath)throw Error('Usage: node analysis3/a10-device-assessment.cjs <A9-rc-receipt> <filled-worksheet> <HTTPS-probe>');
 const result=evaluate(get(receiptPath),get(worksheetPath),get(probePath));
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='ready-for-separate-release-authorization')process.exitCode=2;
}
module.exports={evaluate};
