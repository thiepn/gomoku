import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const migration=fs.readFileSync('supabase/migrations/20261002163100_gomoku_p17_release_environments_preview_promotion.sql','utf8');
for(const marker of [
  'gomoku_release_environments',
  'gomoku_repo_schema_state',
  'gomoku_repo_migration_events',
  'gomoku_preview_certifications',
  'gomoku_schema_promotion_authorizations',
  'gomoku_schema_promotion_events',
  'gomoku_p17_required_preview_checks',
  'gomoku_p17_environment_probe',
  'gomoku_p17_set_local_schema_state',
  'gomoku_p17_record_preview_certification',
  'gomoku_p17_authorize_schema_promotion',
  'gomoku_p17_record_promotion_event',
  'gomoku_p17_public_status',
  'gomoku_p17_admin_summary',
  "interval '72 hours'",
  "interval '2 hours'",
  'p17-preview-promotion.yml@refs/heads/main'
]) assert(migration.includes(marker),'P17 migration missing '+marker);

for(const forbidden of [
  'security definer',
  'grant select on table public.gomoku_preview_certifications to authenticated',
  'grant select on table public.gomoku_schema_promotion_authorizations to authenticated',
  'grant update on table public.gomoku_preview_certifications to service_role',
  'grant update on table public.gomoku_schema_promotion_authorizations to service_role',
  'grant update on table public.gomoku_schema_promotion_events to service_role'
]) assert(!migration.toLowerCase().includes(forbidden.toLowerCase()),'P17 security regression: '+forbidden);

const healthIsolation=fs.readFileSync('supabase/migrations/20261002152600_gomoku_p17_certification_health_isolation.sql','utf8');
for(const marker of [
  "component is distinct from 'production_certification'",
  "'releaseControl15m'",
  "'certificationErrors'",
  'security invoker'
]) assert(healthIsolation.toLowerCase().includes(marker.toLowerCase()),'P17 certification health isolation missing '+marker);
assert(!healthIsolation.toLowerCase().includes('security definer'),'P17 health isolation must remain SECURITY INVOKER');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  "GITHUB_TRUSTED_WORKFLOW_P17='thiepn/gomoku/.github/workflows/p17-preview-promotion.yml@refs/heads/main'",
  'async function p17EnvironmentProbe',
  'async function automationP17Environment',
  'async function automationP17SchemaState',
  'async function automationP17MigrationEvent',
  'async function automationP17PreviewCertification',
  'async function automationP17AuthorizePromotion',
  'async function automationP17PromotionEvent',
  'async function automationP17ProductionDeployment',
  'async function automationP17ProductionCertify',
  "parts[1]==='environment'",
  "parts[3]==='preview-certification'",
  "phase:'P18'",
  'rpc/gomoku_p17_public_status'
]) assert(backend.includes(marker),'P17 backend missing '+marker);

const manifest=fs.readFileSync('operations/p17-manifest.mjs','utf8');
for(const marker of ['schemaManifestSha256','edgeManifestSha256','releaseManifestSha256','migrationCount','crypto.createHash'])
  assert(manifest.includes(marker),'P17 manifest generator missing '+marker);

const control=fs.readFileSync('operations/p17-release-control.mjs','utf8');
for(const marker of ['register-environment','schema-state','preview-certification','authorize-promotion','production-deployment','production-certify','gomoku-production-control','P17_ENVIRONMENT_SOURCE'])
  assert(control.includes(marker),'P17 OIDC control client missing '+marker);

const branch=fs.readFileSync('operations/p17-supabase-branch.mjs','utf8');
for(const marker of [
  '/v1/projects/',
  '/api-keys?reveal=true',
  'POSTGRES_URL_NON_POOLING',
  "mode==='resolve'",
  "management('/v1/projects/'+productionRef+'/branches')",
  "mode==='rehearse'",
  "mode==='apply'",
  "'begin;\\n'+sql+'\\nrollback;'",
  '/v1/branches/',
  '/merge',
  'create\\s+index\\s+concurrently'
]) assert(branch.includes(marker),'P17 branch client missing '+marker);

const admissionWait=fs.readFileSync('operations/p17-await-admission.mjs','utf8');
for(const marker of ["x?.name==='qualify'",'P16 admission qualifier succeeded','check-runs?per_page=100'])
  assert(admissionWait.includes(marker),'P17 admission waiter missing '+marker);

const workflow=fs.readFileSync('.github/workflows/p17-preview-promotion.yml','utf8');
for(const marker of [
  'SUPABASE_PROJECT_ID: hycegznamzjhwinegaai',
  'P17_PREVIEW_BRANCH_NAME: gomoku-preview',
  'Resolve hosted preview mode',
  'P17_ENABLE_BRANCHING',
  'P18_HOSTED_PREVIEW_PROJECT_ID',
  'SUPABASE_ACCESS_TOKEN',
  'Wait for exact-SHA P16 admission',
  'node operations/p17-await-admission.mjs',
  'supabase --experimental branches get',
  'Plan dedicated preview',
  'rehearse-preview',
  'apply-preview',
  "BUILD_CHANNEL='preview-p18-hosted'",
  'Exercise isolated hosted preview contracts',
  'Certify hosted preview release',
  'Authorize exact production promotion',
  'Merge certified Supabase branch schema',
  'Apply certified dedicated-preview schema to production',
  'Deploy certified Edge Function to production',
  'Certify promoted production',
  'Preserve fail-closed promotion evidence'
]) assert(workflow.includes(marker),'P17/P18 hosted promotion workflow missing '+marker);

const p16=fs.readFileSync('.github/workflows/p16-release-control.yml','utf8');
assert(p16.includes('delegated_to_p17'),'P16 production deployment must be delegated to P17');
assert(!p16.includes('supabase functions deploy gomoku-room'),'P16 must not bypass P17 preview certification with direct Edge deployment');

const consoleJs=fs.readFileSync('operations/p15-console.js','utf8');
new Function(consoleJs);
for(const marker of ['P17 RELEASE ENVIRONMENTS','Preview certification & safe promotion','releaseEnvironmentMarkup',"version:'1.2.0'"])
  assert(consoleJs.includes(marker),'P17 operations console missing '+marker);

const builder=fs.readFileSync('online/build-p8-client.py','utf8');
assert(builder.includes('gomoku-v12.4.0-p17-preview-promotion-analysis-2.1.0-review-ux-2.1.0'),'P17 cache version missing');

const runbook=fs.readFileSync('operations/P17-RUNBOOK.md','utf8');
for(const marker of [
  'Qualified ≠ preview-certified ≠ promotion-authorized ≠ promoted ≠ production-certified',
  '$0.01344/hour',
  'MIGRATIONS_FAILED',
  'repo-scoped manifest',
  'gomoku-preview',
  'BEGIN … ROLLBACK',
  'Supabase Branching merge',
  'does not use ordinary db push'
]) assert(runbook.includes(marker),'P17 runbook missing '+marker);

console.log('PASS P17: isolated release environments, deterministic manifests, rollback rehearsal, preview certification and exact-manifest branch promotion are fail-closed and preserve P16/P15 governance.');
