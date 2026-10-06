/* Gomoku 1.5 — Post-Game Experience 2.0 pure orchestration model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuPostGame2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.5.0';
  const clampInt=(v,min=0,max=100000)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0)));
  function outcome(game={},result={}){
    const winner=Number(result.winner)||0;
    if(!winner)return 'draw';
    const human=Number(game.humanColor)||0;
    if(game.mode==='ai'&&(human===1||human===2))return winner===human?'win':'loss';
    return 'neutral';
  }
  function reviewState(review={}){
    const total=clampInt(review.total);
    const analyzed=clampInt(review.analyzed,0,total||100000);
    const critical=Array.isArray(review.critical)?review.critical.length:clampInt(review.critical);
    const complete=total>0&&analyzed>=total;
    const state=critical>0?'key-moments':complete?'reviewed-clear':analyzed>0?'partial':'unreviewed';
    return {total,analyzed,critical,complete,state};
  }
  function recommendation(review={}){
    const r=reviewState(review);
    if(r.state==='reviewed-clear')return {
      action:'rematch',
      label:'Play another',
      eyebrow:'REVIEW COMPLETE',
      detail:'No actionable mistake was established in the completed review. You can still inspect any move.'
    };
    if(r.state==='key-moments')return {
      action:'review',
      label:'Review key moments',
      eyebrow:'NEXT USEFUL STEP',
      detail:r.critical+' decision'+(r.critical===1?'':'s')+' '+(r.critical===1?'is':'are')+' ready to explore.'
    };
    if(r.state==='partial')return {
      action:'review',
      label:'Continue review',
      eyebrow:'REVIEW IN PROGRESS',
      detail:r.analyzed+' of '+r.total+' decisions checked. Continue while the remaining moves are analyzed.'
    };
    return {
      action:'review',
      label:'Review key moments',
      eyebrow:'NEXT USEFUL STEP',
      detail:'Let Guided Review scan this game, surface the moves that mattered, and let you retry them.'
    };
  }
  function viewModel(game={},result={},review={}){
    const r=reviewState(review),next=recommendation(review),kind=outcome(game,result);
    const moves=clampInt(result.moves??game.records?.length??game.moves?.length);
    return {
      version:VERSION,kind,moves,review:r,next,
      status:r.state==='unreviewed'?'Not reviewed yet':
        r.state==='partial'?r.analyzed+' / '+r.total+' decisions checked':
        r.state==='key-moments'?r.critical+' key moment'+(r.critical===1?'':'s')+' ready':
        'Review complete'
    };
  }
  return Object.freeze({VERSION,outcome,reviewState,recommendation,viewModel});
});