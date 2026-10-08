/* A3 — pure analysis-workspace view model; no rules or engine evaluation here. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.GomokuAnalysisWorkspace3=api;
})(typeof globalThis==='object'?globalThis:null,function(){
  'use strict';
  const point=i=>Number.isInteger(i)&&i>=0&&i<225;
  const coord=i=>point(i)?'ABCDEFGHJKLMNOP'[i%15]+(15-Math.floor(i/15)):'Pass';
  const xy=i=>({x:(i%15)*10+5,y:Math.floor(i/15)*10+5});
  const pick=(result,i)=>result?.candidates?.find(c=>c.i===i)||null;
  function legalVariation(core,position,rule,candidate){
    if(!candidate||!point(candidate.i)||!Array.isArray(position?.board))return [];
    const proposed=Array.isArray(candidate.pv)?candidate.pv:[];
    const sequence=proposed[0]===candidate.i?proposed:[candidate.i,...proposed];
    // The established review core enforces all variant rules, passes and terminal states.
    try{return core.line(position.board,position.color,rule,sequence.slice(0,24),position.context).moves;}
    catch{return [];}
  }
  function previewState(core,position,rule,result,preview){
    if(!preview||!point(preview.move))return null;
    const candidate=pick(result,preview.move);
    const moves=legalVariation(core,position,rule,candidate);
    if(!moves.length)return null;
    const step=Math.max(0,Math.min(moves.length,Number.isInteger(preview.step)?preview.step:0));
    const trace=core.line(position.board,position.color,rule,moves.slice(0,step),position.context);
    if(!trace?.states?.length)return null;
    return {state:trace.states.at(-1),step,total:moves.length,moves,candidate};
  }
  function overlays(position,result,board,{mode='candidates',preview=null,pinned=null,validMoves=[]}={}){
    if(!Array.isArray(position?.board)||position.board.length!==225)return {dots:[],arrows:[],legend:'Position unavailable'};
    if(!result)return {dots:[],arrows:[],legend:'Analysis pending'};
    const dots=[],arrows=[];
    const add=(i,type,label)=>{if(point(i)&&!board?.[i]&&!dots.some(x=>x.i===i))dots.push({i,...xy(i),type,label});};
    if(mode==='threats'){
      for(const i of result.explanation?.highlights||[])add(i,'threat','Tactical point');
      for(const i of result.defense?.rootThreats?.map(t=>t.move)||[])add(i,'threat','Verified opponent attack');
      return {dots,arrows,legend:dots.length?'Tactical points; unknown attacks may remain':'No tactical points established at this search budget'};
    }
    const focus=preview?.move??(point(result.best)?result.best:null);
    if(mode==='candidates'){
      for(const c of (result.candidates||[]).filter(c=>c.bound!=='verified-loss').slice(0,8)){
        add(c.i,c.i===result.best?'best':'candidate',c.comparison?.scoreComparable?'Comparable searched candidate':'Candidate; score unverified');
      }
      if(point(pinned))add(pinned,'pinned','Pinned alternative');
      return {dots,arrows,legend:'Measured candidates only; not a heatmap of all 225 points'};
    }
    const legal=(Array.isArray(validMoves)?validMoves:[]).filter(point).slice(0,12);
    for(let k=0;k<legal.length;k++){
      const i=legal[k],p=xy(i);
      dots.push({i,...p,type:k===0?'best':'variation',label:'Variation move '+(k+1)});
      if(k){const q=xy(legal[k-1]);arrows.push({from:legal[k-1],to:i,x1:q.x,y1:q.y,x2:p.x,y2:p.y});}
    }
    return {dots,arrows,legend:legal.length?'Searched continuation; not a verified proof':'No continuation available'};
  }
  function compare(result,pinned,previewMove){
    const first=pick(result,pinned),second=pick(result,previewMove);
    if(!first||!second||first.i===second.i)return null;
    const summary=c=>({move:c.i,coord:coord(c.i),label:c.label||'Unscored',bound:c.bound||'unknown',
      depth:Number.isInteger(c.depth)?c.depth:0,comparable:c.comparison?.scoreComparable===true,
      proof:c.bound==='verified-loss'?'Verified opponent win after move':c.basis==='verified-proof'?'Verified winning line':null});
    return {left:summary(first),right:summary(second),numericComparison:
      first.comparison?.scoreComparable===true&&second.comparison?.scoreComparable===true&&
      first.depth===second.depth&&Number.isFinite(first.score)&&Number.isFinite(second.score)};
  }
  return Object.freeze({coord,xy,legalVariation,previewState,overlays,compare});
});
