/* Gomoku 1.3 — AI 2.0 browser runtime.
 * Transparent between-game adaptation + search telemetry. */
(()=>{
  'use strict';
  if(window.GomokuAI2)return;
  const Core=window.GomokuAI2Core;if(!Core)return;
  const KEY='gomoku.ai2.v1',MAX_GAMES=80,MAX_SEARCHES=80;
  const $=id=>document.getElementById(id);
  let refreshTimer=0,dialog=null;
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch{return {};}}
  function clean(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    const entries=(Array.isArray(raw.games)?raw.games:[]).map(Core.normalizeGame).filter(Boolean).slice(-MAX_GAMES);
    const maxSeq=entries.reduce((n,g)=>Math.max(n,g.seq||0),0);
    const totalGames=Math.max(entries.length,maxSeq,Math.floor(Number(raw.totalGames)||0));
    // Preserve older local AI 2.0 saves without losing their game history.
    const offset=totalGames-entries.length;
    const games=entries.map((g,i)=>({...g,seq:g.seq||offset+i+1}));
    const searches=(Array.isArray(raw.searches)?raw.searches:[]).filter(x=>x&&typeof x==='object').slice(-MAX_SEARCHES);
    return {version:1,adaptive:raw.adaptive===true,games,searches,totalGames,adaptation:raw.adaptation||null,frozen:raw.frozen||null};
  }
  let state=clean(read());
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
  function selected(){try{return window.GomokuStudio?.aiDifficulty?.().current||'mid';}catch{return 'mid';}}
  function effectiveLevel(input={}){
    const sel=Core.LEVELS.includes(input.selected)?input.selected:'mid';
    if(input.mode!=='ai')return sel;
    const gameId=String(input.gameId||'');
    // Difficulty changes and Adaptive toggles cannot affect an ongoing game.
    if(gameId&&state.frozen?.gameId===gameId&&Core.LEVELS.includes(state.frozen.level))return state.frozen.level;
    const resolved=state.adaptive?Core.resolveAdaptive(sel,state.games,state.adaptation,state.totalGames):null;
    if(resolved)state.adaptation=resolved.state;
    const level=resolved?resolved.level:sel;
    if(gameId){state.frozen={gameId,selected:sel,level,adaptive:state.adaptive,at:Date.now()};save();schedule();}
    return level;
  }
  function searchConfig(level,base,context={}){
    const tuned=Core.tuneSearch(level,base);
    return {...tuned,ai2Context:{mode:String(context.mode||''),rule:String(context.rule||''),moveCount:Number(context.moveCount)||0}};
  }
  function noteSearch(d={}){
    if(!d||!Core.LEVELS.includes(d.effectiveLevel))return;
    state.searches.push({at:Date.now(),gameId:String(d.gameId||''),selectedLevel:d.selectedLevel,effectiveLevel:d.effectiveLevel,
      reason:String(d.reason||''),depth:Number(d.depth)||0,nodes:Number(d.nodes)||0,elapsedMs:Number(d.elapsedMs)||0,
      backend:String(d.backend||''),confidence:String(d.confidence||''),humanized:d.humanized===true});
    state.searches=state.searches.slice(-MAX_SEARCHES);save();schedule(50);
  }
  function finishGame(detail){
    try{
      if(!detail?.result)return;
      const game=window.GomokuStudio?.exportGame?.();if(!game||game.mode!=='ai')return;
      const id=String(game.gameId||'');if(!id||state.games.some(g=>g.id===id))return;
      const human=Number(game.humanColor)||1,winner=Number(detail.result.winner),outcome=winner===0?'draw':winner===human?'win':'loss';
      const frozen=state.frozen&&state.frozen.gameId===id?state.frozen:null;
      state.totalGames+=1;
      state.games.push({id,at:Date.now(),seq:state.totalGames,outcome,effectiveLevel:frozen?.level||game.level||selected(),
        selectedLevel:frozen?.selected||game.level||selected(),assisted:game.assisted===true,rule:game.variant||''});
      state.games=state.games.slice(-MAX_GAMES);if(frozen)state.frozen=null;save();schedule(20);
    }catch{}
  }
  function setAdaptive(value){
    state.adaptive=value===true;
    // A changed setting applies to the NEXT game, not the current move.
    if(state.adaptive)state.adaptation=Core.freshAdaptive(selected(),state.totalGames);
    save();render();window.dispatchEvent(new CustomEvent('gomoku-ai2-changed',{detail:{adaptive:state.adaptive}}));return state.adaptive;
  }
  function recordSummary(){
    const sel=selected(),res=Core.resolveAdaptive(sel,state.games,state.adaptation,state.totalGames),
      rows=Core.eligible(state.games,res.level,res.state.lastChangeGameCount),p=Core.performance(rows);
    return {selected:sel,effective:state.adaptive?(state.frozen?.level||res.level):sel,adaptive:state.adaptive,performance:p,reason:res.reason,games:state.games.length,searches:state.searches.length};
  }
  function ensureUI(){
    const host=$('levelSection');if(!host)return false;
    if(!$('ai2OpponentCard')){
      const card=document.createElement('div');card.id='ai2OpponentCard';card.className='ai2-card';
      card.innerHTML='<div class="ai2-card-head"><div><span>AI 2.0</span><b>Adaptive opponent</b></div><label class="ai2-switch"><input id="ai2AdaptiveToggle" type="checkbox"><span>Adaptive</span></label></div><p id="ai2Status"></p><button type="button" id="ai2Details">How difficulty works</button>';
      host.append(card);$('ai2AdaptiveToggle').onchange=e=>setAdaptive(e.target.checked);$('ai2Details').onclick=openDetails;
    }
    return true;
  }
  function render(){
    if(!ensureUI())return;
    const x=recordSummary(),cfg=window.GomokuStudio?.aiDifficulty?.().levels||{};
    $('ai2AdaptiveToggle').checked=state.adaptive;
    const selLabel=cfg[x.selected]?.label||Core.LABELS[x.selected]||x.selected,effLabel=cfg[x.effective]?.label||Core.LABELS[x.effective]||x.effective;
    $('ai2Status').textContent=!state.adaptive
      ?'Fixed at '+selLabel+'. Enable Adaptive to adjust only between completed games.'
      :'Playing at '+effLabel+(x.effective!==x.selected?' · starting choice '+selLabel:'')+' · '+x.performance.games+' eligible recent game'+(x.performance.games===1?'':'s')+' at this strength.';
    if(state.frozen&&(state.frozen.selected!==x.selected||state.frozen.adaptive!==state.adaptive)){
      $('ai2Status').textContent+=' Changes to difficulty apply in the next game.';
    }
    if(dialog?.open)renderDetails();
  }
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='ai2Dialog';dialog.className='ai2-dialog';dialog.setAttribute('aria-labelledby','ai2DialogTitle');
    dialog.innerHTML='<div class="ai2-dialog-shell"><header><div><span>AI 2.0</span><h2 id="ai2DialogTitle">Opponent calibration</h2></div><button type="button" id="ai2Close" aria-label="Close">×</button></header><div id="ai2DialogBody"></div></div>';
    document.body.append(dialog);$('ai2Close').onclick=()=>dialog.close();dialog.addEventListener('cancel',()=>dialog.close());return dialog;
  }
  function renderDetails(){
    const body=$('ai2DialogBody');if(!body)return;const x=recordSummary(),p=x.performance,last=state.searches.at(-1);
    body.innerHTML='<section><h3>'+(x.adaptive?'Adaptive is on':'Adaptive is off')+'</h3><p>Difficulty is frozen for the whole game, including after setting changes. Each change takes effect in the next game. After at least four unassisted games at the current strength since the last adjustment, a sustained result above 72% can raise it one step; below 28% can lower it one step. A change has a cooldown and never reacts to the current game.</p></section>'+
      '<div class="ai2-metrics"><div><strong>'+p.games+'</strong><span>eligible games</span></div><div><strong>'+Math.round(p.score*100)+'%</strong><span>weighted result</span></div><div><strong>'+state.games.length+'</strong><span>stored AI games</span></div></div>'+
      '<section><h3>Search policy</h3><p>Weak levels keep several plausible candidates so their mistakes remain human-like. Strong levels spend more of the same local-engine budget on the principal line by reducing MultiPV breadth; Expert and Master also receive modestly deeper/wider search.</p>'+
      (last?'<p class="ai2-last">Last search: '+last.effectiveLevel+' · depth '+last.depth+' · '+last.nodes.toLocaleString()+' nodes · '+last.elapsedMs+' ms'+(last.backend?' · '+last.backend:'')+'.</p>':'<p class="ai2-last">No AI 2.0 search telemetry recorded yet.</p>')+'</section>'+
      '<p class="ai2-note">This calibration is not an Elo rating and does not claim optimal play. Analysis/Review remains deterministic and separate from live-opponent humanization.</p>';
  }
  function openDetails(){ensureDialog();renderDetails();if(!dialog.open)dialog.showModal();}
  function schedule(ms=100){clearTimeout(refreshTimer);refreshTimer=setTimeout(render,ms);}
  function snapshot(){return JSON.parse(JSON.stringify({...recordSummary(),history:state.games,adaptation:state.adaptation,lastSearch:state.searches.at(-1)||null}));}
  function boot(){
    window.addEventListener('gomoku:move',e=>{if(e.detail?.result)finishGame(e.detail);else schedule(100);});
    window.addEventListener('storage',e=>{if(e.key===KEY){state=clean(read());schedule(20);}});
    window.addEventListener('gomoku-ai2-search',e=>noteSearch(e.detail));
    schedule(0);setInterval(()=>{if(!$('ai2OpponentCard'))render();},1500);
  }
  window.GomokuAI2=Object.freeze({version:Core.VERSION,effectiveLevel,searchConfig,noteSearch,setAdaptive,snapshot,openDetails,
    calibration:()=>Core.calibrationAudit({})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();