import fs from 'node:fs';

const assert=(value,message)=>{if(!value)throw new Error(message);};

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  "type AdminRole='operator'|'incident_commander'|'release_manager'|'admin'",
  'async function operationalStatus',
  'async function assertEntryEnabled',
  'async function adminOperator',
  'async function adminOverview',
  'async function adminControls',
  'async function adminCreateIncident',
  'async function adminUpdateIncident',
  'async function adminRegisterRelease',
  'async function adminTransitionRelease',
  "await assertEntryEnabled('ranked')",
  "await assertEntryEnabled('tournaments')",
  "await assertEntryEnabled('challenges')",
  "await assertEntryEnabled('roomCreation')",
  "if(action==='accept')await assertEntryEnabled('challenges')",
  "parts[1]==='admin'",
  "phase:'P17'",
  'rpc/gomoku_public_operational_status',
  'rpc/gomoku_admin_operator'
]) assert(backend.includes(marker),'P14 backend missing '+marker);

assert(!backend.includes("await assertEntryEnabled('tournaments');const account=await verifiedAccount(req,true),clean=cleanTournamentId(id);if(!clean"),
  'P14 must not gate active tournament play');
const playStart=backend.indexOf('async function playTournament');
const playEnd=backend.indexOf('async function finalizeTournamentRoom',playStart);
assert(playStart>=0&&playEnd>playStart,'P14 tournament play function missing');
assert(!backend.slice(playStart,playEnd).includes('assertEntryEnabled'),'P14 must preserve entry to already-active tournament matches');

const openStart=backend.indexOf('async function openDirectChallenge');
const openEnd=backend.indexOf('async function publicProfileByUsername',openStart);
assert(openStart>=0&&openEnd>openStart,'P14 challenge open function missing');
assert(!backend.slice(openStart,openEnd).includes('assertEntryEnabled'),'P14 must preserve access to already-accepted challenge rooms');

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p14_competitive_administration.sql','utf8');
for(const marker of [
  'gomoku_admin_operators',
  'gomoku_incidents',
  'gomoku_release_registry',
  'gomoku_competitive_control',
  'gomoku_admin_audit_log',
  'gomoku_admin_assert_operator',
  'gomoku_public_operational_status',
  'gomoku_admin_overview',
  'gomoku_admin_set_controls',
  'gomoku_admin_create_incident',
  'gomoku_admin_update_incident',
  'gomoku_admin_register_release',
  'gomoku_admin_transition_release',
  'enable row level security',
  'revoke all on table public.gomoku_admin_operators from public,anon,authenticated',
  'revoke all on table public.gomoku_admin_audit_log from service_role',
  'grant select,insert on table public.gomoku_admin_audit_log to service_role',
  "where status='active'"
]) assert(migration.includes(marker),'P14 migration missing '+marker);

for(const forbidden of [
  'grant select on table public.gomoku_admin_operators to authenticated',
  'grant select on table public.gomoku_admin_audit_log to authenticated',
  'grant update on table public.gomoku_admin_audit_log to service_role',
  'grant delete on table public.gomoku_admin_audit_log to service_role',
  'grant truncate on table public.gomoku_admin_audit_log to service_role',
  'security definer'
]) assert(!migration.toLowerCase().includes(forbidden.toLowerCase()),'P14 security regression: '+forbidden);

const runbook=fs.readFileSync('operations/P14-RUNBOOK.md','utf8');
for(const marker of [
  'Operator bootstrap',
  'Existing matches continue',
  'candidate → approved → active',
  'does not deploy code',
  'audit'
]) assert(runbook.includes(marker),'P14 runbook missing '+marker);

const p13=fs.readFileSync('online/test-p13-reliability.mjs','utf8');
assert(p13.includes("['P13','P14','P15','P16','P17'].includes(health.phase)"),'P13 verification is not forward compatible with P17');

console.log('PASS P14: explicit operator authorization, incident controls, entry kill switches, append-only audit evidence and release governance are wired without terminating active competition.');


const grantFix=fs.readFileSync('supabase/migrations/20261001_gomoku_p14_audit_append_only_grants.sql','utf8');
assert(grantFix.includes('revoke all on table public.gomoku_admin_audit_log from service_role'),'P14 audit correction must revoke inherited service_role privileges');
assert(grantFix.includes('grant select,insert on table public.gomoku_admin_audit_log to service_role'),'P14 audit correction must grant SELECT + INSERT only');


const sequenceFix=fs.readFileSync('supabase/migrations/20261001_gomoku_p14_audit_sequence_hardening.sql','utf8');
assert(sequenceFix.includes('revoke all on sequence public.gomoku_admin_audit_log_id_seq from public,anon,authenticated,service_role'),'P14 audit sequence must revoke inherited public/client grants');
assert(sequenceFix.includes('grant usage,select on sequence public.gomoku_admin_audit_log_id_seq to service_role'),'P14 audit sequence must be service-role only');
