/* Guided Review 1.0. Position-local analysis; the recorded game is never edited. */
function createGuidedReviewCore(engineFactory, studioFactory) {
  'use strict';
  const C = studioFactory(engineFactory);
  const coord = C.coord;
  const point = i => Number.isInteger(i) && i >= 0 && i < 225;
  const severity = label => ({'Blunder':5,'Missed win':4,'Mistake':3,'Inaccuracy':2,'Win available':1}[label] || 0);
  const key = (b,c,r) => `${r}:${c}:${Array.from(b).join('')}`;
  function positions(game) {
    const e = engineFactory(game.variant), moves = game.moves || [];
    e.replay(moves, {initial:game.initial || [],startColor:game.startColor || 1});
    return moves.map((m,k) => {
      const p = e.replay(moves.slice(0,k), {initial:game.initial || [],startColor:game.startColor || 1});
      return {ply:k+1,played:m.i,color:m.color,board:Array.from(p.board),key:key(p.board,m.color,game.variant)};
    });
  }
  function legal(board,color,rule,i) {
    if (i !== -1 && !point(i)) return {legal:false,reason:'Choose an empty intersection.'};
    return engineFactory(rule).legalMove(Int8Array.from(board),i,color,board.filter(Boolean).length);
  }
  function apply(board,color,rule,i) {
    const a = legal(board,color,rule,i);
    if (!a.legal) throw Error(a.reason || 'Illegal move');
    const next = Array.from(board);if(i>=0)next[i] = color;
    return {board:next,color:3-color,result:a.win ? {winner:color} : next.every(Boolean) ? {winner:0} : null};
  }
  function facts(board,color,rule,i) {
    const e = engineFactory(rule), b = Int8Array.from(board);
    const a = i === -1 ? {legal:true,win:false,fours:[],threes:[]} : legal(board,color,rule,i);
    if (!a.legal) return {legal:false,reason:a.reason};
    const ownWins = e.winningMoves(b,color), threats = e.winningMoves(b,3-color);
    if (i >= 0) b[i] = color;
    const replies = a.win ? [] : e.winningMoves(b,3-color);
    const finishes = a.win ? [] : e.winningMoves(b,color);
    // Two winning points cannot both be occupied by one defensive placement.
    return {legal:true,win:!!a.win,ownWins,threats,replies,finishes,
      fours:(a.fours || []).map(f=>({stones:f.stones || [],ends:f.ends || []})),
      threes:(a.threes || []).map(t=>({stones:t.stones || [],extensions:t.extensions || []})),
      alreadyLost:!ownWins.length && threats.length >= 2};
  }
  function judge(r,board,color,played) {
    const f = facts(board,color,r.rule,played);
    if (!f.legal) return {label:'Illegal',basis:'rules',loss:null,best:r.move,facts:f};
    if (f.win) return {label:'Winning move',basis:'rules',loss:0,best:played,facts:f};
    if (f.alreadyLost) return {label:'Already lost',basis:'rules',loss:null,best:r.move,facts:f};
    if (!f.ownWins.length && !f.replies.length && f.finishes.length>=2) return {label:'Winning threat',basis:'rules',loss:0,best:played,facts:f};
    let q = C.assessDecision(r,board,color,played);
    if (q.label === 'Allows immediate win') q = {...q,label:'Blunder'};
    else if (q.label === 'Possible losing move') q = {...q,label:'Blunder'};
    else if (q.label === 'Possible missed win') q = {...q,label:'Missed win'};
    else if (q.label === 'Verified continuation') q = {...q,label:'Winning plan'};
    // A missed one-move win is observable, but does not imply the position is lost.
    if (f.ownWins.length && !f.win && q.label !== 'Winning plan') {
      q = {label:f.replies.length ? 'Blunder' : 'Win available',basis:'rules',loss:null,best:f.ownWins[0]};
    }
    return {...q,facts:f};
  }
  function explain(r,board,color,played,q) {
    const f=q.facts,us=color===1?'Black':'White',them=color===1?'White':'Black',at=coord(played),best=coord(q.best);
    if (!f.legal) return {why:`${at} is not legal: ${f.reason}.`,lesson:'Check the rules before evaluating a move.',highlights:[]};
    if (f.win) return {why:`${at} completes five in a row. The game ends immediately; the opponent gets no reply.`,lesson:'Finish a legal five before looking for a longer plan.',highlights:[played]};
    if (f.alreadyLost) return {why:`${them} already had two immediate winning points: ${f.threats.map(coord).join(' and ')}. ${us} has no immediate win, and one stone cannot block both. This is not a new mistake by ${at}.`,lesson:'Go to the previous key moment: stop the open four before it gets two winning ends.',highlights:f.threats};
    if (f.replies.length && q.basis==='rules' && q.label==='Blunder') return {why:`After ${at}, ${them} can complete five at ${f.replies.map(coord).join(' or ')}. ${best} ${f.ownWins.includes(q.best)?'wins immediately instead':'avoids that immediate loss'}.`,lesson:'Before attacking, check every point where your opponent can win on the next move.',highlights:f.replies};
    if (q.label==='Win available') return {why:`You could have ended the game immediately at ${f.ownWins.map(coord).join(' or ')}. ${at} continues play instead. This does not by itself prove that ${at} loses.`,lesson:'Make the winning move now; do not give the opponent another turn.',highlights:f.ownWins};
    if (q.label==='Winning plan') return {why:`${at} starts a rule-verified forcing strategy. The preview shows one response line, not every possible defense.`,lesson:'Follow the forcing threats; check the opponent’s counter-win at each step.',highlights:[played]};
    let why;
    if (f.replies.length) why=`${at} leaves a winning reply at ${f.replies.map(coord).join(' or ')}. The current search has not established a better defense.`;
    else if (f.threats.includes(played)) why=`${at} blocks ${them}’s immediate winning point. This is the urgent defensive task in this position.`;
    else if (f.finishes.length>=2) why=`${at} creates two immediate winning points, ${f.finishes.map(coord).join(' and ')}. The opponent cannot cover both with one stone, and has no immediate counter-win.`;
    else if (f.finishes.length===1) why=`${at} threatens to finish five at ${coord(f.finishes[0])}. The opponent must answer this threat or win immediately themselves.`;
    else if (f.threes.length) why=`${at} creates ${f.threes.length===1?'a three':'multiple threes'}, with legal extensions at ${[...new Set(f.threes.flatMap(t=>t.extensions))].map(coord).join(', ')}. A three is pressure, not a proven win.`;
    else why=`${at} is a positional move; no immediate winning threat was established by this tactical check.`;
    const candidate=r.candidates?.find(c=>c.i===played), reply=candidate?.pv?.[0]===played?candidate.pv[1]:null;
    if (point(reply) && severity(q.label)>=2) {
      try {
        const after=apply(board,color,r.rule,played), response=apply(after.board,3-color,r.rule,reply);
        const e=engineFactory(r.rule), rb=Int8Array.from(response.board), ends=e.winningMoves(rb,3-color), counter=e.winningMoves(rb,color);
        if(response.result?.winner===3-color) why+=` Concrete reply: ${them} wins immediately at ${coord(reply)}.`;
        else if(ends.length>=2&&!counter.length) why+=` Concrete reply: ${them} can play ${coord(reply)}, creating winning points at ${ends.map(coord).join(' and ')}. You cannot block both, and have no immediate counter-win.`;
        else if(ends.length===1) why+=` In the searched line, ${them} replies ${coord(reply)} and threatens five at ${coord(ends[0])}.`;
      } catch {} // Never describe an invalid or terminal continuation.
    }
    if (severity(q.label)>=2) why += ` The selective search prefers ${best}. Play out both lines to inspect the difference; this judgment can change with deeper analysis.`;
    if (q.label==='Unscored') why += ' There is not enough comparable search evidence to grade this move yet.';
    const lesson = f.replies.length ? 'Look one move ahead for the opponent’s finish.' : f.threats.length ? 'Deal with the immediate threat before improving your own shape.' : f.finishes.length ? 'A forcing four gains time because the opponent must respond.' : f.threes.length ? 'Compare the legal extensions and the opponent’s strongest defense.' : 'Compare connected shapes and future threats, not just the nearest empty point.';
    return {why,lesson,highlights:f.replies.length?f.replies:f.finishes};
  }
  function pack(r,board,color,played) {
    const q=judge(r,board,color,played);
    const candidates=(r.candidates || []).filter(c=>point(c.i)).map(c=>{
      const j=judge(r,board,color,c.i);
      return {i:c.i,score:Number.isFinite(c.score)?c.score:null,bound:c.bound||'unknown',pv:Array.isArray(c.pv)?c.pv.slice(0,24):[],label:j.label,basis:j.basis,loss:j.loss??null,explanation:explain(r,board,color,c.i,j)};
    });
    const c=candidates.find(x=>x.i===played);
    const best=point(q.best)?q.best:point(r.move)?r.move:null;
    if (best!==null && !candidates.some(x=>x.i===best)) candidates.unshift({i:best,score:null,bound:'unknown',pv:r.tactical?.verified?r.tactical.pv.slice(0,24):[],label:r.tactical?.verified?'Winning plan':'Suggestion',basis:r.tactical?.verified?'verified-proof':'insufficient-search',explanation:{why:r.explanation || 'Search suggestion; not scored against this move.',lesson:'Compare the continuation.',highlights:[]}});
    return {key:key(board,color,r.rule),played,color,rule:r.rule,label:q.label,basis:q.basis,loss:q.loss??null,best,
      depth:r.depth || 0,timeMs:r.elapsedMs || 0,budget:r.parameters?.budget || 0,engine:r.parameters?.engine || '6.0',
      quality:r.analysisQuality || 'selective',score:c?.bound==='exact'?c.score:null,
      explanation:explain(r,board,color,played,q),facts:q.facts,candidates,
      pv:(r.pv || []).slice(0,24),evaluatedAt:Date.now()};
  }
  function line(board,color,rule,moves) {
    const states=[{board:Array.from(board),color,result:null}],valid=[];
    for(const i of moves || []) {
      if(states.at(-1).result) break;
      try {const s=apply(states.at(-1).board,states.at(-1).color,rule,i);states.push(s);valid.push(i);}catch{break;}
    }
    return {states,moves:valid};
  }
  return {coord,point,key,positions,legal,apply,facts,judge,explain,pack,line,severity};
}
if(typeof module !== 'undefined' && module.exports) module.exports={createGuidedReviewCore};

if(typeof window !== 'undefined') (()=>{
  'use strict';
  const VERSION='1.0.0', STORE='gomoku.guided-review.v1', $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=x=>JSON.parse(JSON.stringify(x));
  const side=c=>c===1?'Black':'White';
  const rules={'freestyle':'Freestyle','exact-five':'Exact five','renju-practice':'Renju practice'};
  let core,dialog,session=null,worker=null,workerURL=null,rejectJob=null,watchdog=0,serial=0,opener=null;
  let storageNotice='';
  const abort=()=>{if(worker)worker.terminate();if(workerURL)URL.revokeObjectURL(workerURL);clearTimeout(watchdog);worker=null;workerURL=null;const reject=rejectJob;rejectJob=null;reject?.(new DOMException('Canceled','AbortError'));};
  function evaluate(board,color,rule,played,budget=350) {
    abort();
    return new Promise((resolve,reject)=>{
      try {
        if(typeof Worker!=='function') throw Error('This browser does not support background analysis workers.');
        const id=++serial;
        const source=v5WorkerPrelude()+`;const R=(${createGuidedReviewCore.toString()})(createEngine,createStudioCore);const C=createStudioCore(createEngine);onmessage=({data:d})=>{try{const r=C.analyze(d.board,d.color,d.rule,{timeMs:d.budget,depth:9,width:20,multiPV:5,includeMoves:d.played>=0?[d.played]:[],backend:'auto',seed:17});postMessage({id:d.id,result:R.pack(r,d.board,d.color,d.played)});}catch(e){postMessage({id:d.id,error:e.message});}};`;
        workerURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(workerURL);rejectJob=reject;
        const finish=(error,result)=>{if(id!==serial||!worker)return;rejectJob=null;worker.terminate();worker=null;URL.revokeObjectURL(workerURL);workerURL=null;clearTimeout(watchdog);error?reject(error):resolve(result);};
        worker.onmessage=ev=>{if(ev.data.id===id)finish(ev.data.error?Error(ev.data.error):null,ev.data.result);};
        worker.onerror=ev=>{ev.preventDefault();finish(Error(ev.message||'Analysis worker failed.'));};
        watchdog=setTimeout(()=>finish(Error('Analysis timed out. Completed results are safe; retry this move.')),Math.max(8000,budget+5000));
        worker.postMessage({id,board,color,rule,played,budget});
      } catch(error) {abort();reject(error);}
    });
  }
  const fingerprint=g=>JSON.stringify([VERSION,g.variant,g.initial,g.startColor,g.moves]);
  function loadCache(s) {
    try {
      const raw=localStorage.getItem(STORE);if(!raw || raw.length>2800000)return;
      const data=JSON.parse(raw);if(data.version!==VERSION||!Array.isArray(data.items))return;
      const saved=data.items.find(x=>x.fingerprint===s.fingerprint);
      if(!saved||!Array.isArray(saved.results))return;
      for(let k=0;k<s.positions.length;k++){
        const r=saved.results[k],p=s.positions[k];
        if(r?.key===p.key&&r.played===p.played&&Array.isArray(r.candidates)&&r.explanation&&typeof r.explanation.why==='string'&&typeof r.label==='string'&&r.candidates.length<=25&&r.candidates.every(c=>core.point(c.i)&&typeof c.label==='string')&&r.facts&&Array.isArray(r.explanation.highlights))s.results[k]=r;
      }
      s.index=Math.max(0,Math.min(s.positions.length-1,Number(saved.index)||0));
    }catch{storageNotice='Review stays in this tab. Browser storage is unavailable; use Export review before closing.';}
  }
  function persist(s=session) {
    if(!s)return;
    try {
      let old;try{old=JSON.parse(localStorage.getItem(STORE)||'null');}catch{}
      const item={fingerprint:s.fingerprint,results:s.results,index:s.index,at:Date.now()};
      const items=[item,...(Array.isArray(old?.items)?old.items:[]).filter(x=>x.fingerprint!==s.fingerprint)].slice(0,8);
      while(JSON.stringify(items).length>2500000&&items.length>1)items.pop();
      if(JSON.stringify(items).length>2500000)throw Error('Review cache is full.');
      localStorage.setItem(STORE,JSON.stringify({version:VERSION,items}));
    }catch{storageNotice='Review stays in this tab. Browser storage is unavailable or full; export to keep it.';}
  }
  function ensureUI() {
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='grDialog';dialog.setAttribute('aria-labelledby','grTitle');
    dialog.innerHTML=`<div class="gr-shell"><header class="gr-header"><div><p class="gr-kicker">GOMOKU STUDIO / LEARN FROM YOUR GAME</p><h2 id="grTitle">Game review</h2><p id="grGameMeta"></p></div><button type="button" class="gr-btn gr-close" id="grClose" aria-label="Close game review">Close <span aria-hidden="true">×</span></button></header>
    <div class="gr-progress-section"><div class="gr-progress-copy"><span id="grProgress" role="status"></span><button type="button" class="gr-link" id="grPause">Pause scan</button></div><progress id="grProgressBar" max="1" value="0" aria-label="Game analysis progress"></progress><div id="grSummary" class="gr-summary"></div></div>
    <div class="gr-content"><section class="gr-board-column" aria-label="Review board"><div class="gr-board-heading"><div><span class="gr-kicker" id="grModeLabel">RECORDED GAME</span><h3 id="grBoardTitle"></h3><p id="grQuickVerdict" class="gr-quick-verdict"></p></div><button type="button" class="gr-btn gr-return" id="grReturn" hidden>Return to game</button></div>
    <div class="gr-view-switch" role="group" aria-label="Compare the decision"><button type="button" id="grBefore">Before move</button><button type="button" id="grPlayed">Played move</button><button type="button" id="grBest">Best found</button></div>
    <div class="gr-board-wrap"><div class="gr-top-coords" aria-hidden="true">${[...'ABCDEFGHJKLMNOP'].map(x=>`<span>${x}</span>`).join('')}</div><div class="gr-side-coords" aria-hidden="true">${Array.from({length:15},(_,i)=>`<span>${15-i}</span>`).join('')}</div><div class="gr-board" id="grBoard" role="grid" aria-label="Gomoku analysis board" aria-rowcount="15" aria-colcount="15" aria-describedby="grBoardHelp"></div></div>
    <p class="gr-board-help" id="grBoardHelp"></p><p class="gr-board-feedback" id="grBoardFeedback" hidden></p><div id="grBranchTools" class="gr-branch-tools" hidden><div id="grBranchMoves" class="gr-branch-moves"></div><div class="gr-action-row"><button type="button" class="gr-btn" id="grUndo">Undo test move</button><button type="button" class="gr-btn" id="grLineNext">Next engine move</button><button type="button" class="gr-btn" id="grReply">Find / play best reply</button></div><label class="gr-saved-label">Saved variations <select id="grVariations" aria-label="Saved variations for this decision"></select></label></div>
    <nav class="gr-navigation" aria-label="Move navigation"><button type="button" class="gr-btn" id="grPrev" aria-label="Previous game move">← Previous</button><span id="grCounter"></span><button type="button" class="gr-btn" id="grNext" aria-label="Next game move">Next →</button></nav>
    <section class="gr-balance"><div class="gr-section-head"><h4>How the game changed</h4><span>Black ↑ · White ↓</span></div><div id="grGraph"></div><p>Engine balance after each played move. Gaps are unscored; this is not a win probability.</p></section></section>
    <section class="gr-inspector" aria-label="Move assessment"><div class="gr-section-head"><h3 id="grDecisionTitle"></h3><button type="button" class="gr-link" id="grKey">Next key moment →</button></div><div class="gr-verdict" id="grVerdict"></div><p class="gr-basis" id="grBasis"></p><div class="gr-coach"><h4 id="grWhyTitle">What happened</h4><p id="grWhy"></p><div class="gr-lesson"><span>TAKEAWAY</span><p id="grLesson"></p></div></div><div class="gr-action-row"><button type="button" class="gr-btn gr-primary" id="grRetry">Try again</button><button type="button" class="gr-btn" id="grExplore">Explore from here</button><button type="button" class="gr-btn" id="grDeeper">Analyze deeper</button></div><div class="gr-feedback" id="grFeedback" role="status" hidden></div>
    <section class="gr-alternatives"><div class="gr-section-head"><h4>Compare your options</h4><span id="grAltHint">Select a move to test it</span></div><div id="grCandidates"></div></section>
    <details class="gr-details"><summary>How to read the analysis</summary><p>Best found means the strongest comparable move in this search, not a proof of perfect play. Good alternatives are accepted. Unscored means insufficient evidence, not a bad move.</p><p>Rule-checked labels describe immediate wins, threats or unavoidable losses. Provisional labels come from selective search and may change. No invented accuracy percentage, Elo rating or win probability is used.</p><div id="grEngineDetails"></div></details>
    <section class="gr-record"><div class="gr-section-head"><h4>Move-by-move review</h4><select id="grFilter" aria-label="Filter reviewed moves"><option value="all">All moves</option><option value="mine">Your moves</option><option value="mistakes">Key moments</option></select></div><div id="grMoveList" class="gr-move-list"></div></section></section></div>
    <div class="gr-footer"><span id="grFooterNote">Your recorded game is never changed by review.</span><button type="button" class="gr-link" id="grExport">Export review</button></div></div>`;
    document.body.append(dialog);
    const board=$('grBoard');
    for(let row=0;row<15;row++){
      const line=document.createElement('div');line.setAttribute('role','row');line.className='gr-board-row';
      for(let col=0;col<15;col++){
        const i=row*15+col,cell=document.createElement('button');cell.type='button';cell.dataset.point=String(i);cell.className='gr-cell';cell.setAttribute('role','gridcell');cell.setAttribute('aria-rowindex',String(row+1));cell.setAttribute('aria-colindex',String(col+1));cell.tabIndex=i===112?0:-1;cell.innerHTML='<span class="gr-stone"></span><span class="gr-point-mark"></span>';line.append(cell);
      }board.append(line);
    }
    $('grClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    $('grPause').onclick=()=>{const s=session;if(!s)return;if(s.scanning||s.interacting){s.wantsScan=false;s.epoch++;s.scanning=false;s.interacting=false;abort();feedback('Analysis paused. Completed decisions are kept.');render();}else{s.wantsScan=true;scan();}};
    $('grPrev').onclick=()=>select(session.index-1);$('grNext').onclick=()=>select(session.index+1);$('grKey').onclick=nextKey;
    $('grBefore').onclick=()=>setView('before');$('grPlayed').onclick=()=>setView('played');$('grBest').onclick=showBest;
    $('grReturn').onclick=()=>setView('played');$('grRetry').onclick=retry;$('grExplore').onclick=()=>startBranch(null);
    $('grDeeper').onclick=()=>deeper();$('grUndo').onclick=undoBranch;$('grLineNext').onclick=nextLine;$('grReply').onclick=bestReply;
    $('grFilter').onchange=()=>{session.filter=$('grFilter').value;renderMoves();};
    $('grVariations').onchange=()=>{const s=session,branch=(s.variations[s.index]||[]).find(x=>x.id===$('grVariations').value);if(branch){s.branch=branch;s.mode='explore';s.attempt=null;render();}};
    $('grExport').onclick=exportReview;
    dialog.addEventListener('click',ev=>{
      const cell=ev.target.closest('[data-point]');if(cell){boardAction(Number(cell.dataset.point));return;}
      const move=ev.target.closest('[data-review-ply]');if(move){select(Number(move.dataset.reviewPly));return;}
      const alt=ev.target.closest('[data-alternative]');if(alt)startBranch(Number(alt.dataset.alternative));
    });
    dialog.addEventListener('keydown',ev=>{
      if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
      const cell=ev.target.closest('[data-point]');
      if(cell){let i=Number(cell.dataset.point),j=i;if(ev.key==='ArrowLeft')j=i%15?i-1:i;else if(ev.key==='ArrowRight')j=i%15<14?i+1:i;else if(ev.key==='ArrowUp')j=Math.max(0,i-15);else if(ev.key==='ArrowDown')j=Math.min(224,i+15);else if(ev.key==='Home')j=i-i%15;else if(ev.key==='End')j=i-i%15+14;else return;ev.preventDefault();cell.tabIndex=-1;const next=board.querySelector(`[data-point="${j}"]`);next.tabIndex=0;next.focus();return;}
      if(ev.target.closest('input,select,textarea,summary'))return;
      if(ev.key==='ArrowLeft'){ev.preventDefault();select(session.index-1);}if(ev.key==='ArrowRight'){ev.preventDefault();select(session.index+1);}
    });
  }
  function entry(){return session?.positions[session.index];}
  function result(){return session?.results[session.index];}
  function feedback(message){if(!$('grFeedback'))return;$('grFeedback').hidden=!message;$('grFeedback').textContent=message||'';const inline=$('grBoardFeedback');inline.hidden=!message;inline.textContent=message||'';if(message&&session?.mode!=='game'&&innerWidth<=720)requestAnimationFrame(()=>inline.scrollIntoView({block:'nearest'}));}
  function revealBoard(){requestAnimationFrame(()=>{if(!dialog?.open)return;dialog.querySelector('.gr-board-column').scrollTop=0;dialog.querySelector('.gr-inspector').scrollTop=0;if(innerWidth<=720)dialog.querySelector('.gr-content').scrollTop=0;});}
  function chosenState() {
    const s=session,p=entry();
    if(s.mode==='explore'&&s.branch)return core.line(p.board,p.color,s.game.variant,s.branch.moves).states.at(-1);
    if(s.mode==='retry')return s.attempt?core.line(p.board,p.color,s.game.variant,[s.attempt.i]).states.at(-1):{board:p.board,color:p.color,result:null};
    if(s.view==='before'||p.played<0)return {board:p.board,color:p.color,result:null};
    return core.line(p.board,p.color,s.game.variant,[p.played]).states.at(-1);
  }
  function tone(label){return ['Winning move','Winning threat','Winning plan','Best found'].includes(label)?'best':label==='Good'?'good':core.severity(label)>=3?'bad':core.severity(label)?'warn':'neutral';}
  function basisText(r){if(!r)return 'Analysis is queued. You can navigate and explore while it runs.';return r.basis==='rules'?'Rule-checked tactical fact':r.basis==='verified-proof'?'Verified forcing strategy':r.basis==='insufficient-search'?'Insufficient evidence · analyze deeper':`Provisional engine judgment · depth ${r.depth}`;}
  function render() {
    if(!session||!dialog.open)return;
    const s=session,p=entry(),r=result(),state=chosenState(),active=s.mode!=='game';
    $('grGameMeta').textContent=`${s.game.title||'You vs computer'} · ${rules[s.game.variant]||s.game.variant} · ${s.positions.length} moves${s.game.mode==='ai'?' · You played '+side(s.game.humanColor):''}`;
    $('grModeLabel').textContent=s.mode==='retry'?'TRY AGAIN · ORIGINAL GAME SAFE':s.mode==='explore'?'TEST VARIATION · ORIGINAL GAME SAFE':'RECORDED GAME';
    $('grBoardTitle').textContent=s.mode==='explore'?`Variation after move ${p.ply-1} · ${state.result?(state.result.winner?side(state.result.winner)+' wins':'Draw'):side(state.color)+' to play'}`:s.mode==='retry'?`Find a better move for ${side(p.color)}`:`${s.view==='before'?'Before':'After'} move ${p.ply} · ${core.coord(p.played)}`;
    $('grReturn').hidden=!active;$('grBranchTools').hidden=s.mode!=='explore';
    for(const id of ['grBefore','grPlayed','grBest'])$(id).setAttribute('aria-pressed',String(!active&&((id==='grBefore'&&s.view==='before')||(id==='grPlayed'&&s.view==='played'))));
    $('grBest').disabled=!r||r.best===null;$('grBest').textContent=r?.best===p.played?'Show best (your move)':'Show best found';
    $('grBoardHelp').textContent=s.mode==='retry'?'Choose an empty point. Your move will be checked; good alternatives count too.':s.mode==='explore'?'Place either side’s next stone, step through the engine line, or request its best reply. Return to game is always safe.':`Numbered stone = played move. ${r&&r.best!==null&&r.best!==p.played?'★ marks the best found alternative. ':''}Select an empty point to test a different move.`;
    const marks=s.mode==='retry'?[]:(s.attempt?.result||r)?.explanation?.highlights||[];
    let last=p.played;if(s.view==='before'&&s.mode==='game')last=-1;if(s.mode==='retry')last=s.attempt?.i??-1;if(s.mode==='explore')last=s.branch.moves.at(-1)??-1;
    for(const cell of $('grBoard').querySelectorAll('[data-point]')){
      const i=Number(cell.dataset.point),stone=state.board[i],hint=!active&&r?.best===i&&r.best!==p.played&&!stone;
      const mark=cell.querySelector('.gr-point-mark');cell.dataset.stone=String(stone);cell.classList.toggle('gr-last',i===last&&!!stone);cell.classList.toggle('gr-threat',marks.includes(i)&&!stone);cell.classList.toggle('gr-suggested',hint);
      cell.querySelector('.gr-stone').textContent=i===last&&stone?(s.mode==='game'?String(p.ply):'•'):'';
      mark.textContent=hint?'★':marks.includes(i)&&!stone?'!':'';
      cell.setAttribute('aria-label',`${core.coord(i)}, ${stone?side(stone)+' stone':'empty'}${hint?', best found alternative':''}${marks.includes(i)?', tactical point':''}`);cell.setAttribute('aria-disabled',String(!!stone||!!state.result));
    }
    $('grCounter').textContent=`Move ${p.ply} / ${s.positions.length}`;$('grPrev').disabled=s.index===0;$('grNext').disabled=s.index===s.positions.length-1;
    $('grDecisionTitle').textContent=`Move ${p.ply} · ${s.game.mode==='ai'&&s.game.humanColor===p.color?'You / ':''}${side(p.color)} · ${core.coord(p.played)}`;
    const assessed=s.mode==='retry'&&s.attempt?.result?s.attempt.result:r;
    $('grQuickVerdict').textContent=s.mode==='retry'&&!s.attempt?.result?'Find your move':`${assessed?.label||'Analyzing…'}${assessed?.basis==='selective-estimate'?' · provisional':''}`;$('grQuickVerdict').dataset.tone=tone(assessed?.label);
    $('grVerdict').textContent=s.mode==='retry'&&!s.attempt?.result?'Find your move':assessed?.label||'Analyzing…';$('grVerdict').dataset.tone=tone(assessed?.label);
    $('grBasis').textContent=s.mode==='retry'&&!s.attempt?.result?'The answer and alternatives are hidden until you try.':basisText(assessed);
    $('grWhyTitle').textContent=s.mode==='retry'?'Your retry':s.mode==='explore'?'The original decision':'What happened';
    $('grWhy').textContent=s.mode==='retry'&&!s.attempt?.result?'Study the board before the recorded move. Where can either player win, and what must be defended?':assessed?.explanation?.why||'Checking the played move and alternatives from the same position. A move is not bad just because its analysis is unfinished.';
    $('grLesson').textContent=s.mode==='retry'&&!s.attempt?.result?'Look for your immediate win, then the opponent’s immediate win, then forcing threats.':assessed?.explanation?.lesson||'You can start with the first key moment as soon as one is found.';
    $('grDeeper').disabled=!!s.interacting;$('grDeeper').textContent=s.interacting?'Analyzing…':'Analyze deeper';
    $('grRetry').textContent=s.mode==='retry'?'Reset retry':'Try again';
    $('grKey').disabled=!keyIndices().length;
    $('grCandidates').innerHTML=s.mode==='retry'&&!s.attempt?.result?'<p class="gr-muted">Alternatives hidden during your attempt. Place a stone to reveal feedback, or use Show best found.</p>':r?renderCandidates(r,p):'<p class="gr-muted">Checking alternatives… Unsearched moves will not be assigned a made-up rating.</p>';
    $('grEngineDetails').textContent=r?`Search: ${r.engine} · ${r.timeMs} ms · depth ${r.depth} · ${r.quality}. Score loss: ${r.loss===null?'not comparable':Math.round(r.loss)+' engine units'}. Both move scores are from the same player-to-move perspective.`:'';
    if(s.mode==='explore')renderBranch();
    renderProgress();renderMoves();renderGraph();
    $('grFooterNote').textContent=storageNotice||'Your recorded game is never changed. Arrow keys navigate moves; Escape closes review.';
  }
  function renderCandidates(r,p){
    const all=r.candidates.slice().sort((a,b)=>(b.i===r.best)-(a.i===r.best)||(b.score??-Infinity)-(a.score??-Infinity));
    let rows=all.slice(0,5);const played=all.find(x=>x.i===p.played);if(played&&!rows.includes(played))rows.push(played);
    if(!rows.length)return '<p class="gr-muted">No comparable alternatives yet. Use Analyze deeper.</p>';
    return rows.map(c=>`<button type="button" class="gr-candidate" data-alternative="${c.i}" aria-label="Test ${core.coord(c.i)}, ${esc(c.label)}"><span class="gr-candidate-coord">${core.coord(c.i)}</span><span><b>${esc(c.label)}</b><small>${c.i===p.played?'Your recorded move':c.i===r.best?'Best found alternative':'Alternative'}${c.basis==='selective-estimate'?' · provisional':''}</small></span><span aria-hidden="true">↗</span></button>`).join('')+(played?'':`<p class="gr-muted">Played ${core.coord(p.played)}: ${esc(r.label)}. ${r.label==='Unscored'?'It was not comparably scored by this search.':''}</p>`);
  }
  function keyIndices(){const s=session;return s.results.map((r,k)=>r&&core.severity(r.label)>0&&(s.game.mode!=='ai'||s.positions[k].color===s.game.humanColor)?k:-1).filter(k=>k>=0);}
  function renderProgress(){
    const s=session,done=s.results.filter(Boolean).length,scored=s.results.filter(r=>r&&r.label!=='Unscored').length,keys=keyIndices();
    $('grProgress').textContent=s.interacting?'Analyzing your selected position…':`${s.scanning?'Reviewing':done===s.positions.length?'Review complete':'Review paused'} · ${done} / ${s.positions.length} decisions checked`;
    $('grProgressBar').max=s.positions.length;$('grProgressBar').value=done;$('grPause').textContent=s.scanning||s.interacting?'Pause scan':done===s.positions.length?'Scan complete':'Resume scan';$('grPause').disabled=done===s.positions.length&&!s.interacting;
    const unresolved=done-scored;
    $('grSummary').innerHTML=`<span><b>${keys.length}</b> ${s.game.mode==='ai'?'your ':''}key moments</span><span><b>${scored}</b> assessed</span><span><b>${unresolved}</b> need deeper analysis</span><span>${done<s.positions.length?'More results are still coming in.':keys.length?'Start with a key moment, then test the alternative.':unresolved?'No mistakes established; unresolved moves remain.':'No key errors found in this search—not proof of perfect play.'}</span>`;
  }
  function renderMoves(){
    const focused=document.activeElement?.dataset.reviewPly,scroll=$('grMoveList').scrollTop;
    const s=session,rows=s.positions.map((p,k)=>({p,k,r:s.results[k]})).filter(({p,r})=>s.filter==='mine'?p.color===s.game.humanColor:s.filter==='mistakes'?r&&core.severity(r.label)>0&&(s.game.mode!=='ai'||p.color===s.game.humanColor):true);
    $('grMoveList').innerHTML=rows.length?rows.map(({p,k,r})=>`<button type="button" class="gr-record-move${k===s.index?' gr-current':''}" data-review-ply="${k}" aria-current="${k===s.index?'step':'false'}"><span class="gr-move-number">${p.ply}</span><span class="gr-tiny-stone gr-${p.color===1?'black':'white'}" aria-label="${side(p.color)}"></span><b>${core.coord(p.played)}</b><span class="gr-record-label" data-tone="${tone(r?.label)}">${esc(r?.label||'Queued')}</span></button>`).join(''):'<p class="gr-muted">No matching moves yet. Change the filter or let the scan finish.</p>';
    $('grMoveList').scrollTop=scroll;if(focused!==undefined)$('grMoveList').querySelector(`[data-review-ply="${focused}"]`)?.focus({preventScroll:true});
  }
  function renderGraph(){
    const s=session,n=s.positions.length,w=550,h=92;let paths=[],segment=[];
    const pts=s.results.map((r,k)=>{
      if(!r||!Number.isFinite(r.score)){if(segment.length)paths.push(segment.join(' '));segment=[];return null;}
      const value=Math.sign(r.score)*Math.log10(1+Math.abs(r.score))*(s.positions[k].color===1?1:-1);
      const p={x:10+(n===1?.5:k/(n-1))*(w-20),y:46-Math.max(-1,Math.min(1,value/8))*34,k};segment.push(`${segment.length?'L':'M'}${p.x},${p.y}`);return p;
    });if(segment.length)paths.push(segment.join(' '));
    $('grGraph').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Engine evaluation by move; use the move list below to navigate"><path d="M0 46H550" class="gr-zero"/>${paths.map(d=>`<path d="${d}" class="gr-eval-line"/>`).join('')}${pts.filter(Boolean).map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${p.k===s.index?5:3}" class="gr-eval-dot" data-review-ply="${p.k}"><title>Move ${p.k+1}: ${esc(s.results[p.k].label)}</title></circle>`).join('')}</svg>`;
  }
  function renderBranch(){
    const s=session,b=s.branch,state=chosenState();
    $('grBranchMoves').textContent=b.moves.length?b.moves.map((i,k)=>`${k+1}. ${core.coord(i)}`).join('  ·  '):'Starting position — choose a move on the board.';
    $('grUndo').disabled=!b.moves.length;$('grLineNext').disabled=!!state.result||!core.point(b.pv?.[b.moves.length]);
    $('grReply').disabled=!!state.result||s.interacting;
    $('grVariations').innerHTML=(s.variations[s.index]||[]).map((v,k)=>`<option value="${v.id}"${v===b?' selected':''}>${k+1}. ${v.moves.length?core.coord(v.moves[0]):'Empty line'} · ${v.moves.length} test moves</option>`).join('');
  }
  function select(index){const s=session;if(!s)return;s.index=Math.max(0,Math.min(s.positions.length-1,index));s.mode='game';s.view='played';s.branch=null;s.attempt=null;s.touched=true;feedback('');persist();render();revealBoard();}
  function setView(view){const s=session;if(!s)return;s.mode='game';s.view=view;s.branch=null;s.attempt=null;s.touched=true;feedback('');render();revealBoard();}
  function nextKey(){const keys=keyIndices();if(!keys.length)return;select(keys.find(k=>k>session.index)??keys[0]);}
  function retry(){const s=session;s.mode='retry';s.attempt=null;s.branch=null;s.touched=true;feedback('');render();revealBoard();}
  function showBest(){const r=result();if(r?.best!==null&&r?.best!==undefined)startBranch(r.best);}
  function startBranch(i){
    const s=session,p=entry(),r=result();s.mode='explore';s.touched=true;s.attempt=null;
    const branches=s.variations[s.index]||(s.variations[s.index]=[]),candidate=r?.candidates.find(c=>c.i===i);
    let b=branches.find(x=>x.moves.length===1&&x.moves[0]===i);
    if(!b){let pv=candidate?.pv?.slice()||[];if(i!==null&&pv[0]!==i)pv=[i,...pv];b={id:String(++s.branchSerial),moves:i===null?[]:[i],pv:core.line(p.board,p.color,s.game.variant,pv).moves};branches.push(b);if(branches.length>12)branches.shift();}
    s.branch=b;feedback(i===null?'Choose a move to start a new variation.':`${core.coord(i)} · ${candidate?.label||'Suggestion'}. ${candidate?.explanation?.why||'Explore the opponent’s reply to compare this move.'}`);render();revealBoard();
  }
  async function interactive(task){
    const s=session,keep=s.wantsScan;s.epoch++;s.scanning=false;s.interacting=true;abort();const epoch=s.epoch;render();
    try{await task(s,()=>session===s&&s.epoch===epoch);}catch(e){if(e.name!=='AbortError'&&session===s&&s.epoch===epoch){feedback('Analysis unavailable: '+e.message+' Try Analyze deeper again.');s.wantsScan=false;}}
    finally{if(session===s&&s.epoch===epoch){s.interacting=false;render();if(keep&&s.wantsScan)scan();}}
  }
  async function boardAction(i){
    const s=session;if(!s)return;const state=s.mode==='game'?{board:entry().board,color:entry().color,result:null}:chosenState();if(state.board[i]){feedback(`${core.coord(i)} is occupied. Choose an empty intersection.`);return;}if(state.result){feedback('This test line has ended. Undo a move or return to the game.');return;}
    if(s.mode==='game'){// A click always branches from BEFORE the selected recorded move.
      const a=core.legal(entry().board,entry().color,s.game.variant,i);if(!a.legal){feedback('Illegal move: '+a.reason);return;}startBranch(i);await gradeBranchMove(entry().board,entry().color,i);return;
    }
    if(s.mode==='retry'){
      const p=entry(),a=core.legal(p.board,p.color,s.game.variant,i);if(!a.legal){feedback('Illegal move: '+a.reason);return;}
      s.attempt={i,result:null};feedback(`Checking ${core.coord(i)} against the strongest alternatives…`);render();
      await interactive(async(ss,current)=>{const r=await evaluate(p.board,p.color,ss.game.variant,i,1000);if(!current()||ss.mode!=='retry'||ss.index!==p.ply-1||ss.attempt?.i!==i)return;ss.attempt.result=r;feedback(`${['Winning move','Winning threat','Winning plan','Best found','Good'].includes(r.label)?'Good solution. ':r.label==='Unscored'?'No verdict yet. ':''}${core.coord(i)}: ${r.label}. ${r.explanation.why}`);});return;
    }
    const a=core.legal(state.board,state.color,s.game.variant,i);if(!a.legal){feedback('Illegal move: '+a.reason);return;}
    if(s.branch.moves.length>=60){feedback('Variation limit: 60 test moves. Return to the game or start another line.');return;}
    s.branch.moves.push(i);if(s.branch.pv[s.branch.moves.length-1]!==i)s.branch.pv=[];render();await gradeBranchMove(state.board,state.color,i);
  }
  async function gradeBranchMove(board,color,i){const branch=session.branch,signature=JSON.stringify(branch.moves);await interactive(async(s,current)=>{const r=await evaluate(board,color,s.game.variant,i,700);if(!current()||s.branch!==branch||JSON.stringify(branch.moves)!==signature)return;branch.last=r;feedback(`${side(color)} ${core.coord(i)}: ${r.label}. ${r.explanation.why}`);});}
  function undoBranch(){const s=session;if(!s?.branch?.moves.length)return;s.branch.moves.pop();feedback('Test move undone. The recorded game is unchanged.');render();}
  function nextLine(){const s=session,b=s.branch,i=b?.pv[b.moves.length];if(core.point(i))boardAction(i);}
  async function bestReply(){const state=chosenState(),b=session.branch;if(!b||state.result)return;const signature=JSON.stringify(b.moves);await interactive(async(s,current)=>{const r=await evaluate(state.board,state.color,s.game.variant,-1,1100);if(!current()||s.branch!==b||JSON.stringify(b.moves)!==signature)return;if(!core.point(r.best)){feedback('No legal reply found.');return;}const next=core.apply(state.board,state.color,s.game.variant,r.best);b.moves.push(r.best);b.pv=[];const c=r.candidates.find(x=>x.i===r.best);feedback(`${side(state.color)} replies ${core.coord(r.best)}. ${c?.explanation?.why||'Best found by the current selective search.'}${next.result?' This line has ended.':''}`);});}
  async function deeper(){const p=entry(),index=session.index;await interactive(async(s,current)=>{const r=await evaluate(p.board,p.color,s.game.variant,p.played,2400);if(!current())return;s.results[index]=r;persist(s);feedback('Deeper analysis completed. Provisional labels and alternatives have been updated.');});}
  async function scan(){
    const s=session;if(!s||s.scanning||s.interacting||!s.wantsScan)return;const epoch=++s.epoch;s.scanning=true;renderProgress();
    const order=[s.index,...s.positions.map((p,k)=>k).filter(k=>s.positions[k].color===s.game.humanColor),...s.positions.map((_,k)=>k)].filter((v,k,a)=>a.indexOf(v)===k);
    try{for(const k of order){if(session!==s||s.epoch!==epoch||!s.wantsScan)break;if(s.results[k])continue;const p=s.positions[k];const r=await evaluate(p.board,p.color,s.game.variant,p.played,350);if(session!==s||s.epoch!==epoch)break;s.results[k]=r;persist(s);if(!s.touched&&core.severity(r.label)>=2&&(s.game.mode!=='ai'||p.color===s.game.humanColor)){s.index=k;s.touched=true;}render();}}
    catch(e){if(e.name!=='AbortError'&&session===s&&s.epoch===epoch){s.wantsScan=false;feedback('The scan stopped: '+e.message+' Completed moves are kept. Use Resume scan to retry.');}}
    finally{if(session===s&&s.epoch===epoch){s.scanning=false;render();}}
  }
  function close(){if(!session)return;const s=session;s.wantsScan=false;s.epoch++;persist(s);abort();session=null;dialog.close();window.GomokuStudio.finishGuidedReview?.(!s.wasReviewing);opener?.focus?.();}
  function open(options={}){
    const api=window.GomokuStudio;if(!api)return false;
    if(dialog?.open){if(Number.isInteger(options.ply))select(options.ply-1);return true;}
    try{
      const prepared=api.prepareGuidedReview?api.prepareGuidedReview():{game:api.exportGame(),wasReviewing:true};
      const game=copy(prepared.game);core=core||createGuidedReviewCore(createEngine,createStudioCore);const ps=core.positions(game);
      if(!ps.length){api.finishGuidedReview?.(!prepared.wasReviewing);return false;}
      opener=document.activeElement;document.querySelectorAll('dialog[open]').forEach(d=>d.close());ensureUI();storageNotice='';
      session={game,wasReviewing:prepared.wasReviewing,fingerprint:fingerprint(game),positions:ps,results:Array(ps.length).fill(null),index:0,mode:'game',view:'played',branch:null,branchSerial:0,variations:{},attempt:null,filter:'all',epoch:0,scanning:false,interacting:false,wantsScan:true,touched:false};
      loadCache(session);if(Number.isInteger(options.ply)){session.index=Math.max(0,Math.min(ps.length-1,options.ply-1));session.touched=true;}
      $('grFilter').value='all';dialog.showModal();feedback('');render();$('grClose').focus();scan();return true;
    }catch(e){console.error('Guided review:',e);const note=document.createElement('p');note.setAttribute('role','alert');note.textContent='Review could not open: '+e.message;note.style.cssText='position:fixed;bottom:20px;left:20px;z-index:99999;max-width:90vw;padding:15px;background:#fff;color:#222;border:2px solid #9e473a';document.body.append(note);setTimeout(()=>note.remove(),10000);return false;}
  }
  function exportReview(){const s=session;if(!s)return;const data={format:'GomokuGuidedReview',version:VERSION,createdAt:new Date().toISOString(),game:s.game,results:s.results,variations:s.variations};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='gomoku-game-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function boot(){
    if(!window.GomokuStudio){setTimeout(boot,80);return;}
    core=createGuidedReviewCore(createEngine,createStudioCore);
    const ids=new Set(['resultReviewBtn','resultCoachBtn','resultAnalyzeBtn','reviewAllBtn','reviewCoachOpen','reviewGameFromTrain','reviewCoachBtn','v95Full']);
    // Capture before legacy handlers; a single entry point, not another review overlay.
    document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;let match=ids.has(b.id);if(b.id==='reviewBtn'||b.id==='v85NextBtn'){try{const g=GomokuStudio.exportGame();match=!!g.terminal||!!createEngine(g.variant).replay(g.moves,{initial:g.initial,startColor:g.startColor}).result;}catch{}}if(!match)return;if(open()){ev.preventDefault();ev.stopImmediatePropagation();}},true);
    const button=$('resultReviewBtn');if(button)button.textContent='Review game';
    window.GomokuReview=Object.freeze({version:VERSION,open,close,select:ply=>select(ply-1),deeper,showBest,retry,nextKey,
      state:()=>session?copy({gameId:session.game.gameId,index:session.index,mode:session.mode,view:session.view,scanning:session.scanning,interacting:session.interacting,results:session.results,branch:session.branch,attempt:session.attempt,positions:session.positions}):null,
      core,exportReview});
  }
  boot();
})();
