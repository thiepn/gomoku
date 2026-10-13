/* Gomoku Bot Elo E8 — native-rule-based replay and independent tactical practice.
 * Read-only training derived from E2/E6 owner-verified transcripts and the
 * original Studio createEngine('renju-practice'). No parallel game engine,
 * rating writer, mastery grade, generated solution key, or stored profile.
 */
(function(){
'use strict';
if(window.GomokuBotReviewE8)return;
const $=id=>document.getElementById(id),E=window.GomokuBotEloE1;
const source=()=>window.GomokuBotWorkspaceE5?.e7SourceSnapshot?.();
const account=()=>window.GomokuCompetitionBridge?.account?.();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS='ABCDEFGHJKLMNOP';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=i=>i===-1?'Pass':COLS[i%15]+(15-Math.floor(i/15));
const status={owner:null,matchId:null,ply:0,selected:null,hints:0,reveal:false,
 mode:'guided',feedback:'',nativeDetail:false,focus:112,open:false};
let engine=null,lastError='';
const styles=[
'.b8{margin-top:12px;padding:11px 0 0;border-top:1px solid var(--hair,#999);font-size:12px;line-height:1.5;color:var(--ink,#222)}',
'.b8[hidden]{display:none!important}.b8 h3{font-size:15px;margin:0}.b8 h4{font-size:12px;margin:9px 0 4px}',
'.b8-muted{font-size:11px;color:var(--ink2,#57636e);margin:5px 0;line-height:1.5}',
'.b8-header{display:flex;gap:10px;align-items:start;justify-content:space-between;flex-wrap:wrap}',
'.b8-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:9px 0}',
'.b8 button,.b8 select{min-height:39px}.b8 button[disabled]{opacity:.45;cursor:default}',
'.b8-grid{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));width:100%;max-width:535px;min-width:360px;aspect-ratio:1;margin:0 auto;background:var(--card2,#dcd0ae);padding:3px;border:1px solid var(--hair,#777);box-sizing:border-box}',
'.b8-scroller{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain}',
'.b8-cell{padding:0;min-width:0!important;min-height:0!important;aspect-ratio:1;display:grid;place-items:center;background:transparent;border:1px solid color-mix(in srgb,var(--ink,#333) 19%,transparent);border-radius:0;position:relative}',
'.b8-cell[data-last="true"]{outline:2px solid var(--seal,#315c58);outline-offset:-3px}',
'.b8-cell[data-selected="true"]{box-shadow:inset 0 0 0 3px #a16b35}',
'.b8-cell:focus-visible{outline:3px solid var(--seal,#315c58);outline-offset:-3px;z-index:2}',
'.b8-stone{width:77%;height:77%;border-radius:50%;display:block;box-shadow:0 1px 2px #0007}',
'.b8-stone[data-color="1"]{background:#25282d;border:1px solid #050506}',
'.b8-stone[data-color="2"]{background:#f8f8f2;border:1px solid #737780}',
'.b8-cell[data-hint="true"]::after{content:"";position:absolute;inset:26%;border:2px dashed #2b7b72;border-radius:50%;pointer-events:none}',
'.b8-panel{border:1px solid var(--hair,#999);padding:9px;margin:11px 0}',
'.b8-panel strong{font-size:12px}.b8-panel button{margin:3px 5px 3px 0}',
'.b8-feedback{padding:8px;border-left:3px solid var(--seal,#315c58);background:var(--card2,#eee)}',
'.b8-ply{width:min(100%,330px);accent-color:var(--seal,#315c58)}',
'.b8-cards{display:flex;flex-wrap:wrap;gap:6px}.b8-card{padding:7px;border:1px solid var(--hair,#aaa);background:var(--card2,#eee);font-size:11px}',
'.b8-history{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:6px}',
'.b8-history button{text-align:left;font-size:11px;min-height:45px;padding:6px}',
'.b8-labeled{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
'@media(max-width:480px){.b8{padding-top:9px}.b8-toolbar button{flex:1}.b8-panel{padding:8px}}',
'@media(prefers-reduced-motion:reduce){.b8 *{scroll-behavior:auto!important}}'
].join('');
function owner(){
 const a=account();
 return a?.connected===true&&typeof a.userId==='string'&&UUID.test(a.userId)?a.userId:null;
}
function clear(){
 status.matchId=null;status.selected=null;status.ply=0;status.hints=0;status.reveal=false;
 status.feedback='';status.nativeDetail=false;status.open=false;lastError='';
 const box=$('b8-review');if(box)box.hidden=true;
}
function syncOwner(){
 const who=owner();
 if(who!==status.owner){clear();status.owner=who;}
 return who;
}
function currentMatch(){
 const who=syncOwner(),s=source();
 if(!who||s?.ownerVerified!==true||s.ownerKey!==who||!Array.isArray(s.matches))return null;
 const m=s.matches.find(m=>m?.id===status.matchId);
 if(!m||!UUID.test(String(m.id||''))||m.ownerVerified!==true||
    m.integrity?.serverAuthoritative!==true||m.integrity?.verifiedRules!==true||
    !E?.getBot(m.botId)||m.rule!=='renju-practice'||
    !['completed','resigned'].includes(m.status)||!Array.isArray(m.moves)||!m.result||
    ![1,2].includes(m.playerColor))return null;
 return m;
}
function native(){
 if(engine)return engine;
 if(typeof window.createEngine!=='function')return null;
 // Same original script#rules-engine used by Studio, not a bundled clone.
 const candidate=window.createEngine('renju-practice');
 if(!candidate||typeof candidate.replay!=='function'||
    typeof candidate.legalMove!=='function'||typeof candidate.tacticalProfile!=='function')
   return null;
 engine=candidate;return engine;
}
function verifiedReplay(m){
 const k=native();if(!k)return null;
 if(m.moves.length>227)return null;
 let full;
 try {full=k.replay(m.moves);}catch(_){return null;}
 const returned=full.result||null;
 if(m.status==='completed'){
   if(!returned||returned.winner!==m.result.winner||returned.reason!==m.result.reason)return null;
 }else if(returned||m.result.reason!=='resign'||m.result.winner!==3-m.playerColor)return null;
 for(let i=0;i<m.moves.length;i++){
   const move=m.moves[i],expected=(i%2)+1;
   if(move.color!==expected||move.actor!==(expected===m.playerColor?'player':'bot'))return null;
 }
 return full;
}
function frame(m,k){
 if(!Number.isInteger(status.ply)||status.ply<0||status.ply>m.moves.length)return null;
 try {return k.replay(m.moves.slice(0,status.ply));}catch(_){return null;}
}
function turn(ply){return ply%2+1;}
function candidateReport(k,board,i,color,ply){
 if(!Number.isInteger(i)||i<0||i>=225)return null;
 return k.legalMove(board,i,color,ply);
}
function immediate(k,board,color,ply){
 // Native winningMoves is a geometric candidate list; filter with its
 // own exact Renju legalMove so a forbidden Black point is not taught as a win.
 return k.winningMoves(board,color).filter(i=>{
   const r=candidateReport(k,board,i,color,ply);
   return r?.legal===true&&r.win===true;
 });
}
function tactical(k,board,ply){
 const side=turn(ply),winning=immediate(k,board,side,ply),
   danger=immediate(k,board,3-side,ply);
 const direct=danger.filter(i=>candidateReport(k,board,i,side,ply)?.legal===true);
 let kind='record',answer=[];
 if(ply===0){kind='opening';answer=[112];}
 else if(winning.length){kind='win';answer=winning;}
 else if(danger.length===1&&direct.length===1){kind='block';answer=direct;}
 return {kind,answer,winning,danger,side};
}
function question(t,m,ply){
 const toAct=t.side===m.playerColor?'You':'Bot';
 if(ply===m.moves.length)return 'The final recorded position. Move back to review an earlier decision.';
 if(t.kind==='opening')return 'Opening rule: which intersection must Black occupy on move one?';
 if(t.kind==='win')return toAct+' to play: find an immediate legal five under the original Renju rules.';
 if(t.kind==='block')return toAct+' to play: occupy the opponent’s single immediately winning point, if possible.';
 return toAct+' to play: choose a plausible continuation, then compare it with the actual recorded move. Alternatives are not graded as mistakes.';
}
function hint(t,m){
 if(status.hints===0)return '';
 if(status.hints===1){
   if(t.kind==='opening')return 'The original rules require Black to open at the center intersection.';
   if(t.kind==='win')return 'The native rules kernel identifies at least one legal move that completes five immediately.';
   if(t.kind==='block')return 'The opponent currently has one legal immediate-five point. Occupying it is a direct block.';
   return 'Inspect the existing stones, the last recorded move, and whether Black has Renju restrictions. No unique best answer is asserted.';
 }
 if(t.answer.length)return 'Native rule-defined target coordinates: '+t.answer.map(coord).join(', ')+'.';
 return 'This exercise has no certified tactical solution. Use Reveal record to inspect the actual continuation without calling other legal moves wrong.';
}
function feedback(k,board,t,m){
 const i=status.selected;
 if(i===null)return 'Choose an intersection on the replay board, then inspect it.';
 const side=t.side,r=candidateReport(k,board,i,side,status.ply);
 if(!r)return 'No valid board square was chosen.';
 if(!r.legal){
   const reasons={'overline':'Black overline','double-three':'Black double-three','double-four':'Black double-four',
     'opening-center':'Black must open at center','occupied':'already occupied'};
   return coord(i)+' is illegal here under the original engine: '+(reasons[r.reason]||r.reason)+
    '. An illegal move is not a valid candidate.';
 }
 if(t.kind==='opening')return i===112?
   coord(i)+' follows the required center-first rule.':
   coord(i)+' is not the required first move (center is H8).';
 if(t.kind==='win')return t.answer.includes(i)?
   coord(i)+' is an immediate legal win, confirmed by the native Renju kernel.':
   coord(i)+' is legal but does not complete an immediate five. This does not establish whether it is strategically poor.';
 if(t.kind==='block')return i===t.answer[0]?
   coord(i)+' directly occupies the identified immediate-five point. Other future threats are not ruled out.':
   coord(i)+' is legal but does not occupy the identified immediate winning point at '+coord(t.answer[0])+
   '. No claim is made about deeper counterplay.';
 const record=m.moves[status.ply];
 return coord(i)+' is legal'+(r.win?' and immediately wins':'')+'. '+
   (record?.i===i?'It matches the recorded '+(record.actor==='player'?'human':'bot')+' move.':
    'The recorded move was '+coord(record?.i)+'. This comparison is factual, not a best-move grade.');
}
function describeNative(k,board,t){
 if(!status.nativeDetail)return '';
 const side=t.side,report=status.selected===null?null:candidateReport(k,board,status.selected,side,status.ply);
 // The original native tacticalProfile offers candidate shape patterns only.
 const shape=k.tacticalProfile(board,side,8);
 let line='Original engine tactical-profile label: '+shape.urgency+
   '. Native immediate-five options for the mover: '+t.winning.length+
   '; for the opponent: '+t.danger.length+'.';
 if(report){
   line+=' Selected square: '+coord(status.selected)+
    (report.legal?'; legal under the original engine':'; illegal ('+report.reason+')')+
    (report.win?'; completes five':'')+
    '; native four groups '+(report.fours?.length||0)+
    ', native three groups '+(report.threes?.length||0)+'.';
 }
 return line+' Four/three counts and candidate ordering are engine shape heuristics, not a proof of optimal play or historical error.';
}
function ensure(){
 const hub=$('b5-hub');if(!hub)return null;
 if(!$('b8-style')){const style=document.createElement('style');style.id='b8-style';style.textContent=styles;document.head.append(style);}
 let el=$('b8-review');if(el)return el;
 el=document.createElement('section');el.id='b8-review';el.className='b8';el.hidden=true;
 el.setAttribute('aria-label','Interactive native Gomoku match replay and training');
 el.innerHTML='<div class="b8-header"><div><h3 id="b8-heading" tabindex="-1">Interactive game review</h3>'+
 '<p class="b8-muted">Owner-verified transcript · original native rules · local, ungraded practice</p></div>'+
 '<button type="button" class="btn ghost" id="b8-close">Close review</button></div>'+
 '<div id="b8-main"></div>';
 const anchor=$('b7-training');if(anchor)anchor.insertAdjacentElement('afterend',el);else hub.append(el);
 $('b8-close').onclick=()=>{clear();};
 return el;
}
function focusIndex(board){
 return board.querySelector('[data-b8-cell="'+status.focus+'"]')||
   board.querySelector('[data-b8-cell="112"]');
}
function grid(board,last,t){
 const marks=status.hints>=2&&status.mode==='guided'?t.answer:[];
 return '<div class="b8-scroller"><div id="b8-board" class="b8-grid" role="group" aria-label="Read-only verified match position; select a square to inspect">'+
 Array.from({length:225},(_,i)=>{
   const color=board[i],occupied=color!==0,
     label=coord(i)+' '+(color===1?'Black stone':color===2?'White stone':'empty')+
      (last===i?', last recorded move':'');
   return '<button type="button" class="b8-cell" data-b8-cell="'+i+'" data-last="'+(last===i)+
    '" data-selected="'+(status.selected===i)+'" data-hint="'+(marks.includes(i))+
    '" tabindex="'+(i===status.focus?0:-1)+'" aria-label="'+safe(label)+
    '" aria-pressed="'+(status.selected===i)+'">'+
    (occupied?'<span class="b8-stone" data-color="'+color+'" aria-hidden="true"></span>':'')+
    '</button>';
 }).join('')+'</div></div>';
}
function practiceQueue(m){
 // Every checkpoint is a genuine recorded human decision, not an invented
 // tactical motif or machine-labeled blunder.
 const turns=[];
 for(let i=0;i<m.moves.length;i++){
   if(m.moves[i].actor==='player')turns.push(i);
 }
 const recent=turns.slice(-6).reverse();
 if(!recent.includes(0)&&m.playerColor===1&&m.moves.length)recent.push(0);
 return recent.map(i=>'<button class="btn ghost" type="button" data-b8-jump="'+i+'">'+
   'Before ply '+(i+1)+' · '+coord(m.moves[i].i)+
   (i===m.moves.length-1?' · last decision':'')+'</button>').join('');
}
function render(){
 const el=ensure();if(!el)return;
 const who=syncOwner();if(!status.open||!who){el.hidden=true;return;}
 const m=currentMatch(),k=native();
 el.hidden=false;
 const main=$('b8-main');
 if(!m||!k){
   main.innerHTML='<p class="b8-feedback" role="alert">'+(!k?
    'The original native Renju rules kernel is unavailable. Tactical training is disabled; no fallback evaluator is provided.':
    'Owner-verified match history is unavailable or the account changed. Refresh matches before opening this review.')+'</p>';
   return;
 }
 if(!verifiedReplay(m)){
   main.innerHTML='<p class="b8-feedback" role="alert">Transcript could not be replayed by the original native kernel or matched to the server result. Review and tactical feedback are blocked.</p>';
   return;
 }
 status.ply=Math.max(0,Math.min(m.moves.length,status.ply));
 const f=frame(m,k);if(!f){main.innerHTML='<p role="alert">Invalid recorded replay position.</p>';return;}
 const next=m.moves[status.ply]||null,prior=m.moves[status.ply-1]||null,
   side=turn(status.ply),done=!next;
 // Avoid evaluating tactics after a terminal winning position.
 const t=done?{side,kind:'record',answer:[],winning:[],danger:[]}:tactical(k,f.board,status.ply);
 const last=prior?.i>=0?prior.i:-1;
 let summary='Ply '+status.ply+' / '+m.moves.length+' · '+(next?
    (side===1?'Black':'White')+' to move · '+(next.actor==='player'?'human':'bot')+' recorded next':
    'final recorded board')+'.';
 const actual=status.reveal&&next?'Recorded next: '+coord(next.i)+' by '+next.actor+'.':null;
 const originalFocus=document.activeElement?.dataset?.b8Cell;
 const boardWasFocused=originalFocus!==undefined;
 main.innerHTML='<p class="b8-muted" id="b8-context">'+safe(m.botId)+' · '+
   safe(m.playerColor===1?'played as Black':'played as White')+
   ' · '+safe(m.status)+' · '+safe(m.result?.reason)+' · '+safe(summary)+'</p>'+
   '<div class="b8-toolbar" aria-label="Replay transport">'+
   '<button class="btn ghost" id="b8-first" type="button" '+(!status.ply?'disabled':'')+'>First</button>'+
   '<button class="btn ghost" id="b8-prev" type="button" '+(!status.ply?'disabled':'')+'>Previous</button>'+
   '<label class="b8-labeled">Recorded ply <input id="b8-range" class="b8-ply" type="range" min="0" max="'+m.moves.length+'" value="'+status.ply+'"></label>'+
   '<button class="btn ghost" id="b8-next" type="button" '+(done?'disabled':'')+'>Next</button>'+
   '<button class="btn ghost" id="b8-last" type="button" '+(done?'disabled':'')+'>Last</button></div>'+
   grid(f.board,last,t)+
   '<div class="b8-panel"><div class="b8-header"><strong>Practice the actual recorded position</strong>'+
   '<label>Assistance <select id="b8-mode"><option value="guided">Guided</option><option value="independent">Independent</option></select></label></div>'+
   '<p>'+safe(question(t,m,status.ply))+'</p>'+
   (done?'<p class="b8-muted">Rewind to a decision to practice. The game outcome is from the verified server, not this replay board.</p>':
   '<div class="b8-toolbar">'+
   '<button class="btn ghost" id="b8-hint" type="button" '+(status.hints>=2?'disabled':'')+'>Next hint ('+status.hints+'/2)</button>'+
   '<button class="btn" id="b8-check" type="button" '+(status.selected===null?'disabled':'')+'>Inspect selected move</button>'+
   '<button class="btn ghost" id="b8-reveal" type="button">Reveal recorded continuation</button>'+
   '<button class="btn ghost" id="b8-native" type="button">Inspect native tactical motifs</button></div>')+
   (status.hints>0&&status.mode==='guided'?'<p class="b8-muted">'+safe(hint(t,m))+'</p>':'')+
   (status.hints>0&&status.mode==='independent'?'<p class="b8-muted">Hint available only in Guided mode; independent practice does not expose answers.</p>':'')+
   (status.feedback?'<p class="b8-feedback" role="status">'+safe(status.feedback)+'</p>':'')+
   (actual?'<p class="b8-feedback" role="status">'+safe(actual)+
    ' This is the historical move, not a certified optimal move.</p>':'')+
   (status.nativeDetail?'<p class="b8-muted">'+safe(describeNative(k,f.board,t))+'</p>':'')+
   '<p class="b8-muted">A selected square is evaluated only for exact Renju legality and immediate-five/direct-block facts. Unscored continuations are not called mistakes; no Elo, mastery, or official assessment changes.</p></div>'+
   '<details id="b8-checkpoints"><summary>Personalized review checkpoints · last recorded human decisions</summary>'+
   '<p class="b8-muted">These genuine moves are suggested for revisiting because you played them, not because an engine flagged them as errors.</p>'+
   '<div class="b8-history">'+practiceQueue(m)+'</div></details>'+
   '<p class="b8-muted">This replay never sends moves to the server or changes the original E2 board. Use the original verified board to resume a different game.</p>';
 const gridEl=$('b8-board');
 gridEl.addEventListener('click',e=>{
   const target=e.target.closest('[data-b8-cell]');
   if(!target||!next)return;
   status.selected=Number(target.dataset.b8Cell);status.focus=status.selected;
   status.feedback='';status.nativeDetail=false;render();
   focusIndex($('b8-board'))?.focus({preventScroll:true});
 });
 gridEl.addEventListener('keydown',e=>{
   const target=e.target.closest('[data-b8-cell]');if(!target)return;
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();const i=Number(target.dataset.b8Cell),x=i%15,y=Math.floor(i/15);
   const to=e.key==='ArrowLeft'?Math.max(x-1,0)+15*y:
     e.key==='ArrowRight'?Math.min(x+1,14)+15*y:
     e.key==='ArrowUp'?x+15*Math.max(y-1,0):
     e.key==='ArrowDown'?x+15*Math.min(y+1,14):e.key==='Home'?15*y:15*y+14;
   status.focus=to;gridEl.querySelectorAll('[data-b8-cell]').forEach(node=>node.tabIndex=Number(node.dataset.b8Cell)===to?0:-1);
   focusIndex(gridEl)?.focus({preventScroll:true});
 });
 function at(p){status.ply=p;resetDecision();render();}
 $('b8-first').onclick=()=>at(0);$('b8-prev').onclick=()=>at(status.ply-1);
 $('b8-next').onclick=()=>at(status.ply+1);$('b8-last').onclick=()=>at(m.moves.length);
 $('b8-range').onchange=e=>at(Number(e.target.value));
 $('b8-mode').value=status.mode;
 $('b8-mode').onchange=e=>{status.mode=e.target.value;status.hints=0;status.feedback='';render();};
 if(next){
   $('b8-hint').onclick=()=>{if(status.mode==='independent'){status.feedback='Switch to Guided mode to see hints.';}else status.hints=Math.min(2,status.hints+1);render();};
   $('b8-check').onclick=()=>{status.feedback=feedback(k,f.board,t,m);render();};
   $('b8-reveal').onclick=()=>{status.reveal=true;render();};
   $('b8-native').onclick=()=>{status.nativeDetail=!status.nativeDetail;render();};
 }
 main.querySelectorAll('[data-b8-jump]').forEach(node=>node.onclick=()=>at(Number(node.dataset.b8Jump)));
 if(boardWasFocused)focusIndex($('b8-board'))?.focus({preventScroll:true});
}
function resetDecision(){status.selected=null;status.hints=0;status.reveal=false;status.feedback='';status.nativeDetail=false;status.focus=112;}
function openById(id,ply){
 const who=syncOwner(),s=source();
 if(!who||s?.ownerVerified!==true||s.ownerKey!==who||!Array.isArray(s.matches))return false;
 const m=s.matches.find(x=>x?.id===id);
 if(!m||!UUID.test(String(id))||m.ownerVerified!==true||
   m.integrity?.serverAuthoritative!==true||m.integrity?.verifiedRules!==true||
   !['completed','resigned'].includes(m.status)||!E?.getBot(m.botId)||
   m.rule!=='renju-practice'||!Array.isArray(m.moves)||!m.result)return false;
 status.matchId=id;status.ply=Number.isInteger(ply)?Math.max(0,Math.min(m.moves.length,ply)):Math.max(0,m.moves.length-1);
 status.mode='independent';status.open=true;resetDecision();lastError='';
 render();if($('b8-review')&&!$('b8-review').hidden){
   $('b8-review').scrollIntoView({block:'start',behavior:'auto'});
   $('b8-heading')?.focus({preventScroll:true});
 }
 return true;
}
window.addEventListener('gomoku:bot-workspace-opened',()=>{ensure();render();});
window.addEventListener('gomoku:bot-training-data-updated',render);
window.addEventListener('gomoku:bot-match-updated',()=>{if(status.open)render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&status.open)render();});
window.GomokuBotReviewE8=Object.freeze({version:'e8.1',openById,close:clear,readOnlyState:()=>{
 const who=syncOwner(),m=currentMatch();
 return Object.freeze({ownerPresent:!!who,reviewOpen:!!m&&status.open,matchId:m?.id||null,ply:m?status.ply:null,
  certifiedTrainingGrade:false,ratedPointsAwarded:false,engine:typeof window.createEngine==='function'?'native-studio':'unavailable'});
}});
})();