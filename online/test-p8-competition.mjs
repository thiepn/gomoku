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
    if(['user_id','userId','organizer_user_id','player1_user_id','player2_user_id','winner_user_id'].includes(k))return true;
    if(hasPrivateId(v))return true;
  }
  return false;
}

const season=(await req('/api/seasons/current?limit=20')).data;
assert(season&&typeof season==='object','season response missing');
assert(season.season&&season.season.code==='2026-q4','2026 Q4 season must be active');
assert(Array.isArray(season.players),'season players must be an array');
assert(!hasPrivateId(season),'public season response must not expose account UUID fields');

const cups=(await req('/api/tournaments')).data;
assert(Array.isArray(cups.tournaments),'tournament list must be an array');
assert(!hasPrivateId(cups),'public tournament list must not expose account UUID fields');
for(const cup of cups.tournaments){
  assert(/^CUP-[A-Z0-9]{8,16}$/.test(String(cup.id||'')),'invalid public tournament id');
  assert([4,8].includes(Number(cup.size)),'public tournament size must be supported');
}

await req('/api/seasons/me',{method:'POST',body:{},ok:[401]});
await req('/api/tournaments',{method:'POST',body:{name:'Unauthorized Cup',size:4},ok:[401]});
await req('/api/tournaments/CUP-AAAAAAAAAA',{ok:[404]});

const html=fs.readFileSync('index.html','utf8');
for(const marker of [
  'P8_COMPETITION_BRIDGE_START',
  'id="p8-competition-style"',
  'id="p8-competition-script"',
  'GomokuCompetitionBridge',
  'Seasons & tournaments'
])assert(html.includes(marker),'generated index missing '+marker);
const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('gomoku-v12.1.0-p8-seasons-tournaments-analysis-2.1.0-review-ux-2.1.0'),'P8 service-worker cache not active');
const backend=fs.readFileSync('supabase/functions/gomoku-room/index.ts','utf8');
for(const marker of ["async function seasonBoard","async function ensureTournamentRooms","state.mode==='tournament'","gomoku_advance_tournament_match"]){
  assert(backend.includes(marker),'backend missing '+marker);
}
console.log('PASS P8: generated competition client, public season/tournament privacy, auth boundary, and tournament backend markers.');
