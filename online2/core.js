/* Gomoku 1.7 — Online Play 2.0 pure experience model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuOnline2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.7.0';
  const clean=(v,fallback='')=>String(v??fallback).trim().slice(0,80);
  const num=(v,min=0,max=999)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0)));
  function kind(room={}){
    const st=room?.state||{};
    if(st.ranked===true)return 'ranked';
    if(st.tournament||st.tournamentId||st.competition?.type==='tournament')return 'tournament';
    if(st.challenge||st.challengeId||st.competition?.type==='challenge')return 'challenge';
    return 'casual';
  }
  function session(room={}){
    if(!room||!room.id)return {active:false,version:VERSION,kind:'offline',role:'none',phase:'offline'};
    const st=room.state||{},game=st.game||{},players=Array.isArray(st.players)?st.players:[],role=room.role==='spectator'?'spectator':'player';
    const finished=!!(game.result||game.terminal),ready=players.length>=2;
    const phase=finished?'finished':ready?'playing':'waiting';
    const type=kind(room),round=Math.max(1,num(st.round,1,999));
    const labels={
      ranked:'Ranked Renju',
      tournament:'Tournament',
      challenge:'Direct challenge',
      casual:'Private room'
    };
    return {
      active:true,version:VERSION,kind:type,role,phase,finished,ready,
      roomId:clean(room.id,'ROOM'),round,players:players.length,
      label:labels[type],
      spectator:role==='spectator',
      tournament:st.tournament||null,
      challenge:st.challenge||null,
      rankedResult:st.rankedResult||null
    };
  }
  function context(room={}){
    const s=session(room);if(!s.active)return {active:false,eyebrow:'OFFLINE',title:'Not in an online room',detail:''};
    const prefix=s.spectator?'SPECTATING':'ONLINE';
    const state=s.phase==='finished'?'Game complete':s.phase==='playing'?'Game in progress':'Waiting for opponent';
    return {
      ...s,
      eyebrow:prefix+' · '+s.label.toUpperCase(),
      title:state,
      detail:'Room '+s.roomId+' · round '+s.round+(s.spectator?' · read-only':'')
    };
  }
  function postGame(room={}){
    const s=session(room);if(!s.active||!s.finished)return null;
    let detail='Room '+s.roomId+' · round '+s.round;
    if(s.kind==='ranked'){
      const rr=s.rankedResult||{},before=Number(rr.before),after=Number(rr.after),delta=Number(rr.delta);
      if(Number.isFinite(after)){
        const change=Number.isFinite(delta)?' ('+(delta>0?'+':'')+delta+')':'';
        detail='Rating '+(Number.isFinite(before)?before+' → ':'')+after+change;
      }else detail='Ranked result · rating update pending';
    }else if(s.kind==='tournament'){
      const t=s.tournament||{};
      detail='Tournament'+(t.round?' · round '+t.round:'')+(t.slot?' · match '+t.slot:'');
    }else if(s.kind==='challenge'){
      detail='Direct challenge complete';
    }
    return {
      kind:s.kind,eyebrow:s.label.toUpperCase(),detail,
      primary:s.spectator?'':s.kind==='ranked'?'Find next ranked match':s.kind==='casual'?'Rematch':'',
      review:s.spectator?'':'Review game'
    };
  }
  function launcher(){
    return [
      {id:'ranked',title:'Ranked',detail:'Rating-based matchmaking with verified accounts.'},
      {id:'competition',title:'Tournaments & players',detail:'Cups, seasons, challenges, profiles and rivalries.'},
      {id:'private',title:'Private room',detail:'Create or join a room by name.'},
      {id:'live',title:'Live rooms',detail:'Join a waiting room or spectate a game.'}
    ];
  }
  return Object.freeze({VERSION,kind,session,context,postGame,launcher});
});