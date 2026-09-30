const API=process.env.GOMOKU_ROOM_API||'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const KEY=process.env.GOMOKU_ROOM_KEY||'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const headers={'content-type':'application/json','apikey':KEY};
async function req(path,{method='GET',token,accountToken,body,ok=[200,201]}={}){
  const res=await fetch(API+path,{method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{}),...(accountToken?{'x-gomoku-account-token':accountToken}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status))throw new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));
  return {status:res.status,data};
}
const assert=(v,m)=>{if(!v)throw new Error(m);};

const board=(await req('/api/ranked/leaderboard?limit=20')).data;
assert(Array.isArray(board.players),'ranked leaderboard must return a players array');
for(const p of board.players){
  assert(Number.isInteger(Number(p.rank))&&Number(p.rank)>=1,'leaderboard rank must be positive');
  assert(/^[A-Za-z0-9_]{3,20}$/.test(String(p.username||'')),'leaderboard username must be public handle');
  assert(Number.isInteger(Number(p.rating)),'leaderboard rating must be numeric');
  assert(!('userId' in p),'public leaderboard must not expose account UUIDs');
  assert(typeof p.tier==='string'&&p.tier.length>0,'leaderboard tier must be present');
}
for(const path of ['/api/ranked/me','/api/ranked/queue','/api/ranked/cancel']){
  await req(path,{method:'POST',accountToken:'not-a-real-account-jwt',body:path.endsWith('/queue')?{historyToken:'P7_TEST_'+crypto.randomUUID().replaceAll('-','')}:{},ok:[401]});
}

const room=('P7CAS-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase().slice(0,32);
const H='P7_CAS_'+crypto.randomUUID().replaceAll('-','');
let token='';
try{
  const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'P7 Casual',historyToken:H}})).data;
  token=created.token;
  assert(created.state.ranked===false&&created.state.mode==='casual','ordinary rooms must stay casual after P7');
  const rooms=(await req('/api/rooms')).data.rooms||[];
  const listed=rooms.find(x=>x.id===room);
  assert(listed&&listed.ranked===false&&listed.mode==='casual','room directory must distinguish casual rooms');
}finally{
  if(token)await req('/api/rooms/'+room+'/leave',{method:'POST',token,body:{},ok:[200,404,409]});
}
console.log('PASS P7 live contract: public leaderboard privacy, ranked auth boundary, and casual-room compatibility.');
