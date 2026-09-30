const API=process.env.GOMOKU_ROOM_API||'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const KEY=process.env.GOMOKU_ROOM_KEY||'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const baseHeaders={'content-type':'application/json','apikey':KEY};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,{method='GET',token,body,ok=[200,201]}={}){
  const res=await fetch(API+path,{method,headers:{...baseHeaders,...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!ok.includes(res.status)){const e=new Error(method+' '+path+' -> '+res.status+' '+JSON.stringify(data));e.status=res.status;throw e;}
  return {status:res.status,data};
}
const assert=(value,message)=>{if(!value)throw new Error(message);};
const id=prefix=>(prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)).toUpperCase().slice(0,32);
async function leave(room,token,revision){if(!token)return;try{await req('/api/rooms/'+encodeURIComponent(room)+'/leave',{method:'POST',token,body:{revision},ok:[200,401,404,409]});}catch{}}

async function scenarioDepartureAndReplacement(){
  const room=id('P3LIFE');let hostToken='',guestToken='',departedGuestToken='',replacementToken='',revision=0,spectatorId='';
  try{
    const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'P3 Host'}})).data;
    hostToken=created.token;revision=created.state.revision;
    assert(created.state.players.length===1,'create should reserve exactly one seat');
    assert(created.state.presence?.some(p=>p.seat===1&&p.online),'host heartbeat should be online');

    const guest=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P3 Guest'}})).data;
    guestToken=guest.token;revision=guest.state.revision;
    assert(guest.role==='player'&&guest.state.players.length===2,'guest should claim second seat');

    const watched=(await req('/api/rooms/'+room+'/spectate')).data;
    spectatorId=watched.spectatorId;
    assert(watched.role==='spectator'&&spectatorId,'spectator should receive a presence id');

    const move=(await req('/api/rooms/'+room+'/action',{method:'POST',token:hostToken,body:{action:'move',i:112,revision}})).data;
    revision=move.revision;
    assert(move.game.moves.length===1,'first move should commit');

    departedGuestToken=guestToken;const left=(await req('/api/rooms/'+room+'/leave',{method:'POST',token:guestToken,body:{revision}})).data;
    guestToken='';
    assert(left.left===true&&!left.roomDeleted,'guest leave should preserve host room');
    assert(left.state.players.length===1,'guest seat should be released');
    assert(left.state.game.result?.reason==='abandon','active departure should end the round by abandonment');
    revision=left.state.revision;

    const claimed=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'P3 Replacement',viewerId:spectatorId}})).data;
    replacementToken=claimed.token;spectatorId='';revision=claimed.state.revision;
    assert(claimed.role==='player','spectator should be promotable into the open seat');
    assert(claimed.state.players.length===2,'replacement should restore two-player occupancy');
    assert(claimed.state.game.moves.length===0&&!claimed.state.game.result,'replacement should start a fresh round');
    assert(claimed.state.round===2,'replacement after a played round should advance round number');

    const oldGuest=await req('/api/rooms/'+room,{token:departedGuestToken,ok:[401]});
    assert(oldGuest.status===401,'departed player token must lose seat authorization');

    const listed=(await req('/api/rooms')).data.rooms.find(r=>r.id===room);
    assert(listed&&listed.playerCount===2&&listed.onlineCount===2,'lobby should report both replacement players online');

    const replacementState=(await req('/api/rooms/'+room,{token:replacementToken})).data;
    await req('/api/rooms/'+room+'/leave',{method:'POST',token:replacementToken,body:{revision:replacementState.revision}});
    replacementToken='';
    const hostState=(await req('/api/rooms/'+room,{token:hostToken})).data;
    const finalLeave=(await req('/api/rooms/'+room+'/leave',{method:'POST',token:hostToken,body:{revision:hostState.revision}})).data;
    hostToken='';
    assert(finalLeave.roomDeleted===true,'last player leaving should delete the room');
    const after=(await req('/api/rooms')).data.rooms.find(r=>r.id===room);
    assert(!after,'deleted room must disappear from lobby');
  }finally{
    await leave(room,replacementToken,revision);
    await leave(room,guestToken,revision);
    await leave(room,hostToken,revision);
    if(spectatorId)try{await req('/api/rooms/'+room+'/spectate/leave',{method:'POST',body:{viewerId:spectatorId},ok:[200,404]});}catch{}
  }
}

async function scenarioVacantHostSeatAndRace(){
  const room=id('P3HOST');let hostToken='',guestToken='',winnerToken='',loserViewer='',revision=0;
  try{
    const created=(await req('/api/rooms',{method:'POST',body:{id:room,name:'Seat One'}})).data;
    hostToken=created.token;
    const guest=(await req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'Seat Two'}})).data;
    guestToken=guest.token;revision=guest.state.revision;

    const left=(await req('/api/rooms/'+room+'/leave',{method:'POST',token:hostToken,body:{revision}})).data;
    hostToken='';revision=left.state.revision;
    assert(left.state.players.length===1&&left.state.players[0].seat===2,'seat 1 must be releasable while seat 2 survives');

    const attempts=await Promise.all([
      req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'Racer A'}}),
      req('/api/rooms/'+room+'/join',{method:'POST',body:{name:'Racer B'}})
    ]);
    const players=attempts.filter(x=>x.data.role==='player'),spectators=attempts.filter(x=>x.data.role==='spectator');
    assert(players.length===1&&spectators.length===1,'concurrent seat claims must produce exactly one winner');
    const winner=players[0].data;winnerToken=winner.token;revision=winner.state.revision;
    loserViewer=spectators[0].data.spectatorId||'';
    assert(winner.state.you.seat===1,'vacant host seat should be reclaimable as seat 1');
    assert(winner.state.players.length===2,'race winner should restore full room');

    const winnerState=(await req('/api/rooms/'+room,{token:winnerToken})).data;
    await req('/api/rooms/'+room+'/leave',{method:'POST',token:winnerToken,body:{revision:winnerState.revision}});
    winnerToken='';
    const guestState=(await req('/api/rooms/'+room,{token:guestToken})).data;
    const finalLeave=(await req('/api/rooms/'+room+'/leave',{method:'POST',token:guestToken,body:{revision:guestState.revision}})).data;
    guestToken='';
    assert(finalLeave.roomDeleted===true,'remaining seat 2 player should be able to close room cleanly');
  }finally{
    await leave(room,winnerToken,revision);
    await leave(room,guestToken,revision);
    await leave(room,hostToken,revision);
    if(loserViewer)try{await req('/api/rooms/'+room+'/spectate/leave',{method:'POST',body:{viewerId:loserViewer},ok:[200,404]});}catch{}
  }
}

await scenarioDepartureAndReplacement();
await sleep(100);
await scenarioVacantHostSeatAndRace();
console.log('PASS P3 live room lifecycle: leave, abandonment, replacement, vacant host seat, presence, cleanup, and concurrent seat claim.');
