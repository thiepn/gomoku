import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const bootstrap=fs.readFileSync('operations/p18-shared-contract-bootstrap.sql','utf8');
for(const marker of [
  'public.gomoku_rooms',
  'public.gomoku_room_spectators',
  'private.broadcast_gomoku_room_change',
  'gomoku_rooms_realtime_broadcast',
  'public.account_apps',
  'public.account_app_manifests',
  'public.account_app_permissions',
  'public.account_app_connections',
  'public.account_app_grants',
  'public.leaderboard_profiles',
  'public.gomoku_room_spectators',
  'gomoku_room_spectators_last_seen_idx',
  'references auth.users(id)',
  'enable row level security',
  'grant select,insert,update,delete'
]) assert(bootstrap.includes(marker),'P18 compatibility bootstrap missing '+marker);
assert(!bootstrap.includes('hycegznamzjhwinegaai'),'P18 local compatibility bootstrap must not bind to production');
assert(!/insert\s+into\s+auth\.users/i.test(bootstrap),'P18 compatibility bootstrap must not fabricate production identities');
assert(bootstrap.indexOf('create table if not exists public.gomoku_rooms')<bootstrap.indexOf('create table if not exists public.account_apps'),'P18 legacy Gomoku foundation must precede shared account compatibility objects');

const builder=fs.readFileSync('operations/p18-build-portable-workspace.mjs','utf8');
for(const marker of [
  "project_id = \"gomoku-p18-portable\"",
  "'major_version = 17'",
  "20000101000000_p18_shared_contract_bootstrap.sql",
  "preview-p18-local",
  "dependencyOrder",
  "P18 dependency order must be updated for new migrations",
  "dependencyOrderSource:'production-migration-ledger'",
  "portableHead",
  "fs.rmSync(out,{recursive:true,force:true})",
  '20261003_gomoku_p18_portability_admission_gate.sql'
]) assert(builder.includes(marker),'P18 workspace builder missing '+marker);
assert(!builder.includes('writeFileSync(path.join(root,\'supabase\',\'migrations\''),'P18 workspace builder must not mutate canonical migrations');

const hosted=fs.readFileSync('operations/p18-hosted-preview.mjs','utf8');
for(const marker of [
  "previewRef===productionRef",
  'P18_HOSTED_PREVIEW_DB_URL',
  'P18_PRODUCTION_DB_URL',
  "mode==='plan-preview'",
  "mode==='rehearse-preview'",
  "mode==='apply-preview'",
  "mode==='plan-production'",
  "mode==='rehearse-production'",
  "mode==='apply-production'",
  'automatic replay rejects non-transactional SQL'
]) assert(hosted.includes(marker),'P18 hosted preview client missing '+marker);
for(const forbidden of ['db reset --linked','supabase db push','/branches/','/merge'])
  assert(!hosted.includes(forbidden),'P18 hosted preview must not use '+forbidden);

const fixture=fs.readFileSync('operations/p18-local-fixture.mjs','utf8');
for(const marker of ['P18-DR-FIXTURE','create','verify','Recovered fixture room is missing'])
  assert(fixture.includes(marker),'P18 recovery fixture missing '+marker);

const retryContract=fs.readFileSync('operations/p18-retry-contract.mjs','utf8');
for(const marker of ['invalid response was received from the upstream server','502|503','spawnSync','attempts'])
  assert(retryContract.includes(marker),'P18 transient contract retry missing '+marker);
assert(retryContract.includes("if(!transient||attempt===attempts)"),'P18 retry must fail closed on non-transient errors');

const workflow=fs.readFileSync('.github/workflows/p18-portability-recovery.yml','utf8');
for(const marker of [
  'portable-preview:',
  'version: 2.119.0',
  'Build isolated portable Supabase workspace',
  'supabase start',
  'supabase db lint --local --fail-on error',
  'Exercise isolated candidate',
  'Portable Supabase application surfaces did not become ready.',
  '/api/rooms',
  'gomoku-room local Edge log',
  'docker run --rm --network host',
  'postgres:17',
  'pg_dump "$P18_LOCAL_DB_URL"',
  '--table="public.gomoku_*"',
  '--exclude-table-data=public.gomoku_slo_samples',
  '--exclude-table-data=public.gomoku_slo_alert_state',
  'if [ -d .p18-portable ]; then',
  'supabase stop --no-backup',
  'Rebuild environment from zero',
  "sh -ec 'psql \"$DB_URL\" -X -v ON_ERROR_STOP=1 -f /backup/p18-local-data.sql'",
  'Verify disaster-recovery restore',
  'api_base="${GOMOKU_ROOM_API%/functions/v1/gomoku-room}"',
  'Recovered Supabase application surfaces did not become ready.',
  'not-a-real-account-jwt',
  'recovered gomoku-room Edge log',
  'node operations/p18-retry-contract.mjs online/test-ranked.mjs',
  'node operations/p18-retry-contract.mjs online/test-player-profiles.mjs',
  'encrypted-production-backup:',
  'P18_PRODUCTION_DB_URL',
  'P18_BACKUP_PASSPHRASE',
  '--table="public.gomoku_*"',
  '--exclude-table-data=public.gomoku_slo_samples',
  '--exclude-table-data=public.gomoku_slo_alert_state',
  'openssl enc -aes-256-cbc -salt -pbkdf2 -iter 250000',
  'rm -f /tmp/gomoku-data.dump',
  '/tmp/gomoku-data.dump.enc'
]) assert(workflow.includes(marker),'P18 workflow missing '+marker);
for(const forbidden of [
  'supabase db reset --linked',
  'supabase db push',
  '/tmp/gomoku-data.dump\n          retention-days'
]) assert(!workflow.includes(forbidden),'P18 workflow contains unsafe marker '+forbidden);
assert(!workflow.includes('--disable-triggers'),'P18 restore must keep FK/system-trigger enforcement active');

const admissionMigration=fs.readFileSync('supabase/migrations/20261003_gomoku_p18_portability_admission_gate.sql','utf8');
for(const marker of ['gomoku_p16_required_checks',"'p18_portability'",'security invoker'])
  assert(admissionMigration.toLowerCase().includes(marker.toLowerCase()),'P18 durable admission gate missing '+marker);
assert(!admissionMigration.toLowerCase().includes('security definer'),'P18 durable admission gate must remain SECURITY INVOKER');

const p16Wait=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(p16Wait.includes("p18_portability:'portable-preview'"),'P16 admission must wait for P18 portable preview');

const p17Control=fs.readFileSync('operations/p17-release-control.mjs','utf8');
assert(p17Control.includes("process.env.P17_ENVIRONMENT_SOURCE||'supabase_branch'"),'P17 must support dedicated-project environment registration');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
assert(backend.includes("phase:'P18'"),'P18 runtime phase marker missing');

const runbook=fs.readFileSync('operations/P18-RUNBOOK.md','utf8');
for(const marker of [
  'THIEPN Core',
  'synthetic data only',
  'unencrypted production backup artifacts are forbidden',
  'P18_PRODUCTION_DB_URL',
  'P18_BACKUP_PASSPHRASE',
  'qualification gate',
  'does not duplicate or exfiltrate the shared Auth database'
]) assert(runbook.includes(marker),'P18 runbook missing '+marker);

console.log('PASS P18: portable local preview, dedicated-project portability, encrypted free-plan backup and destructive local restore rehearsal are fail-closed without weakening P16/P17 governance.');
