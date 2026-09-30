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
const room=('P6ANON-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase().slice(0,32);
const HA='P6_A_'+crypto.randomUUID().replaceAll('-','');
const HB='P6_B_'+crypto.randomUUID().replaceAll('-','');
let a='',b='';
async function forget(token,version){try{await req('/api/history/'+room+'/'+version+'/forget',{method:'POST',body:{historyToken:token},ok:[200,403,404]});}catch{}}
async function leave(token){if(!token)return;try{await req('/api/rooms/'+room+'/leave',{method:'POST',token,body:{},ok:[200,401,404,409]});}catch{}}

try{
  const missing='P6NO'+Math.random().toString(36).slice(2,12).toUpperCase();
  await req('/api/profiles/'+missing,{ok:[404]});
  await req('/api/profiles/BAD%21NAME',{ok:[400]});
  await req('/api/account/profile',{method:'POST',accountToken:'not-a-valid-supabase-jwt',body:{action:'get'},ok:[401]});

  const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'Anon Alpha',historyToken:HA}})).data;
  a=created.token;
  assert(created.state.players[0].verified===false,'anonymous host must remain unverified');
  assert(created.state.players[0].profileUsername===null,'anonymous host must not expose a profile handle');

  const joined=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'Anon Beta',historyToken:HB}})).data;
  b=joined.token;
  let st=joined.state;
  assert(st.players.length===2&&st.players.every(p=>p.verified===false),'anonymous join must remain fully supported');

  await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'link_identity',revision:st.revision,gameVersion:st.gameVersion,commandId:'P6.LINK.NOAUTH.'+Date.now()},ok:[401]});
  const unchanged=(await req('/api/rooms/'+room,{token:a})).data;
  assert(unchanged.revision===st.revision,'failed identity link must not mutate the room');

  st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'move',i:112,revision:st.revision,gameVersion:st.gameVersion,commandId:'P6.ANON.MOVE.'+Date.now()}})).data;
  st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:b,body:{action:'resign',revision:st.revision,gameVersion:st.gameVersion,commandId:'P6.ANON.RESIGN.'+Date.now()}})).data;
  assert(st.game.result?.reason==='resign','anonymous P6 game must still finish normally');

  const history=(await req('/api/history',{method:'POST',body:{historyToken:HA,limit:10}})).data.matches||[];
  const saved=history.find(m=>m.roomId===room);
  assert(saved&&saved.players.every(p=>p.verified===false),'P5 history must remain compatible with anonymous P6 matches');
}finally{
  await leave(b);await leave(a);await forget(HA,1);await forget(HB,1);
}
console.log('PASS P6 live contract: anonymous multiplayer/history preserved, public-profile validation enforced, invalid account JWT rejected, and unauthenticated identity linking cannot mutate rooms.');
