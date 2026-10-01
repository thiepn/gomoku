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
assert(!hasPrivateId(current),'public season response exposed account identifiers');

const cups=(await req('/api/tournaments?scope=all&limit=50')).data;
assert(Array.isArray(cups.tournaments),'tournament list missing');
assert(!hasPrivateId(cups),'public tournament response exposed account identifiers');

await req('/api/competition/career',{method:'POST',body:{},ok:[401]});
await req('/api/competition/showcase',{method:'POST',body:{codes:[]},ok:[401]});

const ranked=(await req('/api/ranked/leaderboard?limit=10')).data;
let username=(ranked.players||[]).map(x=>x.username).find(Boolean)
  ||(current.players||[]).map(x=>x.username).find(Boolean)
  ||(cups.tournaments||[]).map(x=>x.organizer).find(Boolean);
if(username){
  const publicProfile=(await req('/api/profiles/'+encodeURIComponent(username))).data;
  assert(publicProfile?.profile?.username,'public player profile missing');
  assert(publicProfile.profile.competitive&&typeof publicProfile.profile.competitive==='object','competitive profile missing');
  assert(publicProfile.profile.competitive.career&&typeof publicProfile.profile.competitive.career==='object','career summary missing');
  assert(Array.isArray(publicProfile.profile.competitive.achievements),'earned achievements missing');
  assert(Array.isArray(publicProfile.profile.competitive.showcase),'showcase missing');
  assert(Array.isArray(publicProfile.profile.competitive.trophies),'trophy cabinet missing');
  assert(Array.isArray(publicProfile.profile.competitive.seasons),'season career history missing');
  assert(Array.isArray(publicProfile.profile.competitive.tournaments),'tournament career history missing');
  assert(!('progress' in publicProfile.profile.competitive),'locked achievement progress must stay private');
  assert(!hasPrivateId(publicProfile),'public competitive profile exposed account identifiers');
}

const source=fs.readFileSync('online/p8-competition.js','utf8');
new Function(source);
for(const marker of [
  'COMPETITIVE IDENTITY',
  'Career & trophies',
  'p10SaveShowcase',
  'careerProfileMarkup',
  "version:'3.0.0'"
])assert(source.includes(marker),'P10 client source missing '+marker);

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'P8_COMPETITION_BRIDGE_START',
  'GomokuCompetition?.openPlayerProfile',
  'COMPETITIVE IDENTITY',
  'p10SaveShowcase',
  'Career & trophies'
])assert(html.includes(marker),'generated index missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.1.0-p10-competitive-identity-analysis-2.1.0-review-ux-2.1.0'),'P10 service-worker cache not active');

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'COMPETITIVE_ACHIEVEMENTS',
  'competitiveProfileData',
  'async function competitionCareer',
  'async function competitionShowcase',
  "parts[2]==='career'",
  "parts[2]==='showcase'"
])assert(backend.includes(marker),'P10 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p10_competitive_identity.sql','utf8');
for(const marker of [
  'gomoku_competitive_careers',
  'gomoku_player_achievements',
  'gomoku_competitive_showcase',
  'gomoku_refresh_competitive_career',
  'gomoku_set_competitive_showcase',
  'gomoku_p10_rating_event_trigger'
])assert(migration.includes(marker),'P10 migration missing '+marker);

console.log('PASS P10: career projection, achievements, showcase, public privacy, auth boundaries, and generated profile UI.');
