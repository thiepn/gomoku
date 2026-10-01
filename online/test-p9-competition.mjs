import fs from 'node:fs';

const API=process.env.GOMOKU_ROOM_API||'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const KEY=process.env.GOMOKU_ROOM_KEY||'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const headers={apikey:KEY,'content-type':'application/json'};
const assert=(v,m)=>{if(!v)throw new Error(m);};
async function req(path,{method='GET',body,ok=[200]}={}){
  const res=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status))throw new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));
  return {status:res.status,data};
}
function hasPrivateId(value){
  if(!value||typeof value!=='object')return false;
  for(const [k,v] of Object.entries(value)){
    if(['user_id','userId','organizer_user_id','organizerUserId','player1_user_id','player2_user_id','winner_user_id','subject_user_id','actor_user_id','forfeit_loser_user_id'].includes(k))return true;
    if(hasPrivateId(v))return true;
  }
  return false;
}

const current=(await req('/api/seasons/current?limit=20')).data;
assert(current?.season?.code==='2026-q4','current season must remain 2026-q4 on 2026-10-01');
assert(Array.isArray(current.players),'current season standings missing');
assert(!hasPrivateId(current),'public current season exposed account identifiers');

const seasons=(await req('/api/seasons?limit=8')).data;
assert(Array.isArray(seasons.seasons),'season archive list missing');
assert(seasons.seasons.some(s=>s.code==='2026-q4'),'season archive must include 2026-q4');
assert(!hasPrivateId(seasons),'season archive exposed account identifiers');

const historical=(await req('/api/seasons/2026-q4?limit=20')).data;
assert(historical?.season?.code==='2026-q4','historical season endpoint mismatch');
assert(Array.isArray(historical.players),'historical standings missing');
assert(!hasPrivateId(historical),'historical standings exposed account identifiers');

for(const scope of ['live','archive']){
  const data=(await req('/api/tournaments?scope='+scope+'&limit=50')).data;
  assert(Array.isArray(data.tournaments),scope+' tournament list missing');
  assert(!hasPrivateId(data),scope+' tournament list exposed account identifiers');
  for(const cup of data.tournaments){
    assert(/^CUP-[A-Z0-9]{8,16}$/.test(String(cup.id||'')),'invalid tournament id');
    assert([4,8].includes(Number(cup.size)),'unsupported tournament size');
    if(scope==='live')assert(['registration','active'].includes(cup.status),'archive tournament leaked into live scope');
    if(scope==='archive')assert(['completed','cancelled'].includes(cup.status),'live tournament leaked into archive scope');
  }
}

const all=(await req('/api/tournaments?scope=all&limit=50')).data.tournaments||[];
if(all.length){
  const detail=(await req('/api/tournaments/'+encodeURIComponent(all[0].id))).data;
  assert(detail?.tournament?.id===all[0].id,'tournament detail id mismatch');
  assert(Array.isArray(detail.tournament.matches),'tournament matches missing');
  assert(Array.isArray(detail.tournament.events),'tournament event timeline missing');
  assert(!hasPrivateId(detail),'public tournament detail exposed account identifiers');
  for(const m of detail.tournament.matches){
    assert(typeof m.player1CheckedIn==='boolean'&&typeof m.player2CheckedIn==='boolean','check-in state must be public-safe booleans');
    assert(typeof m.spectatorCount==='number','spectator count missing');
  }
}

await req('/api/competition/me',{method:'POST',body:{},ok:[401]});
await req('/api/tournaments/CUP-AAAAAAAAAA/organizer',{method:'POST',body:{action:'cancel'},ok:[401]});
await req('/api/tournaments',{method:'POST',body:{name:'Unauthorized Cup',size:4},ok:[401]});

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'P8_COMPETITION_BRIDGE_START',
  'spectateTournament',
  'p9TournamentRoomBanner',
  'Tournament archive',
  'Enable match alerts',
  'What happened',
  'Season history'
])assert(html.includes(marker),'generated index missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.1.0-p9-competitive-ops-analysis-2.1.0-review-ux-2.1.0'),'P9 service-worker cache not active');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'async function competitionMe',
  'async function organizerTournament',
  'gomoku_checkin_tournament_match',
  'gomoku_mark_tournament_match_started',
  'tournamentRoomOps',
  "parts[3]==='organizer'"
])assert(backend.includes(marker),'P9 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p9_competitive_operations.sql','utf8');
for(const marker of [
  'gomoku_tournament_events',
  'gomoku_ensure_current_season',
  'gomoku_sweep_tournament_deadlines',
  'gomoku_competition_tick',
  'gomoku-p9-competition-tick'
])assert(migration.includes(marker),'P9 migration missing '+marker);

console.log('PASS P9: season archives, tournament scopes, privacy, auth boundaries, operations UI, deadline automation, and spectator bridge.');
