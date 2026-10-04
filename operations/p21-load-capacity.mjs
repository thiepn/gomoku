import fs from 'node:fs';
import process from 'node:process';
import os from 'node:os';

const api=String(process.env.GOMOKU_ROOM_API||'').replace(/\/$/,'');
const key=String(process.env.GOMOKU_ROOM_KEY||'');
const gitSha=String(process.env.P21_GIT_SHA||process.env.GITHUB_SHA||'LOCAL').trim().toLowerCase();
const evidencePath=String(process.env.P21_EVIDENCE_FILE||'/tmp/p21-capacity-evidence.json');
const chaosPath=String(process.env.P21_CHAOS_FILE||'/tmp/p21-chaos-fixture.json');
if(!api||!key)throw new Error('GOMOKU_ROOM_API and GOMOKU_ROOM_KEY are required.');

const thresholds={
  roomListColdStart:{requests:36,concurrency:4,minSuccessRate:0,p95Ms:5000,p99Ms:8000,minRps:0,diagnostic:true},
  readiness:{batchRequests:12,concurrency:4,consecutiveCleanBatches:3,maxWaitMs:20000},
  roomList:{requests:240,concurrency:12,minSuccessRate:1,p95Ms:1200,p99Ms:2500,minRps:10},
  roomListProbe16:{requests:180,concurrency:16,minSuccessRate:1,p95Ms:1500,p99Ms:3000,minRps:10,diagnostic:true},
  roomListProbe20:{requests:180,concurrency:20,minSuccessRate:1,p95Ms:1500,p99Ms:3000,minRps:10,diagnostic:true},
  roomListRecovery:{requests:60,concurrency:4,minSuccessRate:1,p95Ms:800,p99Ms:1500,minRps:5},
  minimumCertifiedLobbyConcurrency:12,
  roomPoll:{requests:120,concurrency:12,minSuccessRate:0.995,p95Ms:1800,p99Ms:3500,minRps:6},
  health:{requests:40,concurrency:8,minSuccessRate:1,p95Ms:2200,p99Ms:4500,minRps:3},
  joinRace:{attempts:12,expectedPlayers:1,maxDurationMs:15000},
  actionRace:{attempts:8,expectedCommits:1,maxDurationMs:15000},
  workerRestart:{maxRecoveryMs:30000}
};
const id=prefix=>(prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)).toUpperCase().slice(0,32);
const percentile=(values,p)=>{if(!values.length)return null;const xs=[...values].sort((a,b)=>a-b),i=Math.min(xs.length-1,Math.max(0,Math.ceil(p*xs.length)-1));return Math.round(xs[i]*100)/100;};
const round=n=>Math.round(n*100)/100;
function write(data){fs.writeFileSync(evidencePath,JSON.stringify(data,null,2)+'\n');}
function read(){return JSON.parse(fs.readFileSync(evidencePath,'utf8'));}

async function request(path,{method='GET',body,token}={}){
  const started=performance.now();
  try{
    const res=await fetch(api+path,{
      method,
      headers:{apikey:key,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    let data=null;try{data=await res.json();}catch{}
    return {status:res.status,data,latencyMs:performance.now()-started,error:null};
  }catch(error){
    return {status:0,data:null,latencyMs:performance.now()-started,error:String(error?.message||error)};
  }
}
async function requireRequest(path,opts={},ok=[200,201]){
  const r=await request(path,opts);
  if(!ok.includes(r.status))throw new Error((opts.method||'GET')+' '+path+' -> '+r.status+' '+JSON.stringify(r.data||r.error));
  return r;
}
async function pool(total,concurrency,fn){
  const out=new Array(total);let cursor=0;
  const worker=async()=>{while(true){const i=cursor++;if(i>=total)return;out[i]=await fn(i);}};
  await Promise.all(Array.from({length:Math.min(total,concurrency)},worker));
  return out;
}
function summarize(name,results,threshold){
  const durationMs=Math.max(1,Math.max(...results.map(x=>x.finishedAt||0))-Math.min(...results.map(x=>x.startedAt||0)));
  const latencies=results.map(x=>x.latencyMs);
  const ok=results.filter(x=>x.status>=200&&x.status<300).length;
  const statusCounts={};for(const x of results)statusCounts[String(x.status)]=(statusCounts[String(x.status)]||0)+1;
  const errorSamples=results.filter(x=>!(x.status>=200&&x.status<300)).slice(0,5).map(x=>({
    status:x.status,error:x.error||null,body:x.data&&typeof x.data==='object'?x.data:null
  }));
  const s={
    name,requests:results.length,concurrency:threshold.concurrency,success:ok,
    successRate:round(ok/results.length),durationMs:round(durationMs),
    throughputRps:round(results.length/(durationMs/1000)),
    p50Ms:percentile(latencies,.50),p95Ms:percentile(latencies,.95),
    p99Ms:percentile(latencies,.99),maxMs:round(Math.max(...latencies)),statusCounts,errorSamples
  };
  s.passed=s.successRate>=threshold.minSuccessRate
    && s.p95Ms<=threshold.p95Ms
    && s.p99Ms<=threshold.p99Ms
    && s.throughputRps>=threshold.minRps;
  return s;
}
async function bench(name,path,threshold,opts={}){
  const startedEpoch=performance.now();
  const results=await pool(threshold.requests,threshold.concurrency,async()=>{
    const startedAt=performance.now()-startedEpoch,r=await request(path,opts);
    return {...r,startedAt,finishedAt:performance.now()-startedEpoch};
  });
  return summarize(name,results,threshold);
}

async function waitForSteadyLobby(){
  const cfg=thresholds.readiness,started=Date.now(),batches=[];
  let consecutive=0,attempt=0;
  while(Date.now()-started<cfg.maxWaitMs){
    attempt++;
    const threshold={
      requests:cfg.batchRequests,concurrency:cfg.concurrency,
      minSuccessRate:1,p95Ms:5000,p99Ms:8000,minRps:0
    };
    const result=await bench('lobby-readiness-'+attempt,'/api/rooms',threshold);
    batches.push(result);
    if(result.successRate===1)consecutive++;else consecutive=0;
    if(consecutive>=cfg.consecutiveCleanBatches){
      return {passed:true,waitMs:Date.now()-started,attempts:attempt,consecutiveCleanBatches:consecutive,batches};
    }
    await new Promise(r=>setTimeout(r,250));
  }
  return {passed:false,waitMs:Date.now()-started,attempts:attempt,consecutiveCleanBatches:consecutive,batches};
}
async function cleanup(room,token){
  if(!room||!token)return;
  try{
    const s=await request('/api/rooms/'+room,{token});
    await request('/api/rooms/'+room+'/leave',{method:'POST',token,body:{revision:s.data?.revision}});
  }catch{}
}

async function benchmark(){
  await requireRequest('/api/health');
  await requireRequest('/api/rooms');

  const coldStart=await bench('room-list-cold-start','/api/rooms',thresholds.roomListColdStart);
  const readiness=await waitForSteadyLobby();
  if(!readiness.passed)throw new Error('P21 local Edge/lobby never reached a steady ready state: '+JSON.stringify(readiness));
  const list=await bench('room-list-stable','/api/rooms',thresholds.roomList);
  const probe16=await bench('room-list-probe-c16','/api/rooms',thresholds.roomListProbe16);
  const probe20=await bench('room-list-probe-c20','/api/rooms',thresholds.roomListProbe20);
  await new Promise(r=>setTimeout(r,500));
  const listRecovery=await bench('room-list-post-burst-recovery','/api/rooms',thresholds.roomListRecovery);
  const envelope=[list,probe16,probe20];
  const certifiedLobbyConcurrency=Math.max(
    ...envelope.filter(x=>x.passed===true).map(x=>x.concurrency),
    0
  );
  const room=id('P21POLL');let host='',guest='';
  try{
    const created=(await requireRequest('/api/rooms',{method:'POST',body:{id:room,name:'P21 Poll Host'}})).data;
    host=created.token;
    const joined=(await requireRequest('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P21 Poll Guest'}})).data;
    guest=joined.token;

    const poll=await bench('authorized-room-poll','/api/rooms/'+room,thresholds.roomPoll,{token:host});
    const health=await bench('health-snapshot','/api/health',thresholds.health);

    const raceRoom=id('P21JOIN');
    const raceCreated=(await requireRequest('/api/rooms',{method:'POST',body:{id:raceRoom,name:'P21 Join Race'}})).data;
    const raceStarted=performance.now();
    const joins=await Promise.all(Array.from({length:thresholds.joinRace.attempts},(_,i)=>
      request('/api/rooms/'+raceRoom+'/join',{method:'POST',body:{name:'Racer '+(i+1)}})
    ));
    const joinDuration=performance.now()-raceStarted;
    const players=joins.filter(x=>x.status===200&&x.data?.role==='player');
    const spectators=joins.filter(x=>x.status===200&&x.data?.role==='spectator');
    const join5xx=joins.filter(x=>x.status>=500).length;
    const joinRace={
      attempts:joins.length,players:players.length,spectators:spectators.length,serverErrors:join5xx,
      durationMs:round(joinDuration),
      passed:players.length===thresholds.joinRace.expectedPlayers
        && spectators.length===joins.length-1
        && join5xx===0
        && joinDuration<=thresholds.joinRace.maxDurationMs
    };

    const revision=joined.state.revision,gameVersion=joined.state.gameVersion||1;
    const actionStarted=performance.now();
    const actions=await Promise.all(Array.from({length:thresholds.actionRace.attempts},(_,i)=>
      request('/api/rooms/'+room+'/action',{
        method:'POST',token:host,
        body:{action:'move',i:112,revision,gameVersion,commandId:'p21-race-'+Date.now()+'-'+i}
      })
    ));
    const actionDuration=performance.now()-actionStarted;
    const commits=actions.filter(x=>x.status===200);
    const conflicts=actions.filter(x=>x.status===409);
    const action5xx=actions.filter(x=>x.status>=500).length;
    const actionRace={
      attempts:actions.length,commits:commits.length,conflicts:conflicts.length,serverErrors:action5xx,
      durationMs:round(actionDuration),
      passed:commits.length===thresholds.actionRace.expectedCommits
        && conflicts.length===actions.length-1
        && action5xx===0
        && actionDuration<=thresholds.actionRace.maxDurationMs
    };

    await cleanup(raceRoom,raceCreated.token);
    if(players[0]?.data?.token)await cleanup(raceRoom,players[0].data.token);

    const evidence={
      version:'p21.capacity.v1',
      gitSha:/^[0-9a-f]{40}$/.test(gitSha)?gitSha:null,
      environment:'portable-local-supabase',
      scope:'CI regression and minimum-capacity qualification; not a hosted-production maximum-throughput claim.',
      runner:{
        node:process.version,platform:process.platform,arch:process.arch,
        cpuCount:os.cpus().length,githubRunner:process.env.RUNNER_NAME||null
      },
      thresholds,
      capacityEnvelope:{
        minimumCertifiedLobbyConcurrency:thresholds.minimumCertifiedLobbyConcurrency,
        certifiedLobbyConcurrency,
        coldStart,
        readiness,
        probes:[list,probe16,probe20],
        postBurstRecovery:listRecovery
      },
      scenarios:{roomListColdStart:coldStart,roomList:list,roomListProbe16:probe16,roomListProbe20:probe20,roomListRecovery:listRecovery,roomPoll:poll,health,joinRace,actionRace,workerRestart:null},
      generatedAt:new Date().toISOString()
    };
    evidence.preChaosPassed=certifiedLobbyConcurrency>=thresholds.minimumCertifiedLobbyConcurrency
      && [list,listRecovery,poll,health,joinRace,actionRace].every(x=>x.passed===true);
    evidence.passed=false;
    write(evidence);
    if(!evidence.preChaosPassed)throw new Error('P21 capacity thresholds failed before chaos: '+JSON.stringify(evidence.scenarios));
    console.log(JSON.stringify(evidence,null,2));
  }finally{
    await cleanup(room,guest);
    await cleanup(room,host);
  }
}

async function chaosPrepare(){
  const room=id('P21CHAOS');
  const created=(await requireRequest('/api/rooms',{method:'POST',body:{id:room,name:'P21 Worker Restart'}})).data;
  const joined=(await requireRequest('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P21 Restart Guest'}})).data;
  const moved=(await requireRequest('/api/rooms/'+room+'/action',{
    method:'POST',token:created.token,
    body:{action:'move',i:112,revision:joined.state.revision,gameVersion:joined.state.gameVersion||1,commandId:'p21-chaos-'+Date.now()}
  })).data;
  fs.writeFileSync(chaosPath,JSON.stringify({
    room,hostToken:created.token,guestToken:joined.token,
    expectedRevision:moved.revision,expectedMoves:1
  },null,2)+'\n');
  console.log(JSON.stringify({room,prepared:true,revision:moved.revision}));
}

async function chaosVerify(){
  const fixture=JSON.parse(fs.readFileSync(chaosPath,'utf8'));
  const start=Number(fs.readFileSync('/tmp/p21-chaos-start-ms','utf8').trim());
  const recovered=Number(fs.readFileSync('/tmp/p21-chaos-recovered-ms','utf8').trim());
  const recoveryMs=recovered-start;
  const state=(await requireRequest('/api/rooms/'+fixture.room,{token:fixture.hostToken})).data;
  const preserved=Number(state?.revision)>=Number(fixture.expectedRevision)
    && Array.isArray(state?.game?.moves)
    && state.game.moves.length===fixture.expectedMoves;
  const scenario={
    recoveryMs,roomStatePreserved:preserved,revision:state?.revision??null,
    moves:state?.game?.moves?.length??null,
    passed:recoveryMs>=0&&recoveryMs<=thresholds.workerRestart.maxRecoveryMs&&preserved
  };
  const evidence=read();
  evidence.scenarios.workerRestart=scenario;
  evidence.passed=evidence.preChaosPassed===true&&scenario.passed===true;
  evidence.completedAt=new Date().toISOString();
  write(evidence);
  await cleanup(fixture.room,fixture.guestToken);
  await cleanup(fixture.room,fixture.hostToken);
  console.log(JSON.stringify(evidence,null,2));
  if(!evidence.passed)throw new Error('P21 worker-restart chaos certification failed: '+JSON.stringify(scenario));
}

function summary(){
  const e=read(),s=e.scenarios;
  console.log('### P21 capacity certification');
  console.log('');
  console.log('- Result: **'+(e.passed?'PASS':'FAIL')+'**');
  console.log('- Readiness barrier: '+e.capacityEnvelope.readiness.attempts+' batches · '+e.capacityEnvelope.readiness.waitMs+' ms · passed '+e.capacityEnvelope.readiness.passed);
  console.log('- Certified lobby concurrency: **'+e.capacityEnvelope.certifiedLobbyConcurrency+'** (required floor '+e.capacityEnvelope.minimumCertifiedLobbyConcurrency+')');
  for(const k of ['roomListColdStart','roomList','roomListProbe16','roomListProbe20','roomListRecovery','roomPoll','health']){
    const x=s[k];
    console.log('- '+x.name+': c'+x.concurrency+' · p95 '+x.p95Ms+' ms · p99 '+x.p99Ms+' ms · '+x.throughputRps+' req/s · '+(x.successRate*100).toFixed(2)+'% success'+(x.passed?'':' · saturation/fail'));
  }
  console.log('- Join contention: '+s.joinRace.players+' seat winner / '+s.joinRace.spectators+' spectators · '+s.joinRace.durationMs+' ms');
  console.log('- Action contention: '+s.actionRace.commits+' commit / '+s.actionRace.conflicts+' conflicts · '+s.actionRace.durationMs+' ms');
  console.log('- Worker restart: recovered in '+s.workerRestart.recoveryMs+' ms · state preserved: '+s.workerRestart.roomStatePreserved);
  console.log('');
  console.log('Portable CI qualification only; not a hosted-production maximum-capacity claim.');
}

const mode=String(process.argv[2]||'benchmark');
if(mode==='benchmark')await benchmark();
else if(mode==='chaos-prepare')await chaosPrepare();
else if(mode==='chaos-verify')await chaosVerify();
else if(mode==='summary')summary();
else throw new Error('Usage: node operations/p21-load-capacity.mjs <benchmark|chaos-prepare|chaos-verify|summary>');
