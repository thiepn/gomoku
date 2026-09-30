const API=process.env.GOMOKU_ROOM_API||'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const KEY=process.env.GOMOKU_ROOM_KEY||'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const headers={'content-type':'application/json','apikey':KEY};
async function req(path,{method='GET',token,body,ok=[200,201]}={}){
  const res=await fetch(API+path,{method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status)){const e=new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));e.status=res.status;throw e;}
  return {status:res.status,data};
}
const assert=(v,m)=>{if(!v)throw new Error(m);};
const rid=p=>(p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)).toUpperCase().slice(0,32);
const HA='P5_A_'+crypto.randomUUID().replaceAll('-','');
const HB='P5_B_'+crypto.randomUUID().replaceAll('-','');
const HX='P5_X_'+crypto.randomUUID().replaceAll('-','');
async function leave(room,token){if(!token)return;try{await req('/api/rooms/'+room+'/leave',{method:'POST',token,body:{},ok:[200,401,404,409]});}catch{}}
async function history(token){return (await req('/api/history',{method:'POST',body:{historyToken:token,limit:20}})).data.matches||[];}
async function detail(token,room,version){return (await req('/api/history/'+room+'/'+version,{method:'POST',body:{historyToken:token}})).data;}

async function scenarioDurableHistory(){
  const room=rid('P5HIST');let a='',b='';
  try{
    const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'P5 Alpha',historyToken:HA}})).data;a=created.token;
    const joined=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P5 Beta',historyToken:HB}})).data;b=joined.token;
    let st=joined.state;
    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'move',i:112,revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.G1.MOVE.'+Date.now()}})).data;
    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:b,body:{action:'resign',revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.G1.RESIGN.'+Date.now()}})).data;
    assert(st.game.result?.winner===1&&st.game.result?.reason==='resign','game one must finish by white resignation');

    let ha=await history(HA),hb=await history(HB),hx=await history(HX);
    assert(ha.some(m=>m.roomId===room&&m.gameVersion===1),'host history must contain game one');
    assert(hb.some(m=>m.roomId===room&&m.gameVersion===1),'guest history must contain game one');
    assert(!hx.some(m=>m.roomId===room),'unrelated history token must not see the match');
    let d=await detail(HA,room,1);
    assert(d.moves.length===1&&d.resultReason==='resign'&&d.winnerColor===1,'game one detail must preserve moves and result');
    assert(d.you?.name==='P5 Alpha'&&d.you?.color===1,'history response must preserve host perspective');

    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'rematch',revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.REMATCH.A.'+Date.now()}})).data;
    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:b,body:{action:'rematch',revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.REMATCH.B.'+Date.now()}})).data;
    assert(st.gameVersion===2&&st.round===2,'rematch must start durable game version two');

    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:b,body:{action:'move',i:112,revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.G2.MOVE.'+Date.now()}})).data;
    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'resign',revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.G2.RESIGN.'+Date.now()}})).data;
    assert(st.game.result?.winner===1&&st.game.result?.reason==='resign','game two must finish by white resignation after colors swap');

    ha=await history(HA);hb=await history(HB);
    const own=ha.filter(m=>m.roomId===room);
    assert(own.length===2,'history must contain one immutable row per completed round');
    assert(own[0].gameVersion===2&&own[1].gameVersion===1,'history must be newest first');
    assert(hb.filter(m=>m.roomId===room).length===2,'both participants must retain the complete series');

    await leave(room,b);b='';
    await leave(room,a);a='';
    ha=await history(HA);
    assert(ha.filter(m=>m.roomId===room).length===2,'history must survive room deletion');
    d=await detail(HB,room,1);
    assert(d.roomId===room&&d.gameVersion===1,'saved detail must survive room deletion');
  }finally{await leave(room,b);await leave(room,a);}
}

async function scenarioAbandonment(){
  const room=rid('P5ABND');let a='',b='';
  try{
    const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'P5 Stay',historyToken:HA}})).data;a=created.token;
    const joined=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P5 Leave',historyToken:HB}})).data;b=joined.token;
    let st=joined.state;
    st=(await req('/api/rooms/'+room+'/action',{method:'POST',token:a,body:{action:'move',i:112,revision:st.revision,gameVersion:st.gameVersion,commandId:'P5.ABND.MOVE.'+Date.now()}})).data;
    const left=(await req('/api/rooms/'+room+'/leave',{method:'POST',token:b,body:{revision:st.revision}})).data;b='';
    assert(left.state.game.result?.reason==='abandon','departure must end active game by abandonment');
    const ha=await history(HA),hb=await history(HB);
    assert(ha.some(m=>m.roomId===room&&m.resultReason==='abandon'),'remaining player must receive abandonment history');
    assert(hb.some(m=>m.roomId===room&&m.resultReason==='abandon'),'departing player must also receive abandonment history');
  }finally{await leave(room,b);await leave(room,a);}
}

await scenarioDurableHistory();
await scenarioAbandonment();
console.log('PASS P5 live history: durable rounds, participant privacy, rematch separation, detail replay, room-deletion survival, and abandonment persistence.');
