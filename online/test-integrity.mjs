const API=process.env.GOMOKU_ROOM_API||'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const KEY=process.env.GOMOKU_ROOM_KEY||'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const baseHeaders={'content-type':'application/json','apikey':KEY};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,{method='GET',token,body,ok=[200,201]}={}){
  const res=await fetch(API+path,{method,headers:{...baseHeaders,...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status)){const e=new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));e.status=res.status;e.data=data;throw e;}
  return {status:res.status,data};
}
const assert=(value,message)=>{if(!value)throw new Error(message);};
const id=prefix=>(prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)).toUpperCase().slice(0,32);
async function leave(room,token){if(!token)return;try{await req('/api/rooms/'+encodeURIComponent(room)+'/leave',{method:'POST',token,body:{},ok:[200,401,404,409]});}catch{}}

async function scenarioIntegrity(){
  const room=id('P4INT');let hostToken='',guestToken='';
  try{
    const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'P4 Host'}})).data;
    hostToken=created.token;
    assert(created.state.gameVersion===1,'new rooms must start at gameVersion 1');

    const joined=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P4 Guest'}})).data;
    guestToken=joined.token;
    assert(joined.state.gameVersion===1,'first join must stay in gameVersion 1');

    const startRevision=joined.state.revision,gameVersion=joined.state.gameVersion;
    const retryId='P4.RETRY.'+Date.now();
    const movePayload={action:'move',i:112,revision:startRevision,gameVersion,commandId:retryId};
    const first=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:movePayload})).data;
    assert(first.game.moves.length===1,'first move must commit');
    const firstRevision=first.revision;

    const duplicate=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:movePayload})).data;
    assert(duplicate.revision===firstRevision,'retry must not increment revision');
    assert(duplicate.game.moves.length===1,'retry must not duplicate the move');

    const guestSameId=(await req('/api/rooms/'+room+'/action',{method:'POST',token:guestToken,body:{action:'move',i:113,revision:firstRevision,gameVersion,commandId:retryId}})).data;
    assert(guestSameId.game.moves.length===2,'same command id from the other seat must remain independent');

    const malformed=await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'chat',text:'x',revision:guestSameId.revision,gameVersion,commandId:'bad'},ok:[422]});
    assert(malformed.status===422,'malformed command ids must be rejected');

    const chat1=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'chat',text:'one',revision:guestSameId.revision,gameVersion,commandId:'P4.CHAT.1.'+Date.now()}})).data;
    const limited=await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'chat',text:'two',revision:chat1.revision,gameVersion,commandId:'P4.CHAT.2.'+Date.now()},ok:[429]});
    assert(limited.status===429,'rapid chat must be throttled');
    await sleep(800);
    const chat2=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'chat',text:'two',revision:chat1.revision,gameVersion,commandId:'P4.CHAT.2R.'+Date.now()}})).data;
    assert(chat2.chat.at(-1)?.text==='two','chat must recover after the throttle window');

    const resigned=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'resign',revision:chat2.revision,gameVersion,commandId:'P4.RESIGN.'+Date.now()}})).data;
    assert(resigned.game.result?.reason==='resign','resign must finish the game');

    const guestRematch=(await req('/api/rooms/'+room+'/action',{method:'POST',token:guestToken,body:{action:'rematch',revision:resigned.revision,gameVersion,commandId:'P4.REMATCH.G.'+Date.now()}})).data;
    const hostRematch=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'rematch',revision:guestRematch.revision,gameVersion,commandId:'P4.REMATCH.H.'+Date.now()}})).data;
    assert(hostRematch.gameVersion===2,'accepted rematch must advance gameVersion');
    assert(hostRematch.round===2&&hostRematch.game.moves.length===0,'accepted rematch must start a clean round');

    const staleRound=await req('/api/rooms/'+room+'/action',{method:'POST',token:guestToken,body:{action:'chat',text:'stale',revision:hostRematch.revision,gameVersion:1,commandId:'P4.STALE.GV.'+Date.now()},ok:[409]});
    assert(staleRound.status===409,'stale-round actions must be rejected');

    const staleRevision=await req('/api/rooms/'+room+'/action',{method:'POST',token:guestToken,body:{action:'chat',text:'stale revision',revision:hostRematch.revision-1,gameVersion:2,commandId:'P4.STALE.REV.'+Date.now()},ok:[409]});
    assert(staleRevision.status===409,'fresh commands with stale revisions must be rejected');

    console.log('PASS P4 live match integrity: retry idempotency, seat-scoped commands, throttling, round versioning, and stale-action rejection.');
  }finally{
    await leave(room,guestToken);
    await leave(room,hostToken);
  }
}
await scenarioIntegrity();
