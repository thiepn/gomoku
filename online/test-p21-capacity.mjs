import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const migration=fs.readFileSync('supabase/migrations/20261003120500_gomoku_p21_capacity_admission_gate.sql','utf8');
for(const marker of [
  'gomoku_p16_required_checks',
  'gomoku_p21_lobby_snapshot',
  'jsonb_array_elements',
  'gomoku_room_player_presence',
  'gomoku_room_spectators',
  "coalesce(r.state->>'mode'='ranked',false)",
  "coalesce(r.state->>'mode'='tournament',false)",
  "'p18_portability'",
  "'p19_supply_chain'",
  "'p20_slo_governance'",
  "'p21_capacity'",
  'security invoker',
  'grant execute on function public.gomoku_p16_required_checks()'
]) assert(migration.toLowerCase().includes(marker.toLowerCase()),'P21 admission migration missing '+marker);
assert(!migration.toLowerCase().includes('security definer'),'P21 admission migration must not use SECURITY DEFINER');

const load=fs.readFileSync('operations/p21-load-capacity.mjs','utf8');
for(const marker of [
  'roomListColdStart:{requests:36,concurrency:4',
  'readiness:{batchRequests:12,concurrency:4,consecutiveCleanBatches:3,maxWaitMs:20000',
  'roomList:{requests:240,concurrency:12',
  'roomListProbe16:{requests:180,concurrency:16',
  'roomListProbe20:{requests:180,concurrency:20',
  'roomListRecovery:{requests:60,concurrency:4',
  'minimumCertifiedLobbyConcurrency:12',
  'roomPoll:{requests:120,concurrency:12',
  'health:{requests:40,concurrency:8',
  'joinRace:{attempts:12',
  'actionRace:{attempts:8',
  'workerRestart:{maxRecoveryMs:30000',
  'shutdownDetectionMs=down-injected',
  'recoveryMs=recovered-down',
  'room-list-cold-start',
  'waitForSteadyLobby',
  'consecutiveCleanBatches',
  'capacityEnvelope',
  'certifiedLobbyConcurrency',
  'postBurstRecovery',
  'preChaosPassed',
  'roomStatePreserved',
  'portable-local-supabase',
  'not a hosted-production maximum-throughput claim'
]) assert(load.includes(marker),'P21 load harness missing '+marker);
assert(!load.includes('hycegznamzjhwinegaai'),'P21 load harness must not contain the production project ref');
assert(!/https:\/\//.test(load),'P21 load harness must require an injected local API instead of a production fallback');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'LOBBY_MAINTENANCE_INTERVAL_MS=10_000',
  'lobbyMaintenancePromise:Promise<void>|null',
  "runtimeEvent('warning','lobby_maintenance','maintenance_failed'",
  'async function listRooms(){await maintainLobby();',
  "rpc/gomoku_p21_lobby_snapshot"
]) assert(backend.includes(marker),'P21 lobby maintenance hardening missing '+marker);
assert(!backend.includes("async function listRooms(){await rest('gomoku_rooms?expires_at=lt."),'Lobby reads must not launch duplicate global cleanup work');
assert(!backend.includes("const [rows,spectators,presenceRows]=await Promise.all"),'Lobby reads must not fan out to three backend reads per request');

const workflow=fs.readFileSync('.github/workflows/verify-p21-capacity.yml','utf8');
for(const marker of [
  'name: p21-capacity',
  'P18_WORKSPACE: .p21-portable',
  'supabase start',
  'supabase functions serve gomoku-room --no-verify-jwt',
  'node operations/p21-load-capacity.mjs benchmark',
  'node operations/p21-load-capacity.mjs chaos-prepare',
  'Inject Edge worker restart and verify recovery',
  '/tmp/p21-chaos-injected-ms',
  '/tmp/p21-chaos-down-ms',
  '/tmp/p21-chaos-recovered-ms',
  'node operations/p21-load-capacity.mjs chaos-verify',
  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  'retention-days: 14'
]) assert(workflow.includes(marker),'P21 workflow missing '+marker);
assert(!workflow.includes('P18_PRODUCTION_DB_URL'),'P21 must not use a production database credential');
assert(!workflow.includes('hycegznamzjhwinegaai'),'P21 workflow must not target production');
assert(!workflow.includes('id-token: write'),'P21 portable load job must not receive an OIDC write token');

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(waiter.includes("p21_capacity:'p21-capacity'"),'P16 exact-SHA admission does not wait for P21');
const timeoutMatch=waiter.match(/\|\|(\d+)\*60_000/);
assert(timeoutMatch&&Number(timeoutMatch[1])>=22,'P16 waiter timeout must remain at least 22 minutes for portable capacity qualification');

const release=fs.readFileSync('operations/p16-release-control.mjs','utf8');
for(const marker of ['p18_portability','p19_supply_chain','p20_slo_governance','p21_capacity'])
  assert(release.includes("'"+marker+"'"),'P16 admission preflight missing '+marker);

const portable=fs.readFileSync('operations/p18-build-portable-workspace.mjs','utf8');
assert(portable.includes('20261003120500_gomoku_p21_capacity_admission_gate.sql'),'P18 portable migration order omits P21');

const p16Workflow=fs.readFileSync('.github/workflows/p16-release-control.yml','utf8');
assert((p16Workflow.match(/verify-p21-capacity\.yml/g)||[]).length===2,'P16 pull/push path filters must include P21 workflow');
assert(p16Workflow.includes('timeout-minutes: 30'),'P16 qualification timeout was not expanded for P21');

const supply=fs.readFileSync('operations/p19-supply-chain-policy.mjs','utf8');
assert(supply.includes("p21_capacity:'p21-capacity'"),'P19 policy does not protect the P21 admission dependency');

const runbook=fs.readFileSync('operations/P21-RUNBOOK.md','utf8');
for(const marker of ['p50 / p95 / p99','240 room-list requests','concurrency 16 and 20','12 simultaneous seat claims','8 simultaneous move commands','worker restart','zero production traffic','not a hosted-production capacity claim','P16'])
  assert(runbook.includes(marker),'P21 runbook missing '+marker);

console.log('PASS P21 contracts: portable load, concurrency races, worker-restart chaos, evidence artifacts and durable P16 capacity admission are wired without production load.');
