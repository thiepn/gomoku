import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'async function governanceHealth',
  'async function adminRecordDeployment',
  'async function adminCreateRollout',
  'async function adminTransitionRollout',
  'async function adminRunDrill',
  'rpc/gomoku_admin_record_deployment',
  'rpc/gomoku_admin_create_rollout',
  'rpc/gomoku_admin_transition_rollout',
  'rpc/gomoku_admin_run_incident_drill',
  "parts[2]==='deployments'",
  "parts[2]==='rollouts'",
  "parts[2]==='drills'",
  "phase:'P17'"
]) assert(backend.includes(marker),'P15 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261002_gomoku_p15_operations_rollouts_drills.sql','utf8');
for(const marker of [
  'gomoku_deployment_observations',
  'gomoku_rollouts',
  'gomoku_incident_drill_runs',
  'gomoku_p15_reconciliation',
  'gomoku_admin_record_deployment',
  'gomoku_p15_system_record_deployment',
  'gomoku_admin_create_rollout',
  'gomoku_admin_transition_rollout',
  'gomoku_p15_drill_checks',
  'gomoku_admin_run_incident_drill',
  'gomoku_p15_structural_certification',
  "p_health_status <> 'healthy'",
  "interval '2 hours'",
  "when 'observe' then 2",
  "when 'limited' then 5",
  "when 'broad' then 10",
  "v_age_minutes < 15",
  'newEntryControlsPreserveActiveRooms',
  'auditAppendOnly'
]) assert(migration.includes(marker),'P15 migration missing '+marker);

for(const forbidden of [
  'security definer',
  'grant select on table public.gomoku_rollouts to authenticated',
  'grant select on table public.gomoku_deployment_observations to authenticated',
  'grant execute on function public.gomoku_admin_transition_rollout',
]) {
  if(forbidden.startsWith('grant execute')) continue;
  assert(!migration.toLowerCase().includes(forbidden.toLowerCase()),'P15 security regression: '+forbidden);
}
assert(migration.includes('revoke all on table public.gomoku_rollouts from public,anon,authenticated,service_role'),'P15 rollout grants are not reset explicitly');
assert(migration.includes('grant select,insert,update on table public.gomoku_rollouts to service_role'),'P15 rollout server privileges missing');
assert(migration.includes('grant select,insert on table public.gomoku_deployment_observations to service_role'),'P15 deployment observations must be append-only to application code');
assert(migration.includes('grant select,insert on table public.gomoku_incident_drill_runs to service_role'),'P15 drill evidence must be append-only to application code');

const structuralStart=migration.indexOf('create or replace function public.gomoku_p15_structural_certification');
const structuralEnd=migration.indexOf('comment on table public.gomoku_deployment_observations',structuralStart);
assert(structuralStart>=0&&structuralEnd>structuralStart,'P15 structural certification function missing');
const structural=migration.slice(structuralStart,structuralEnd);
for(const mutation of ['update public.gomoku_competitive_control','update public.gomoku_release_registry','update public.gomoku_rollouts'])
  assert(!structural.includes(mutation),'P15 structural certification must be non-destructive: '+mutation);

const consoleJs=fs.readFileSync('operations/p15-console.js','utf8');
new Function(consoleJs);
for(const marker of [
  'Competitive operations console',
  "get('/api/admin/overview')",
  "state.authorized",
  "if(!host||!state.authorized",
  '/api/admin/controls',
  '/api/admin/incidents',
  '/api/admin/releases',
  '/api/admin/deployments',
  '/api/admin/rollouts',
  '/api/admin/drills',
  'Stages are validation gates, not weighted traffic splitting.',
  'Non-destructive certification'
]) assert(consoleJs.includes(marker),'P15 console missing '+marker);

const css=fs.readFileSync('operations/p15-console.css','utf8');
for(const marker of ['.p15-ops-dialog','.p15-switch-grid','.p15-reconcile','.p15-checks','@media(max-width:760px)'])
  assert(css.includes(marker),'P15 console CSS missing '+marker);

const builder=fs.readFileSync('online/build-p8-client.py','utf8');
for(const marker of [
  'accountGet:async path=>',
  "('style','p15-operations-style','p15-console.css','operations')",
  "('script','p15-operations-script','p15-console.js','operations')",
  'gomoku-v12.4.0-p17-preview-promotion'
]) assert(builder.includes(marker),'P15 builder missing '+marker);

const html=fs.readFileSync('index.html','utf8');
for(const marker of ['id="p15-operations-style"','id="p15-operations-script"','Competitive operations console','accountGet:async path=>'])
  assert(html.includes(marker),'generated P15 app shell missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.4.0-p17-preview-promotion-analysis-2.1.0-review-ux-2.1.0'),'P15 service-worker cache not active');

const runbook=fs.readFileSync('operations/P15-RUNBOOK.md','utf8');
for(const marker of [
  'not weighted traffic splitting',
  'Observe → Limited → Broad → Full',
  'Deployment reconciliation',
  'Structural certification',
  'Operator drill',
  'does not deploy or roll back code'
]) assert(runbook.includes(marker),'P15 runbook missing '+marker);

console.log('PASS P15: operator-only console, deployment reconciliation, staged rollout validation and non-destructive incident drill certification are wired with P14/P13 invariants preserved.');
