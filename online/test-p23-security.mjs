import fs from 'node:fs';

const assert=(v,m)=>{if(!v)throw new Error(m);};
const source=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
const manifest=JSON.parse(fs.readFileSync('operations/p23-attack-surface.json','utf8'));

assert(manifest.version==='p23.attack-surface.v1','P23 manifest version mismatch');
assert(manifest.routeCount===manifest.routes.length,'P23 manifest route count mismatch');
assert(manifest.routes.length===68,'P23 expected 68 routed handlers; review any attack-surface change explicitly');
assert(manifest.verifyJwt===false,'P23 must document the Edge verify_jwt=false boundary');

const router=source.slice(source.indexOf('export default {fetch'));
const routed=[...router.matchAll(/return await ([A-Za-z0-9_]+)\(/g)].map(x=>x[1]);
const actual=[...new Set(routed)].sort();
const documented=[...new Set(manifest.routes.map(x=>x.handler))].sort();
assert(JSON.stringify(actual)===JSON.stringify(documented),'P23 attack-surface manifest does not match routed handlers');

const duplicates=new Set();
for(const r of manifest.routes){
  const key=r.method+' '+r.path;
  assert(!duplicates.has(key),'Duplicate P23 route '+key);duplicates.add(key);
  assert(['GET','POST'].includes(r.method),'Unexpected P23 method '+r.method);
  assert(manifest.authClasses.includes(r.auth),'Unknown P23 auth class '+r.auth);
}

function functionBody(name){
  const start=source.indexOf('function '+name+'(');
  const asyncStart=source.indexOf('async function '+name+'(');
  const at=asyncStart>=0&&(start<0||asyncStart<start)?asyncStart:start;
  assert(at>=0,'Handler definition missing '+name);
  const candidates=[
    source.indexOf('\nasync function ',at+10),
    source.indexOf('\nfunction ',at+10),
    source.indexOf('\nexport default',at+10)
  ].filter(x=>x>at);
  return source.slice(at,Math.min(...candidates));
}
const markers={
  account:'verifiedAccount(req,true)',
  admin:'adminOperator(req',
  github_oidc:'verifiedGithubAutomation(req',
  room_session:'viewer(row,req)',
  history_capability:'historyHash('
};
for(const route of manifest.routes){
  const marker=markers[route.auth];
  if(marker)assert(functionBody(route.handler).includes(marker),route.handler+' does not enforce '+route.auth+' via '+marker);
}
for(const name of ['createRoom','joinRoom','getTournament'])assert(functionBody(name).includes('verifiedAccount(req,false)'),name+' must keep optional account binding explicit');

for(const marker of [
  'const MAX_REQUEST_BODY_BYTES=32*1024',
  'req.body.getReader()',
  'total>MAX_REQUEST_BODY_BYTES',
  'await reader.cancel()',
  "status:413",
  "const GITHUB_OIDC_AUDIENCE='gomoku-production-control'",
  "claims.ref||'')!=='refs/heads/main'",
  'gomoku_p16_consume_oidc_jti',
  '120000',
  "cleanHistoryToken",
  "PBKDF2",
  "iterations:120000"
]) assert(source.includes(marker),'P23 Edge hardening marker missing '+marker);
assert(!source.includes('return await req.json()'),'P23 body bound can be bypassed by direct req.json()');

const migration=fs.readFileSync('supabase/migrations/20261004170000_gomoku_p23_security_admission_gate.sql','utf8');
for(const marker of ["'p23_security'",'security invoker','grant execute on function public.gomoku_p16_required_checks()'])
  assert(migration.toLowerCase().includes(marker.toLowerCase()),'P23 admission migration missing '+marker);
assert(!migration.toLowerCase().includes('security definer'),'P23 admission migration must not use SECURITY DEFINER');

const waiter=fs.readFileSync('operations/p16-await-checks.mjs','utf8');
assert(waiter.includes("p23_security:'p23-security'"),'P16 exact-SHA waiter does not require P23');
assert(waiter.includes('26*60_000'),'P16 security wait budget not expanded');
const release=fs.readFileSync('operations/p16-release-control.mjs','utf8');
assert(release.includes("'p23_security'"),'P16 admission submission does not require P23');

const portable=fs.readFileSync('operations/p18-build-portable-workspace.mjs','utf8');
assert(portable.includes('20261004170000_gomoku_p23_security_admission_gate.sql'),'P18 portable migration order omits P23');

const supply=fs.readFileSync('operations/p19-supply-chain-policy.mjs','utf8');
assert(supply.includes("p23_security:'p23-security'"),'P19 policy does not protect P23 admission dependency');

const workflow=fs.readFileSync('.github/workflows/verify-p23-security.yml','utf8');
for(const marker of [
  'name: p23-security',
  'operations/p23-db-audit.sql',
  'audit/p23-adversarial.mjs',
  'supabase functions serve gomoku-room --no-verify-jwt',
  'contents: read',
  'p23-security-evidence'
]) assert(workflow.includes(marker),'P23 workflow missing '+marker);
assert(!workflow.includes('id-token: write'),'P23 adversarial workflow must not receive GitHub OIDC write permission');
assert(!workflow.includes('hycegznamzjhwinegaai'),'P23 portable security workflow must not target production');

console.log('PASS P23 static security contract: complete route manifest, bounded bodies, auth classes, database audit and exact-SHA admission are wired.');
