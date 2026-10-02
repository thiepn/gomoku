import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const client=fs.readFileSync('online/p8-competition.js','utf8');
new Function(client);
for(const marker of [
  'Competitive recovery',
  'Automatic reconciliation',
  "version:'6.0.0'",
  '/api/health'
]) assert(client.includes(marker),'P13 client source missing '+marker);

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'persistMatchSnapshotRecoverable',
  'queueMatchRecovery',
  'matchPersistenceStatus',
  'async function reliabilityHealth',
  "parts[1]==='health'",
  'broadcast_failed',
  "requestId='GR-'",
  'gomoku_match_persistence_outbox'
]) assert(backend.includes(marker),'P13 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p13_reliability_observability_recovery.sql','utf8');
for(const marker of [
  'gomoku_match_persistence_outbox',
  'gomoku_runtime_events',
  'gomoku_capture_completed_match_outbox',
  'gomoku_process_match_outbox',
  'gomoku_reliability_tick',
  'gomoku_reliability_snapshot',
  'gomoku-p13-reliability-tick'
]) assert(migration.includes(marker),'P13 migration missing '+marker);

const builder=fs.readFileSync('online/build-p8-client.py','utf8');
for(const marker of [
  'retryRoomConnection',
  'recoveryFailures',
  'Math.pow(2',
  'Result secured for recovery',
  'p17-preview-promotion'
]) assert(builder.includes(marker),'P13 builder missing '+marker);

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'Competitive recovery',
  'Retry now',
  'Result secured for recovery',
  'recoveryFailures',
  "version:'6.0.0'"
]) assert(html.includes(marker),'generated P13 index missing '+marker);

const htmlConfig=fs.readFileSync('index.html','utf8');
const projectUrl=(htmlConfig.match(/const ROOM_PROJECT_URL='([^']+)'/)||[])[1];
const apiBase=projectUrl?projectUrl+'/functions/v1/gomoku-room':null;
const apiKey=(htmlConfig.match(/const ROOM_API_KEY='([^']+)'/)||[])[1];
assert(apiBase&&apiKey,'generated room API configuration missing');
const healthRes=await fetch(apiBase+'/api/health',{headers:{apikey:apiKey}});
const health=await healthRes.json();
assert(healthRes.ok,'live health endpoint returned '+healthRes.status+' '+JSON.stringify(health));
assert(health.service==='gomoku-room'&&['P13','P14','P15','P16','P17','P18'].includes(health.phase),'live health identity/version mismatch');
assert(['healthy','degraded','critical','maintenance'].includes(health.status),'live health status invalid');
assert(health.persistence&&Number.isFinite(Number(health.persistence.pending)),'live health persistence telemetry missing');
const publicHealth=JSON.stringify(health);
for(const forbidden of ['user_id','username','room_id','reporter','target_user'])assert(!publicHealth.includes(forbidden),'live health leaked private identifiers');

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.4.0-p17-preview-promotion-analysis-2.1.0-review-ux-2.1.0'),'P13 service-worker cache not active');

assert(client.includes('Fair Play center'),'P12 trust UI regressed');
assert(backend.includes('async function trustReport'),'P12 trust API regressed');

console.log('PASS P13: durable recovery, health telemetry, reconnect backoff, manual retry, persistence UX and P12 regression markers.');
