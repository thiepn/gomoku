/* A7 — CI receipt generator. Never publishes, tags, merges or deploys production.
 * Files are branch-local workflow artifacts, generated AFTER checks succeed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
 cp=require('node:child_process'),Gate=require('./release-gate.js');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'analysis7-test-output'),FILE=path.join(DIR,'a7-qualification.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const sha=()=>cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const STAGES=Object.freeze({
 integrity:['source-integrity','review-core','deterministic-build','security-scope'],
 tactical:['rules-renju','proof-coverage','a0-evidence','a1-forcing-defense','a2-comparability','a3-workspace','a4-diagnosis','a5-practice','a6-worker-lifecycle','a6-offline-scope'],
 benchmark:['a7-threat-benchmark'],
 browser:['desktop-chromium','mobile-emulation','keyboard-accessibility'],
 offline:['offline-browser-reload'],
 rollback:['rollback-dry-run']
});
function stamp(){return new Date().toISOString();}
function snapshot(){
 const expected=sha();
 if(!/^[a-f0-9]{40}$/.test(expected))throw Error('Invalid source commit SHA');
 const branch=(process.env.GITHUB_REF_NAME||cp.execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim());
 if(branch!=='phase/a7-release-qualification')throw Error('Refusing to qualify release from '+branch);
 const state={format:'GomokuAnalysis3ReleaseQualification',version:7,sourceSha:expected,targetBranch:branch,
   artifactHash:hash('index.html'),serviceWorkerHash:hash('sw.js'),manifestHash:hash('manifest.webmanifest'),
   productionUnchanged:true,createdAt:stamp(),automatedEvidence:{},physicalEvidence:{},approval:{status:'pending'}};
 return state;
}
function write(state){fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(FILE,JSON.stringify(state,null,2)+'\n');}
function read(){if(!fs.existsSync(FILE))throw Error('Initialize candidate evidence first');return JSON.parse(fs.readFileSync(FILE,'utf8'));}
function current(state){
 const x=snapshot();
 for(const id of ['sourceSha','artifactHash','serviceWorkerHash','manifestHash','targetBranch'])
  if(x[id]!==state[id])throw Error('Candidate mutated since evidence capture: '+id);
 return x;
}
function start(){write(snapshot());console.log('A7: new candidate evidence created; all checks initially unproven.');}
function attest(stage){
 if(process.env.CI!=='true'||!process.env.GITHUB_ACTIONS)throw Error('Only GitHub Actions may mark a check as passed');
 const ids=STAGES[stage];if(!ids)throw Error('Unknown evidence stage '+stage);
 const state=read();current(state);
 const stageEvent=stage==='offline'?'Chromium HTTP network disabled':'GitHub Actions checks';
 for(const id of ids){
  if(state.automatedEvidence[id])throw Error('Duplicate evidence for '+id);
  state.automatedEvidence[id]={status:'passed',sha:state.sourceSha,artifactHash:state.artifactHash,
    timestamp:stamp(),issuer:'GitHub Actions/'+(process.env.GITHUB_RUN_ID||'unknown')+'/'+stage,
    execution:stageEvent};
 }
 write(state);console.log('A7 evidence recorded for '+ids.join(', '));
}
function final(){
 const state=read();current(state);
 const q=Gate.qualify(state);
 const report={...state,qualification:{state:q.state,automationReady:q.automationReady,
   physicalReady:q.physicalReady,humanApproval:q.humanApproval,blockers:q.blockers}};
 write(report);
 fs.writeFileSync(path.join(DIR,'A7-STATUS.md'),
  '# Analysis 3.0 A7 — Release Qualification\n\n'+
  '**Candidate source commit:** `'+state.sourceSha+'`\n\n'+
  '**Candidate index SHA-256:** `'+state.artifactHash+'`\n\n'+
  '**Service worker SHA-256:** `'+state.serviceWorkerHash+'`\n\n'+
  '**Automated qualification:** '+(q.automationReady?'Passed':'Blocked')+'\n\n'+
  '**Release state:** '+q.state+'\n\n'+
  '**Physical Android qualification:** '+(q.physicalReady?'Passed':'Pending — Chrome, Samsung Internet, installed PWA')+'\n\n'+
  '**Owner approval:** '+(q.humanApproval?'Recorded':'Not granted')+'\n\n'+
  'No production merge, tag or deployment was performed.\n');
 console.log(JSON.stringify({sha:state.sourceSha,state:q.state,automationReady:q.automationReady,
   physicalReady:q.physicalReady,missing:q.blockers.slice(0,30)}));
 if(!q.automationReady)process.exitCode=1;
 // Physical signoff is not possible inside this CI. This is an expected release hold.
}
function dryRollback(){
 const current=hash('index.html'),previous=hash('manifest.webmanifest');
 const denied=Gate.fallbackDecision({productionBroken:true,currentBuild:current,previousBuild:previous,ownerApproved:false});
 if(denied.action!=='block')throw Error('Rollback policy allowed unauthorized deployment');
 const accepted=Gate.fallbackDecision({productionBroken:true,currentBuild:current,previousBuild:previous,ownerApproved:true});
 if(accepted.action!=='rollback-to-verified')throw Error('Rollback decision failed');
 console.log('A7 rollback dry run: no live action, no data deletion; explicit approval required.');
}
switch(process.argv[2]){
 case 'init':start();break;
 case 'mark':attest(process.argv[3]);break;
 case 'finalize':final();break;
 case 'rollback-test':dryRollback();break;
 default:throw Error('Usage: node analysis3/a7-report.cjs init|mark <stage>|finalize|rollback-test');
}
