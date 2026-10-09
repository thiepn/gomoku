/* A9 — immutable offline release-candidate contract. Pure; no deployment API. */
'use strict';
const {PHYSICAL,DEVICE_CHECKS}=require('./release-gate.js');
const BRANCH='phase/a9-immutable-release-candidate',HEX40=/^[a-f0-9]{40}$/,HEX64=/^[a-f0-9]{64}$/;
const ASSETS=Object.freeze(['index.html','sw.js','manifest.webmanifest','icons/icon-192.png',
 'icons/icon-512.png','icons/maskable-icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png']);
const STAGES=Object.freeze(['sources','tactical','benchmark','reproducibility','browser','offline','package']);
const requireString=(v)=>typeof v==='string'&&v.trim().length>0;
function inspectSource({sourceSha,branch,cacheVersion,sw,manifest,index,assetPaths}={}){
 const issues=[];
 if(!HEX40.test(sourceSha||''))issues.push('Missing real source commit SHA.');
 if(branch!==BRANCH)issues.push('Candidate must be built from A9 branch.');
 if(!requireString(cacheVersion)||!cacheVersion.startsWith('gomoku-')||cacheVersion.includes('\n'))issues.push('Invalid client cache key.');
 const k=/^const CACHE_NAME = '([^']+)';/m.exec(sw||'');
 if(!k||k[1]!==cacheVersion)issues.push('Service-worker cache name does not match the actual client cache key.');
 if(!/self\.addEventListener\('fetch'/.test(sw||'')||!/url\.origin !== scopeURL\.origin/.test(sw||''))
   issues.push('Service worker lacks strict origin-scoped fetch handler.');
 if(!/request\.mode === 'navigate'/.test(sw||'')||!/if \(!isShell\) return/.test(sw||''))
   issues.push('Service worker navigation not limited to Gomoku shell.');
 let app=null;
 try{app=JSON.parse(manifest||'');}
 catch{issues.push('PWA manifest is not valid JSON.');}
 if(app){
   for(const p of ['id','start_url','scope'])if(app[p]!=='./')issues.push('PWA '+p+' must retain same-folder scope.');
   if(app.display!=='standalone')issues.push('PWA standalone mode is missing.');
   const icons=new Set((Array.isArray(app.icons)?app.icons:[]).map(x=>x?.src));
   for(const f of ASSETS.filter(x=>x.startsWith('icons/')&&/icon-(192|512)|maskable-icon-512/.test(x))){
     if(!icons.has('./'+f))issues.push('PWA manifest missing '+f);
   }
 }
 if(!/id="analysis8-practice-integrity"/.test(index||'')||!/id="analysis6-runtime-policy"/.test(index||''))
   issues.push('Portable index missing qualified practice or background-worker modules.');
 if(!/id="guided-review-script"/.test(index||''))issues.push('Game Review module absent from portable app.');
 const paths=new Set(assetPaths||[]);
 for(const p of ASSETS)if(!paths.has(p))issues.push('Offline app asset missing: '+p);
 for(const p of ASSETS)if(!(sw||'').includes("'./"+p+"'")&&p!=='index.html')
   issues.push('Service worker install list missing '+p);
 return {ok:issues.length===0,issues,checkedAssets:ASSETS.length,branch:BRANCH,cacheVersion};
}
function automated(candidate){
 const issues=[];
 if(candidate?.format!=='GomokuAnalysis3Candidate'||candidate?.version!==9)issues.push('Invalid A9 candidate receipt.');
 if(candidate?.sourceBranch!==BRANCH||!HEX40.test(candidate?.sourceSha||''))issues.push('Invalid A9 source identity.');
 if(!HEX64.test(candidate?.assets?.['index.html']||'')||ASSETS.some(p=>!HEX64.test(candidate?.assets?.[p]||'')))
   issues.push('One or more artifact SHA-256 hashes are missing.');
 if(candidate?.originMainFrozen!==true)issues.push('Production branch preservation not attested.');
 if(!requireString(candidate?.workflowRunId))issues.push('Candidate is not attributed to a workflow run.');
 for(const stage of STAGES){
   const row=candidate?.stages?.[stage];
   if(!row||row.status!=='passed'||row.sourceSha!==candidate.sourceSha||
       row.indexSha256!==candidate.assets?.['index.html']||
       row.workflowRunId!==candidate.workflowRunId||!requireString(row.completedAt)||
       !Number.isFinite(Date.parse(row.completedAt))||row.issuer!=='GitHub Actions'){
     issues.push('Required automated stage missing or stale: '+stage);
   }
 }
 return {ok:issues.length===0,issues};
}
function physical(candidate,worksheet){
 const issues=[],results={};
 if(!worksheet||worksheet.sourceSha!==candidate?.sourceSha||worksheet.indexSha256!==candidate?.assets?.['index.html']||
    worksheet.serviceWorkerSha256!==candidate?.assets?.['sw.js']||
    worksheet.manifestSha256!==candidate?.assets?.['manifest.webmanifest']){
   issues.push('Physical evidence refers to a different source or app artifact.');
 }
 const requested=worksheet?.candidatePreviewUrl;
 if(!requireString(requested)||!/^https:\/\//i.test(requested))issues.push('Public HTTPS candidate URL is missing.');
 for(const id of PHYSICAL){
   const e=worksheet?.physicalEvidence?.[id],tests=Array.isArray(e?.testCases)?e.testCases:[];
   let good=e?.status==='passed'&&e?.sha===candidate?.sourceSha&&e?.artifactHash===candidate?.assets?.['index.html']&&
     requireString(e?.device)&&requireString(e?.osVersion)&&requireString(e?.browserVersion)&&
     requireString(e?.testedUrl)&&e.testedUrl===requested&&requireString(e?.tester)&&
     requireString(e?.signature)&&requireString(e?.issuer)&&requireString(e?.timestamp)&&
     Number.isFinite(Date.parse(e.timestamp))&&tests.length===DEVICE_CHECKS[id].length;
   const seen=new Set();
   for(const t of tests){
     if(!t||!DEVICE_CHECKS[id].includes(t.id)||seen.has(t.id)||t.status!=='passed'||
        !requireString(t.observation)||t.observation.trim().length<12)good=false;
     if(t?.id)seen.add(t.id);
   }
   if(!DEVICE_CHECKS[id].every(q=>seen.has(q)))good=false;
   results[id]=good?'passed':'missing-or-invalid';
   if(!good)issues.push('Physical device signoff incomplete: '+id);
 }
 return {ok:issues.length===0,issues,devices:results};
}
function qualify(candidate,worksheet){
 const a=automated(candidate),p=physical(candidate,worksheet);
 const owner=worksheet?.ownerApproval||{};
 const approved=owner.status==='approved'&&owner.sha===candidate?.sourceSha&&
    owner.artifactHash===candidate?.assets?.['index.html']&&requireString(owner.approvedBy)&&
    requireString(owner.approvedAt)&&Number.isFinite(Date.parse(owner.approvedAt));
 return {status:!a.ok?'blocked-automation':!p.ok?'awaiting-physical':!approved?'awaiting-owner':'release-qualified',
   automation:a,physical:p,ownerApproved:approved,canDeploy:false,
   note:'Qualification never merges, tags, uploads, or deploys. Production promotion requires a separate explicit action.'};
}
module.exports=Object.freeze({VERSION:'3.0.0-a9',BRANCH,ASSETS,STAGES,DEVICE_CHECKS,PHYSICAL,inspectSource,automated,physical,qualify});
