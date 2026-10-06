/* Gomoku 1.4 — Game Feel 2.0 pure choreography model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuGameFeel2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.4.0';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const outcome=(game={},result={})=>{
    const winner=Number(result.winner)||0;
    if(!winner)return 'draw';
    if(game.mode==='ai'&&[1,2].includes(Number(game.humanColor)))return winner===Number(game.humanColor)?'win':'loss';
    return 'neutral';
  };
  function reasonLabel(reason='',line=[]){
    if(reason==='timeout')return 'Time expired';
    if(reason==='agreement')return 'Agreed draw';
    if(reason==='resign')return 'Resignation';
    if(reason==='passes')return 'Two consecutive passes';
    if(reason==='full')return 'Full board';
    if(reason==='five')return (Array.isArray(line)&&line.length?Math.max(5,line.length):5)+' in a row';
    return 'Game complete';
  }
  function resultCopy(game={},result={},names={}){
    const kind=outcome(game,result),winner=Number(result.winner)||0,moves=Math.max(0,Number(result.moves)||0);
    const human=Number(game.humanColor)||1,black=String(names.black||'Black'),white=String(names.white||'White');
    let title;
    if(kind==='win')title='You win';
    else if(kind==='loss')title=(winner===1?black:white)+' wins';
    else if(kind==='draw')title='Game drawn';
    else title=winner?(winner===1?black:white)+' wins':'Game drawn';
    const side=game.mode==='ai'?(human===1?'Black':'White'):null;
    const reason=reasonLabel(result.reason,Array.isArray(result.winLines)?result.winLines[0]:[]);
    return {kind,title,reason,moves,side,stamp:kind==='win'?'勝':kind==='loss'?'終':kind==='draw'?'和':'終'};
  }
  function movePlan(detail={},reduced=false){
    const i=Number(detail.i),origin=String(detail.origin||'human'),pass=i<0;
    return {version:VERSION,point:Number.isInteger(i)&&i>=0&&i<225?i:null,origin,pass,
      impact:!reduced&&!pass,boardPulse:!reduced&&!pass,handoff:true,
      strength:origin==='engine'?.78:1};
  }
  function particles(seed=1,count=14){
    let x=(Number(seed)||1)>>>0;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
    const n=Math.round(clamp(Number(count)||14,0,24)),rows=[];
    for(let i=0;i<n;i++){
      const angle=(-Math.PI*.95)+rand()*Math.PI*1.9,dist=28+rand()*70;
      rows.push({dx:Number((Math.cos(angle)*dist).toFixed(2)),dy:Number((Math.sin(angle)*dist).toFixed(2)),
        delay:Math.round(rand()*90),size:Number((3.5+rand()*4.5).toFixed(2)),turn:Number((-80+rand()*160).toFixed(1))});
    }
    return rows;
  }
  function resultPlan(game={},result={},reduced=false){
    const copy=resultCopy(game,result),celebrate=copy.kind==='win'&&!reduced;
    return {copy,showBanner:true,winLine:Array.isArray(result.winLines?.[0])?result.winLines[0].filter(i=>Number.isInteger(i)&&i>=0&&i<225).slice(0,15):[],
      particles:celebrate?particles((copy.moves+1)*2654435761,14):[],celebrate};
  }
  return Object.freeze({VERSION,outcome,reasonLabel,resultCopy,movePlan,particles,resultPlan});
});