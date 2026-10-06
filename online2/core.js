/* Gomoku 1.7 — Online Competition 2.0 pure navigation/context model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuOnline2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.7.0';
  const clean=v=>String(v??'').trim();
  function roomKind(room){
    const s=room?.state||{};
    if(s.tournament)return 'tournament';
    if(s.challenge)return 'challenge';
    if(s.ranked)return 'ranked';
    return room?.id?'room':'none';
  }
  function context(account={},room=null){
    const connected=account?.connected===true;
    const username=clean(account?.username);
    const kind=roomKind(room);
    const active=kind!=='none';
    const spectator=active&&room?.role==='spectator';
    const roomId=clean(room?.id);
    return {
      version:VERSION,connected,username,identityReady:connected&&!!username,
      activeRoom:active,roomKind:kind,roomId,spectator,
      rankedReady:connected&&!!username
    };
  }
  function primary(account={},room=null){
    const c=context(account,room);
    if(c.activeRoom){
      const label=c.roomKind==='ranked'?'Return to ranked match':
        c.roomKind==='tournament'?'Return to tournament match':
        c.roomKind==='challenge'?'Return to challenge':
        c.spectator?'Return to spectating':'Return to room';
      return {id:'active-room',label,detail:c.roomId?'Room '+c.roomId:'Your online game is active.'};
    }
    if(!c.identityReady)return {id:'rooms',label:'Play online',detail:'Create or join an anonymous room now. Connect THIEPN Account when you want ranked play, seasons, cups, and a public profile.'};
    return {id:'ranked',label:'Find ranked match',detail:'Your competitive identity is ready. Ranked matchmaking is the fastest route into a rated game.'};
  }
  function destinations(account={},room=null){
    const c=context(account,room);
    return [
      {id:'ranked',label:'Ranked',detail:c.rankedReady?'Rating, matchmaking and leaderboard.':'Connect an account + public username to unlock ranked.',enabled:true,locked:!c.rankedReady},
      {id:'competition',label:'Seasons & cups',detail:'Season standings, Renju cups and tournament assignments.',enabled:true,locked:!c.identityReady},
      {id:'rooms',label:'Rooms & history',detail:'Create, join or spectate rooms and reopen completed online games.',enabled:true,locked:false},
      {id:'identity',label:'Competitive identity',detail:c.username?'@'+c.username+' · profile, career and achievements.':'Account, username and player profile.',enabled:true,locked:!c.identityReady},
      {id:'community',label:'Community',detail:'Players, rivals, favorites and direct challenges.',enabled:true,locked:!c.identityReady}
    ];
  }
  function summary(account={},room=null){
    const c=context(account,room),p=primary(account,room);
    return {
      context:c,primary:p,destinations:destinations(account,room),
      identity:c.identityReady?'@'+c.username:c.connected?'Account connected · username required':'Anonymous online',
      room:c.activeRoom?
        (c.roomKind==='ranked'?'Ranked match':c.roomKind==='tournament'?'Tournament match':c.roomKind==='challenge'?'Direct challenge':c.spectator?'Spectating':'Online room'):
        'No active room'
    };
  }
  return Object.freeze({VERSION,roomKind,context,primary,destinations,summary});
});