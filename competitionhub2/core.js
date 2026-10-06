/* Gomoku 1.7 — Competition Hub 2.0 pure routing model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuCompetitionHub2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.7.0';
  function accountState(account={}){
    const connected=account?.connected===true,username=String(account?.username||'').trim();
    return {connected,username,rankedReady:connected&&!!username};
  }
  function current(local=null,online=null){
    if(online&&typeof online==='object'&&online.id){
      const ranked=online.state?.ranked===true;
      return {kind:'online',label:ranked?'Ranked room':'Online room',detail:String(online.id),action:'return-online'};
    }
    if(local&&typeof local==='object'&&local.config){
      const score=local.score||{},total=Number(local.config.total)||1,game=Number(local.game)||1;
      return {kind:'local',label:'Competitive match',detail:`Game ${game} / ${total} · ${Number(score.a)||0}–${Number(score.b)||0}`,action:'return-local'};
    }
    return {kind:'none',label:'No active competition',detail:'Choose how you want to compete.',action:'none'};
  }
  function cards(account={},local=null,online=null){
    const a=accountState(account),now=current(local,online);
    return [
      {id:'local',title:'Local competitive',detail:'Clocks, balanced openings and match series.',enabled:now.kind!=='online',badge:now.kind==='local'?'Active':null},
      {id:'ranked',title:'Ranked Renju',detail:a.rankedReady?'Rating-based matchmaking with verified identity.':a.connected?'Create a public username to enter ranked matchmaking.':'Connect THIEPN Account to enter ranked matchmaking.',enabled:now.kind!=='local',badge:a.rankedReady?'Ready':'Account'},
      {id:'tournaments',title:'Seasons & tournaments',detail:'Live cups, brackets, check-in and spectating.',enabled:true,badge:null},
      {id:'community',title:'Players & challenges',detail:'Verified profiles, rivalries and direct challenges.',enabled:true,badge:a.connected?'Connected':'Account optional'},
      {id:'rooms',title:'Casual rooms',detail:'Create, join or spectate invite-style Renju rooms.',enabled:now.kind!=='local',badge:now.kind==='online'?'Active':null}
    ];
  }
  function model(account={},local=null,online=null){
    return {version:VERSION,account:accountState(account),current:current(local,online),cards:cards(account,local,online)};
  }
  return Object.freeze({VERSION,accountState,current,cards,model});
});