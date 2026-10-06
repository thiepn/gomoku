/* Gomoku 1.8 — Opening Study & Repertoire 2.0 pure composition model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuOpening2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.8.0';
  const OPENING_SKILLS=Object.freeze(['opening-shape','opening-flexibility']);
  const clean=v=>String(v??'').trim();
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(Number(v)||0)));
  const RULES=Object.freeze({
    'renju-practice':'Renju',
    'exact-five':'Exact-five',
    'freestyle':'Freestyle'
  });
  function openingSkills(learning={}){
    const rows=(Array.isArray(learning?.skills)?learning.skills:[]).filter(s=>OPENING_SKILLS.includes(s?.id));
    if(!rows.length)return {available:false,evidenced:false,average:0,state:'new',due:0,weakest:null,skills:[]};
    const average=Math.round(rows.reduce((n,s)=>n+clamp(s.score),0)/rows.length);
    const due=rows.reduce((n,s)=>n+Math.max(0,Number(s.due)||0),0);
    const evidenced=rows.some(s=>(Number(s.evidence)||0)>0||(Number(s.course)||0)>0);
    const weakest=rows.slice().sort((a,b)=>clamp(a.score)-clamp(b.score)||clean(a.title).localeCompare(clean(b.title)))[0]||null;
    const state=average>=82?'mastered':average>=68?'strong':average>=45?'developing':average>=15?'building':'new';
    return {
      available:true,evidenced,average,state,due,
      weakest:weakest?{id:weakest.id,title:clean(weakest.title)||weakest.id,score:clamp(weakest.score)}:null,
      skills:rows.map(s=>({id:s.id,title:clean(s.title)||s.id,score:clamp(s.score),state:clean(s.state),due:Math.max(0,Number(s.due)||0)}))
    };
  }
  function gameContext(game={}){
    const records=Array.isArray(game.records)?game.records:Array.isArray(game.moves)?game.moves:[];
    const moves=records.length;
    const setup=Array.isArray(game.initial)?game.initial.length:0;
    const variant=clean(game.variant)||'renju-practice';
    return {
      variant,rule:RULES[variant]||variant,moves,setup,
      early:moves>0&&moves<=20&&setup===0,
      title:clean(game.title)
    };
  }
  function primary(game={},learning={}){
    const g=gameContext(game),skills=openingSkills(learning);
    if(g.early)return {
      id:'explorer',label:'Explore this position',
      detail:'Compare continuations from matching games in your local Library before leaving the current opening.'
    };
    if(!skills.evidenced)return {
      id:'concepts',label:'Build opening fundamentals',
      detail:'Start with Chapter 11 before trying to memorize branches without a conceptual base.'
    };
    if(skills.average<68)return {
      id:'concepts',label:'Strengthen opening concepts',
      detail:(skills.weakest?.title||'Opening fundamentals')+' is the weakest current opening skill. Revisit the authored concept work first.'
    };
    return {
      id:'repertoire',label:'Rehearse repertoire',
      detail:'Your opening evidence is established. Test recall of continuations you explicitly stored in this study.'
    };
  }
  function destinations(game={},learning={}){
    const g=gameContext(game),skills=openingSkills(learning);
    return [
      {id:'lab',label:'Opening Lab',detail:'Protocols, opening procedure and the current-board local explorer.'},
      {id:'database',label:'Source database',detail:'Query imported or Library records. Frequencies and results describe the corpus only.'},
      {id:'repertoire',label:'Repertoire',detail:'Recall continuations explicitly stored in the current study.'},
      {id:'concepts',label:'Opening concepts',detail:skills.evidenced?'Revisit Chapter 11 and transfer opening shape into play.':'Build Chapter 11 fundamentals before memorizing lines.'}
    ];
  }
  function summary(game={},learning={}){
    const g=gameContext(game),skills=openingSkills(learning),next=primary(game,learning);
    return {
      version:VERSION,game:g,skills,primary:next,destinations:destinations(game,learning),
      position:g.moves?g.rule+' · move '+g.moves:g.rule+' · empty board',
      skillLabel:skills.evidenced?'Opening skills '+skills.average+'% · '+skills.state+(skills.due?' · '+skills.due+' due':''):'Opening skills · baseline not established'
    };
  }
  return Object.freeze({VERSION,OPENING_SKILLS,openingSkills,gameContext,primary,destinations,summary});
});
