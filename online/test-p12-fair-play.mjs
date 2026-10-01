import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};

const source=fs.readFileSync('online/p8-competition.js','utf8');
new Function(source);
for(const marker of [
  'Fair Play center',
  'p12ProfileBlock',
  'p12ReportSubmit',
  'p12RoomTrustAction',
  "version:'5.0.0'"
])assert(source.includes(marker),'P12 client source missing '+marker);

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'COMPETITIVE_STALE_TTL_MS=120000',
  'sweepCompetitiveDisconnect',
  'async function trustMe',
  'async function trustBlock',
  'async function trustReport',
  'gomoku_rating_protections',
  "parts[1]==='trust'"
])assert(backend.includes(marker),'P12 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p12_fair_play_trust.sql','utf8');
for(const marker of [
  'gomoku_player_blocks',
  'gomoku_fair_play_reports',
  'gomoku_player_trust_state',
  'gomoku_match_integrity_flags',
  'gomoku_rating_protections',
  'gomoku_fair_play_audit_events',
  'gomoku_moderation_actions',
  'gomoku_record_integrity_signals',
  'gomoku_apply_moderation_action',
  'Reports never auto-sanction players'
])assert(migration.includes(marker),'P12 migration missing '+marker);

const builder=fs.readFileSync('online/build-p8-client.py','utf8');
for(const marker of [
  "data.status==='restricted'",
  'Repeat-opponent protection:',
  'p12-fair-play-trust'
])assert(builder.includes(marker),'P12 builder missing '+marker);

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'Fair Play center',
  'p12ProfileBlock',
  'p12RoomTrustAction',
  "data.status==='restricted'",
  'Repeat-opponent protection:',
  "version:'5.0.0'"
])assert(html.includes(marker),'generated P12 index missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.1.0-p12-fair-play-trust-analysis-2.1.0-review-ux-2.1.0'),'P12 service-worker cache not active');

console.log('PASS P12: Fair Play source, generated UI, restriction handling, trust boundaries and rating-protection wiring.');
