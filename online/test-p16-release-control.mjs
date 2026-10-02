import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  "import { BUILD_GIT_SHA, BUILD_CHANNEL } from './build-meta.ts'",
  "GITHUB_OIDC_AUDIENCE='gomoku-production-control'",
  "GITHUB_TRUSTED_REPOSITORY='thiepn/gomoku'",
  "GITHUB_TRUSTED_REPOSITORY_ID='1364049991'",
  "GITHUB_TRUSTED_WORKFLOW='thiepn/gomoku/.github/workflows/p16-release-control.yml@refs/heads/main'",
  'async function verifiedGithubAutomation',
  'crypto.subtle.verify',
  'rpc/gomoku_p16_consume_oidc_jti',
  'async function automationAdmission',
  'async function automationOrchestration',
  'async function automationDeployment',
  'async function automationCertify',
  "parts[1]==='automation'",
  "phase:'P16'",
  'rpc/gomoku_p16_public_status',
  "build:{gitSha:BUILD_GIT_SHA,channel:BUILD_CHANNEL}"
]) assert(backend.includes(marker),'P16 backend missing '+marker);

const nullFix=fs.readFileSync('supabase/migrations/20261002_gomoku_p16_certification_null_fix.sql','utf8');
assert(nullFix.includes("'noActiveIncident',v_operations->>'incident' is null"),'P16 corrective certification must treat JSON null incident as no active incident');
assert(!nullFix.toLowerCase().includes('security definer'),'P16 corrective certification must remain SECURITY INVOKER');

const buildMeta=fs.readFileSync('supabase/functions/gomoku-room/build-meta.ts','utf8');
assert(buildMeta.includes("BUILD_GIT_SHA='SOURCE'"),'P16 source build metadata must not impersonate a deployed immutable SHA');

const migration=fs.readFileSync('supabase/migrations/20261002_gomoku_p16_release_admission_orchestration.sql','utf8');
for(const marker of [
  'gomoku_release_evidence',
  'gomoku_release_admissions',
  'gomoku_orchestration_events',
  'gomoku_production_certifications',
  'gomoku_automation_oidc_jti',
  'gomoku_p16_required_checks',
  'gomoku_p16_consume_oidc_jti',
  'gomoku_p16_record_qualification',
  'gomoku_p16_record_orchestration',
  'gomoku_p16_record_deployment',
  'gomoku_p16_certify_production',
  'gomoku_p16_public_status',
  'gomoku_p16_admin_summary',
  'Release approval requires a passing P16 automated admission',
  'Release activation requires a passing P16 production certification',
  'Rollout creation requires a passing P16 automated admission',
  "'latestDeploymentMatchesBuild'",
  "'noActiveIncident',v_operations->>'incident' is null",
  "'structuralControlsPassed'"
]) assert(migration.includes(marker),'P16 migration missing '+marker);

for(const forbidden of [
  'security definer',
  'grant select on table public.gomoku_release_evidence to authenticated',
  'grant select on table public.gomoku_release_admissions to authenticated',
  'grant select on table public.gomoku_orchestration_events to authenticated',
  'grant select on table public.gomoku_production_certifications to authenticated',
  'grant select on table public.gomoku_automation_oidc_jti to authenticated',
  'grant update on table public.gomoku_release_evidence to service_role',
  'grant update on table public.gomoku_release_admissions to service_role',
  'grant update on table public.gomoku_orchestration_events to service_role',
  'grant update on table public.gomoku_production_certifications to service_role'
]) assert(!migration.toLowerCase().includes(forbidden.toLowerCase()),'P16 security regression: '+forbidden);

for(const marker of [
  'revoke all on table public.gomoku_release_evidence from public,anon,authenticated,service_role',
  'grant select,insert on table public.gomoku_release_evidence to service_role',
  'revoke all on sequence public.gomoku_release_evidence_id_seq from public,anon,authenticated,service_role',
  'grant usage,select on sequence public.gomoku_release_evidence_id_seq to service_role'
]) assert(migration.includes(marker),'P16 append-only privilege contract missing '+marker);

const control=fs.readFileSync('operations/p16-release-control.mjs','utf8');
new Function(control.replace(/^import process from 'node:process';/m,'const process={env:{},argv:[]};'));
for(const marker of [
  "AUDIENCE='gomoku-production-control'",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "mode==='admit'",
  "mode==='deployment'",
  "mode==='certify'",
  "live?.build?.gitSha!==sha",
  "Release admission was not granted"
]) assert(control.includes(marker),'P16 GitHub control client missing '+marker);

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
for(const marker of [
  'p15_operations',
  'p14_governance',
  'p13_reliability',
  "ranked:'ranked'",
  "lifecycle:'lifecycle'",
  "history:'history'",
  "profiles:'profiles'",
  "integrity:'integrity'",
  'checkRunId',
  '/check-runs?per_page=100'
]) assert(waiter.includes(marker),'P16 authoritative check aggregator missing '+marker);

const workflow=fs.readFileSync('.github/workflows/p16-release-control.yml','utf8');
for(const marker of [
  'id-token: write',
  "cron: '17 */6 * * *'",
  'node online/test-p16-release-control.mjs',
  'node operations/p16-await-checks.mjs',
  'checks: read',
  'P16_EVIDENCE_FILE: /tmp/p16-check-evidence.json',
  'node operations/p16-release-control.mjs admit',
  'controlled_schema_apply_required',
  'missing_supabase_access_token',
  'supabase functions deploy gomoku-room',
  "BUILD_GIT_SHA='$GITHUB_SHA'",
  'node operations/p16-release-control.mjs deployment',
  'node operations/p16-release-control.mjs certify'
]) assert(workflow.includes(marker),'P16 workflow missing '+marker);
assert(!workflow.includes('supabase db push'),'P16 must not blindly push schema migrations from an unreconciled migration history');

const consoleJs=fs.readFileSync('operations/p15-console.js','utf8');
new Function(consoleJs);
for(const marker of ['P16 RELEASE CONTROL','Admission & continuous certification','releaseAutomationMarkup','driftState',"version:'1.1.0'"])
  assert(consoleJs.includes(marker),'P16 operations console missing '+marker);

const builder=fs.readFileSync('online/build-p8-client.py','utf8');
assert(builder.includes('gomoku-v12.3.0-p16-release-control-analysis-2.1.0-review-ux-2.1.0'),'P16 cache version missing');

const html=fs.readFileSync('index.html','utf8');
for(const marker of ['P16 RELEASE CONTROL','Admission & continuous certification'])
  assert(html.includes(marker),'generated P16 operations console missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.3.0-p16-release-control-analysis-2.1.0-review-ux-2.1.0'),'P16 service-worker cache missing');

const runbook=fs.readFileSync('operations/P16-RUNBOOK.md','utf8');
for(const marker of [
  'Candidate qualified ≠ deployed ≠ certified',
  'GitHub OIDC',
  'Schema gate',
  'Edge-only deployment',
  'Continuous certification',
  'SUPABASE_ACCESS_TOKEN',
  'does not grant operator authority'
]) assert(runbook.includes(marker),'P16 runbook missing '+marker);

console.log('PASS P16: immutable release admission, OIDC orchestration, runtime provenance, drift detection and continuous production certification are wired without converting automation into operator authority.');
