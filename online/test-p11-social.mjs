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
function privateLeak(value){
  if(!value||typeof value!=='object')return false;
  for(const [k,v] of Object.entries(value)){
    if(['user_id','userId','owner_user_id','target_user_id','challenger_user_id','challenged_user_id','room_id','roomId'].includes(k))return true;
    if(privateLeak(v))return true;
  }
  return false;
}

const discover=(await req('/api/community/discover?limit=20')).data;
assert(Array.isArray(discover.players),'community discover players missing');
for(const p of discover.players){
  assert(typeof p.username==='string'&&p.username.length>=3,'discover username missing');
  assert(['online','in_game','offline'].includes(p.presence),'invalid public presence');
  assert(typeof p.canChallenge==='boolean','challenge availability missing');
}
assert(!privateLeak(discover),'public discovery leaked private identifiers or room data');

const current=(await req('/api/seasons/current?limit=20')).data;
const ranked=(await req('/api/ranked/leaderboard?limit=20')).data;
const username=discover.players?.[0]?.username||ranked.players?.[0]?.username||current.players?.[0]?.username;
if(username){
  const profile=(await req('/api/profiles/'+encodeURIComponent(username))).data;
  assert(profile?.profile?.username,'public profile missing');
  assert(['online','in_game','offline'].includes(profile.profile.presence),'public profile presence missing');
  assert(typeof profile.profile.canChallenge==='boolean','public challenge availability missing');
  assert(!privateLeak(profile),'public profile leaked private identifiers or room data');
}

for(const [path,body] of [
  ['/api/community/me',{}],
  ['/api/community/preferences',{allowChallenges:true,showPresence:true}],
  ['/api/community/favorite',{username:username||'Nobody',favorite:true}],
  ['/api/community/head-to-head/'+encodeURIComponent(username||'Nobody'),{}],
  ['/api/community/challenges',{username:username||'Nobody'}]
]) await req(path,{method:'POST',body,ok:[401]});

const rooms=(await req('/api/rooms')).data;
assert(Array.isArray(rooms.rooms),'public rooms missing');
assert(!rooms.rooms.some(r=>r.mode==='challenge'||r.challenge),'direct challenge room leaked into public room list');

const source=fs.readFileSync('online/p8-competition.js','utf8');
new Function(source);
for(const marker of [
  'Players & rivalries',
  'HEAD TO HEAD',
  'data-p11-challenge',
  'p11SavePrefs',
  'DIRECT CHALLENGE',
  "version:'4.0.0'"
])assert(source.includes(marker),'P11 client source missing '+marker);

const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of [
  'async function communityDiscover',
  'async function communityMe',
  'async function communityHeadToHead',
  'async function createDirectChallenge',
  'async function respondDirectChallenge',
  "row?.state?.mode!=='challenge'",
  "Direct challenge rooms are private to their two players."
])assert(backend.includes(marker),'P11 backend missing '+marker);

const migration=fs.readFileSync('supabase/migrations/20261001_gomoku_p11_social_layer.sql','utf8');
for(const marker of [
  'gomoku_social_preferences',
  'gomoku_social_presence',
  'gomoku_player_favorites',
  'gomoku_direct_challenges',
  'gomoku_head_to_head',
  'gomoku_respond_direct_challenge'
])assert(migration.includes(marker),'P11 migration missing '+marker);

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'Players & rivalries',
  'HEAD TO HEAD',
  'p11SavePrefs',
  'DIRECT CHALLENGE',
  'enterChallenge'
])assert(html.includes(marker),'generated index missing '+marker);

const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.1.0-p11-social-rivalries-analysis-2.1.0-review-ux-2.1.0'),'P11 service-worker cache not active');

console.log('PASS P11: discovery, privacy, auth boundaries, social UI, rivalry records, favorites and direct-challenge isolation.');
