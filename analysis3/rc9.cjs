/* A9 immutable candidate receipt. CI-only stage attestations. No production actions. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
 cp=require('node:child_process'),C=require('./rc9-core.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'analysis9-test-output');
const RECEIPT=path.join(OUT,'rc9-candidate.json');
const sha256=(f)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const now=()=>new Date().toISOString();
const exit=(err)=>{throw Error(err);};
function snapshot(){
 const sha=git('rev-parse','HEAD'),branch=process.env.GITHUB_REF_NAME||git('branch','--show-current');
 if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==sha)exit('Runner HEAD differs from GitHub event SHA.');
 const files=C.ASSETS,assets=Object.fromEntries(files.map(f=>[f,sha256(f)]));
 const version=fs.readFileSync(path.join(ROOT,'client-cache-version.txt'),'utf8').trim();
 const audited=C.inspectSource({sourceSha:sha,branch,cacheVersion:version,
   sw:fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),
   index:fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),
   manifest:fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'),
   assetPaths:files});
 if(!audited.ok)exit('Portable source validation failed: '+audited.issues.join('; '));
 const modified=git('diff','--name-only','--',...files);
 if(modified)exit('Candidate assets are not committed: '+modified);
 return {sourceSha:sha,sourceBranch:branch,assets,cacheVersion:version};
}
function read(){
 if(!fs.existsSync(RECEIPT))exit('Initialize exact candidate receipt first.');
 return JSON.parse(fs.readFileSync(RECEIPT,'utf8'));
}
function write(d){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(RECEIPT,JSON.stringify(d,null,2)+'\n');}
function verifySame(a){
 const b=snapshot();for(const p of ['sourceSha','sourceBranch','cacheVersion'])
  if(a[p]!==b[p])exit('Candidate changed since evidence collection: '+p);
 for(const name of C.ASSETS)if(a.assets?.[name]!==b.assets[name])exit('Candidate artifact mutated: '+name);
}
function init(){
 if(process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')exit('A9 receipt creation is restricted to workflow jobs.');
 const s=snapshot();
 write({format:'GomokuAnalysis3Candidate',version:9,...s,originMainFrozen:true,
   workflowRunId:process.env.GITHUB_RUN_ID||'',
   createdAt:now(),stages:{},physicalEvidence:null,ownerApproval:{status:'pending'}});
 console.log('A9 candidate pinned to '+s.sourceSha+' with '+C.ASSETS.length+' exact offline asset hashes.');
}
function mark(stage){
 if(process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')exit('Only GitHub Actions may attest automated stages.');
 if(!C.STAGES.includes(stage))exit('Unknown stage: '+stage);
 const a=read();verifySame(a);
 if(a.workflowRunId!==process.env.GITHUB_RUN_ID)exit('Workflow run changed during evidence capture.');
 if(a.stages?.[stage])exit('Refusing duplicate attestations for '+stage);
 a.stages[stage]={status:'passed',sourceSha:a.sourceSha,indexSha256:a.assets['index.html'],
   workflowRunId:a.workflowRunId,completedAt:now(),issuer:'GitHub Actions'};
 write(a);console.log('A9 stage passed: '+stage);
}
function finalize(){
 const a=read();verifySame(a);const result=C.automated(a);
 const q=C.qualify(a,null);
 const status={state:q.status,automationReady:result.ok,physicalReady:false,
   humanApproval:false,productionUpdated:false,issues:[...result.issues,...q.physical.issues]};
 fs.mkdirSync(OUT,{recursive:true});
 fs.writeFileSync(path.join(OUT,'rc9-status.json'),JSON.stringify(status,null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'RC9-STATUS.md'),
  '# Gomoku Analysis 3.0 — A9 immutable candidate\n\n'+
  '**Source SHA:** `'+a.sourceSha+'`\n\n'+
  '**Offline index SHA-256:** `'+a.assets['index.html']+'`\n\n'+
  '**PWA service-worker SHA-256:** `'+a.assets['sw.js']+'`\n\n'+
  '**Automatic CI evidence:** '+(result.ok?'PASS':'BLOCKED')+'\n\n'+
  '**Production:** Unchanged. No release was made.\n\n'+
  '**Physical Android Chrome, Samsung Internet, installed PWA:** Pending independent verification.\n\n'+
  '**Owner authorization:** Not granted.\n\n'+
  'This offline package is a candidate, not a deployed application or physical-device attestation.\n');
 console.log(JSON.stringify({sha:a.sourceSha,status:status.state,automationReady:status.automationReady,
   issues:status.issues}));
 if(!result.ok)process.exitCode=1;
}
function physical(file){
 if(!file)exit('Provide completed A9 physical-device worksheet JSON.');
 const a=read();verifySame(a);if(!C.automated(a).ok)exit('Automated candidate evidence not complete.');
 const worksheet=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
 const q=C.qualify(a,worksheet);
 fs.writeFileSync(path.join(OUT,'rc9-device-assessment.json'),JSON.stringify({
   status:q.status,automationReady:q.automation.ok,physicalReady:q.physical.ok,
   ownerApproved:q.ownerApproved,canDeploy:false,issues:q.physical.issues,
   candidateSourceSha:a.sourceSha},null,2)+'\n');
 console.log(JSON.stringify({status:q.status,physicalEvidence:q.physical.devices,canDeploy:false}));
 if(q.status!=='release-qualified')process.exitCode=2;
}
switch(process.argv[2]){
 case 'init':init();break;
 case 'mark':mark(process.argv[3]);break;
 case 'finalize':finalize();break;
 case 'verify-physical':physical(process.argv[3]);break;
 default:exit('Usage: node analysis3/rc9.cjs init|mark <stage>|finalize|verify-physical <worksheet.json>');
}
