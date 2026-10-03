import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const migration=fs.readFileSync('supabase/migrations/20261003105645_gomoku_p20_production_slos_error_budgets.sql','utf8');
for(const marker of [
  'gomoku_slo_samples',
  'gomoku_slo_alert_state',
  'gomoku_p20_slo_definitions',
  'gomoku_p20_capture_slo_sample',
  'gomoku_p20_slo_snapshot',
  'gomoku_p20_release_guard',
  'gomoku_p20_public_status',
  'gomoku_p20_admin_summary',
  "'service_availability'::text,0.999::numeric",
  "'persistence_freshness'::text,0.999::numeric",
  "'recovery_freshness'::text,0.999::numeric",
  "'runtime_clean_minutes'::text,0.990::numeric",
  "v_bad>=2 then 'warning'",
  "v_bad>=5 then 'critical'",
  "interval '30 minutes'",
  "v_fast_burn>=14.4",
  "samples>=60",
  "jobname='gomoku-p20-slo-sample'"
]) assert(migration.includes(marker),'P20 migration missing '+marker);

assert(!migration.toLowerCase().includes('security definer'),'P20 must not use SECURITY DEFINER');
for(const role of ['public','anon','authenticated']){
  assert(!new RegExp('grant\\s+.+gomoku_slo_(samples|alert_state).+to\\s+'+role,'i').test(migration),'P20 table leaked to '+role);
}
assert(migration.includes('revoke all on table public.gomoku_slo_samples from public,anon,authenticated,service_role'),'P20 sample grants are not reset');
assert(migration.includes('revoke all on table public.gomoku_slo_alert_state from public,anon,authenticated,service_role'),'P20 alert grants are not reset');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'rpc/gomoku_p20_release_guard',
  'rpc/gomoku_p20_public_status',
  'rpc/gomoku_p20_admin_summary',
  "release_certification_blocked",
  "p17_production_certification_blocked",
  "phase:'P20'",
  'sloGuard?.allowed!==true'
]) assert(backend.includes(marker),'P20 Edge integration missing '+marker);

const consoleJs=fs.readFileSync('operations/p15-console.js','utf8');
new Function(consoleJs);
for(const marker of ['P20 PRODUCTION SLOS','Error budgets & release guard','sloMarkup(o)',"version:'1.3.0'"])
  assert(consoleJs.includes(marker),'P20 operator console missing '+marker);

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(waiter.includes("p20_slo_governance:'p20-slo'"),'P16 admission does not require P20');

const portable=fs.readFileSync('operations/p18-build-portable-workspace.mjs','utf8');
assert(portable.includes('20261003105645_gomoku_p20_production_slos_error_budgets.sql'),'P18 portable migration order omits P20');

const workflow=fs.readFileSync('.github/workflows/verify-p20-slo.yml','utf8');
for(const marker of ['name: p20-slo','contents: read','online/test-p20-slo.mjs'])
  assert(workflow.includes(marker),'P20 workflow missing '+marker);

const runbook=fs.readFileSync('operations/P20-RUNBOOK.md','utf8');
for(const marker of ['99.9%','99.0%','1h / 24h / 7d','30-minute','release guard','database write to every player request','P21'])
  assert(runbook.includes(marker),'P20 runbook missing '+marker);

console.log('PASS P20: minute-level SLO evidence, deduplicated alerts, error budgets, operator visibility and production release guard are wired without per-request telemetry amplification.');
