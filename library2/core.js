/* Gomoku 1.9 — Library & Archive 2.0 pure composition model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuLibrary2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.9.0';
  const clean=v=>String(v??'').trim();
  const num=(v,min=0,max=100000)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0)));
  function ordered(entries=[]){
    return (Array.isArray(entries)?entries:[]).slice().sort((a,b)=>clean(b?.date).localeCompare(clean(a?.date))||clean(a?.title).localeCompare(clean(b?.title)));
  }
  function digestMap(digests=[]){
    const out=new Map();
    for(const row of Array.isArray(digests)?digests:[])if(row?.id)out.set(String(row.id),row.digest||null);
    return out;
  }
  function classify(entry,digest){
    const data=entry?.data||{},mode=clean(data.mode),moves=Array.isArray(data.moves)?data.moves.length:0;
    const valid=!!digest?.valid,reviewable=valid&&num(digest.total)>0;
    const needsReview=reviewable&&digest.needsAnalysis===true;
    const flagged=reviewable&&num(digest.flagged)>0;
    const current=reviewable&&digest.current===true&&!needsReview;
    return {
      id:clean(entry?.id),title:clean(entry?.title)||'Untitled',
      date:clean(entry?.date),mode,moves,study:mode==='study',
      reviewable,needsReview,flagged,current,
      flaggedCount:flagged?num(digest.flagged):0,
      worst:digest?.worst||null
    };
  }
  function summary(state={},digests=[],currentGame={}){
    const entries=ordered(state?.items),by=digestMap(digests),rows=entries.map(e=>classify(e,by.get(String(e.id))));
    const reviewedRows=rows.filter(r=>r.current);
    const stale=rows.filter(r=>r.needsReview);
    const flagged=reviewedRows.filter(r=>r.flagged);
    const studies=rows.filter(r=>r.study);
    const currentMoves=Array.isArray(currentGame?.moves)?currentGame.moves.length:Array.isArray(currentGame?.records)?currentGame.records.length:0;
    const currentSetup=Array.isArray(currentGame?.initial)?currentGame.initial.length:0;
    let primary;
    if(!rows.length){
      primary=currentMoves||currentSetup
        ?{id:'save-current',label:'Save current board',detail:'Keep this game or study in the Library before replacing it.'}
        :{id:'play',label:'Play a game',detail:'Your archive is empty. Finish or begin a game, then save the positions worth keeping.'};
    }else if(stale.length){
      primary={id:'review-center',label:'Review saved games',detail:stale.length+' saved game'+(stale.length===1?' needs':'s need')+' current or complete review evidence.'};
    }else if(flagged.length){
      const target=flagged.slice().sort((a,b)=>b.flaggedCount-a.flaggedCount||b.date.localeCompare(a.date))[0];
      primary={id:'flagged',entryId:target.id,ply:num(target.worst?.ply,1,10000)||null,label:'Revisit key moments',detail:target.title+' has '+target.flaggedCount+' current flagged decision'+(target.flaggedCount===1?'':'s')+'.'};
    }else{
      const latest=rows[0];
      primary={id:'latest',entryId:latest?.id||'',label:'Open latest save',detail:latest?latest.title+' · '+(latest.study?'study':'saved game'):'Return to your archive.'};
    }
    return {
      version:VERSION,
      backend:clean(state?.backend)||'unknown',
      revision:num(state?.revision),
      limit:num(state?.limit),
      rows,
      counts:{
        total:rows.length,
        studies:studies.length,
        needsReview:stale.length,
        flagged:flagged.length,
        reviewed:reviewedRows.length
      },
      primary
    };
  }
  return Object.freeze({VERSION,ordered,classify,summary});
});
