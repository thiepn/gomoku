/* Bot Elo E9 — actual-transcript decision journeys.
 * Uses E8's read-only position board, E5/E7 authenticated source and the
 * ORIGINAL Studio Renju kernel. Ephemeral session observations ONLY:
 * no new match, Elo, mastery, achievement or grading authority.
 */
(function(){
'use strict';
if(window.GomokuBotTrainingE9)return;
const $=id=>document.getElementById(id), E=window.GomokuBotEloE1;
const source=()=>window.GomokuBotWorkspaceE5?.e7SourceSnapshot?.();
const owner=()=>{const a=window.GomokuCompetitionBridge?.account?.();return a?.connected===true?a.userId||null:null;};
const replay=()=>window.GomokuBotReviewE8;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS='ABCDEFGHJKLMNOP', coord=i=>i===-1?'Pass':COLS[i%15]+(15-Math.floor(i/15));
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={owner:null,matchId:null,decisions:[],chain:[],step:0,choice:null,submitted:false,
 hints:0,reveal:false,mode:'independent',response:'',reflection:'',records:new Map(),
 status:'',working:false,initialized:false,filter:'focus'};
let native=null,linkedToken='';
const css=[
'.b9{margin:13px 0;padding:13px;border:1px solid var(--hair,#9ca3a9);background:var(--card,#fff);font-size:12px;line-height:1.55;color:var(--ink,#222)}',
'.b9[hidden]{display:none!important}.b9 h3{font-size:15px;margin:0}.b9 h4{font-size:12px;margin:12px 0 5px}',
'.b9-hd{display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px}',
'.b9-muted{font-size:11px;color:var(--ink2,#596471);margin:5px 0}',
'.b9-toolbar{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:9px 0}',
'.b9-toolbar button,.b9-toolbar select{min-height:42px;font-size:11px}',
'.b9-toolbar button{flex:0 1 auto}.b9-toolbar button:focus-visible,.b9 button:focus-visible,.b9 textarea:focus-visible{outline:3px solid var(--seal,#315c58);outline-offset:2px}',
'.b9-meter{height:6px;max-width:420px;background:var(--hair,#ccc);margin:7px 0}',
'.b9-meter span{display:block;background:var(--seal,#315c58);height:100%}',
'.b9-block{padding:10px;border:1px solid var(--hair,#aaa);margin:10px 0}',
'.b9-answer{border-left:3px solid var(--seal,#315c58);background:var(--card2,#eee);padding:9px;margin:9px 0}',
'.b9 textarea{width:100%;box-sizing:border-box;min-height:68px;resize:vertical;background:var(--paper,#fff);color:var(--ink,#222);padding:7px}',
'.b9-practice{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:7px}',
'.b9-practice button{border:1px solid var(--hair,#aaa);text-align:left;min-height:63px;font-size:11px;padding:9px;background:var(--card2,#eee);border-radius:3px}',
'.b9-practice button strong,.b9-practice button span{display:block}',
'.b9-practice button span{color:var(--ink2,#596471)}',
'.b9-mini{font-size:10px;color:var(--ink2,#596471)}',
'.b9-path{margin:8px 0;padding-left:21px}.b9-path li{padding:5px 0}',
'.b9-tags{display:flex;gap:6px;flex-wrap:wrap}.b9-tags span{padding:3px 6px;border:1px solid var(--hair,#bbb);font-size:10px}',
'@media(max-width:510px){.b9{padding:9px}.b9-toolbar button{flex:1;min-width:120px}.b9-practice{grid-template-columns:1fr}}'
].join('');
function reset(full){
 state.decisions=[];state.chain=[];state.step=0;state.choice=null;state.submitted=false;
 state.hints=0;state.reveal=false;state.response='';state.reflection='';state.status='';
 state.initialized=false;state.filter='focus';state.working=false;
 if(full){state.records.clear();state.mode='independent';}
}
function sync(){
 const who=owner(),s=source(),r=replay()?.readOnlyState?.(),match=r?.reviewOpen?r.matchId:null;
 if(who!==state.owner||match!==state.matchId){
   state.owner=who;state.matchId=match;reset(true);linkedToken='';
 }
 const allowed=!!who&&UUID.test(who)&&s?.ownerVerified===true&&s.ownerKey===who&&
  r?.reviewOpen===true&&UUID.test(String(match||''))&&Array.isArray(s.matches);
 if(!allowed)return null;
 const m=s.matches.find(x=>x.id===match);
 if(!m||m.ownerVerified!==true||m.integrity?.serverAuthoritative!==true||
    m.integrity?.verifiedRules!==true||m.rule!=='renju-practice'||
    !['resigned','completed'].includes(m.status)||!m.result||
    ![1,2].includes(m.playerColor)||!E?.getBot(m.botId)||
    !Array.isArray(m.moves)||m.moves.length>227)return null;
 return {m,r};
}
function engine(){
 if(native)return native;
 if(typeof window.createEngine!=='function')return null;
 const n=window.createEngine('renju-practice');
 if(!n||typeof n.replay!=='function'||typeof n.legalMove!=='function'||typeof n.winningMoves!=='function')
   return null;
 native=n;return n;
}
function recheck(m,n){
 try{
   const entire=n.replay(m.moves);
   const result=entire.result;
   if(m.status==='completed'&&(!result||result.winner!==m.result.winner||result.reason!==m.result.reason))return false;
   if(m.status==='resigned'&&(result||m.result.reason!=='resign'||m.result.winner!==3-m.playerColor))return false;
   for(let j=0;j<m.moves.length;j++){
     const x=m.moves[j],color=j%2+1;
     if(x.color!==color||x.actor!==(color===m.playerColor?'player':'bot'))return false;
   }
   return true;
 }catch(_){return false;}
}
function validWins(n,board,color,count){
 // Native winningMoves alone may include Black-foul coordinates. Confirm
 // every option with the SAME native legalMove kernel.
 return n.winningMoves(board,color).filter(i=>{
   const result=n.legalMove(board,i,color,count);
   return result.legal===true&&result.win===true;
 });
}
function kindAt(n,m,ply){
 let frame;
 try{frame=n.replay(m.moves.slice(0,ply));}catch(_){return null;}
 if(frame.result||ply>=m.moves.length)return null;
 const side=ply%2+1;
 const own=validWins(n,frame.board,side,ply),opp=validWins(n,frame.board,3-side,ply);
 const block=opp.length===1&&n.legalMove(frame.board,opp[0],side,ply).legal===true?[opp[0]]:[];
 const kind=ply===0?'opening':own.length?'immediate-five':block.length?'direct-block':'historical';
 const targets=kind==='opening'?[112]:kind==='immediate-five'?own:kind==='direct-block'?block:[];
 return {ply,side,kind,targets,own,opp,board:frame.board,record:m.moves[ply]};
}
function build(m,n){
 const original=[];
 for(let ply=0;ply<m.moves.length;ply++)if(m.moves[ply].actor==='player'){
   const d=kindAt(n,m,ply);
   if(d)original.push({ply,kind:d.kind});
 }
 state.decisions=original;
 state.initialized=true;
 const current=replay()?.readOnlyState?.()?.ply;
 const start=original.findIndex(d=>d.ply>=current);
 const pos=start>=0?start:Math.max(0,original.length-1);
 startChain(pos,m);
}
function scoreFor(d){
 // Merely prioritization inside current browser view, never mastery or Elo.
 const record=state.records.get(d.ply);
 if(record?.needsLook)return 0;
 if(!record)return d.kind==='immediate-five'||d.kind==='direct-block'?1:2;
 return 3;
}
function ordered(){
 const pool=state.decisions.slice();
 if(state.filter==='focus')pool.sort((a,b)=>scoreFor(a)-scoreFor(b)||b.ply-a.ply);
 else pool.sort((a,b)=>a.ply-b.ply);
 return pool;
}
function startChain(index,m){
 const first=state.decisions[index];if(!first)return;
 const chronological=state.decisions.filter(d=>d.ply>=first.ply).slice(0,3);
 state.chain=chronological.map(d=>d.ply);state.step=0;
 state.choice=null;state.submitted=false;state.hints=0;state.reveal=false;
 state.response='';state.reflection='';state.status='';
 const target=state.chain[0];
 if(!replay()?.seekVerifiedPly?.(target))state.status='Cannot reach this original verified position.';
}
function choose(ply,m){
 const i=state.decisions.findIndex(d=>d.ply===ply);
 if(i<0)return;startChain(i,m);render();
}
function label(kind){
 return kind==='opening'?'Opening center requirement':
  kind==='immediate-five'?'Immediate legal five':
  kind==='direct-block'?'Single-square immediate-five defense':
  'Independent recorded-decision comparison';
}
function prompt(d){
 if(d.kind==='opening')return 'Which exact point is required for Black’s opening move? Select on the existing replay board above.';
 if(d.kind==='immediate-five')return 'Find any immediate legal five for the player to move. The original Renju rules decide this, not a heuristic score.';
 if(d.kind==='direct-block')return 'The opponent has exactly one currently legal immediate-five point. Can you occupy that square directly?';
 return 'Choose an independently plausible move, explain why, and compare it with the historical human choice. No unproven best answer.';
}
function hint(d){
 if(!state.hints)return '';
 if(state.hints===1){
   if(d.kind==='opening')return 'Original rules: the Black opening is in the center.';
   if(d.kind==='immediate-five')return 'A legal move can finish a line of five now. For Black, forbidden overlines and double threats still matter.';
   if(d.kind==='direct-block')return 'Look at the opponent’s immediate winning square, then check your legal access to it.';
   return 'Consider the last move, attack, defense, and Black’s forbidden moves. There is no certified unique target.';
 }
 return d.targets.length?'Exact native-rule targets: '+d.targets.map(coord).join(', ')+'.':
  'No certified best point is available. Reveal the actual recorded human move only as historical evidence.';
}
function misconception(n,d,index,analysis){
 if(!analysis.legal){
   const map={'occupied':'The square is occupied.','opening-center':'The required first move is at H8.',
     'overline':'Black would create a forbidden line longer than five.',
     'double-three':'The original Renju kernel detected a forbidden Black double-three.',
     'double-four':'The original Renju kernel detected a forbidden Black double-four.'};
   return map[analysis.reason]||'The original Renju kernel rejects this point ('+analysis.reason+').';
 }
 if(d.kind==='opening'&&index!==112)return 'Black must begin at center H8. A non-center first move violates the opening rule.';
 if(d.kind==='immediate-five'&&!d.targets.includes(index))return 'Legal, but this square does not win immediately. The objective was a one-move five, not a general positional choice.';
 if(d.kind==='direct-block'&&!d.targets.includes(index))return 'Legal, but the one observed immediate-five square '+coord(d.targets[0])+' remains unoccupied. This does not assess other future counterplay.';
 if(d.kind==='historical'&&index!==d.record.i)return 'This is a legal alternative. The verified record selected '+coord(d.record.i)+'. Neither choice is certified optimal.';
 return d.kind==='historical'?'The move matches the original recorded choice. Matching history is not proof of strategic quality.':
   'The selected square satisfies this exact one-move rule objective. Longer tactical consequences have not been proven.';
}
function opponentPreview(n,d,i){
 const act=n.legalMove(d.board,i,d.side,d.ply);
 if(!act.legal||act.win)return '';
 const next=new Int8Array(d.board);
 next[i]=d.side;
 const answer=validWins(n,next,3-d.side,d.ply+1);
 return 'One-ply preview using original rules: after your hypothetical '+coord(i)+
   ', the opponent would have '+answer.length+' legal immediate-five completion'+(answer.length===1?'':'s')+
   (answer.length&&answer.length<=4?' ('+answer.map(coord).join(', ')+')':'')+
   '. This does not choose an opponent reply or prove the continuation.';
}
function submit(context,n){
 if(state.working)return;
 const d=kindAt(n,context.m,state.chain[state.step]);
 const selection=replay()?.readOnlyState?.()?.selectedIndex;
 if(!d||!Number.isInteger(selection)||selection<0||selection>=225){
   state.status='Select a point on the original E8 board above before inspecting it.';render();return;
 }
 if(replay()?.readOnlyState?.()?.ply!==d.ply){
   state.status='Replay moved to another ply. Return to the shown source decision first.';render();return;
 }
 const analysis=n.legalMove(d.board,selection,d.side,d.ply);
 const objective=d.targets.length>0;
 const matches=objective&&analysis.legal&&d.targets.includes(selection);
 const issue=!analysis.legal||(objective&&!matches);
 const observation=state.records.get(d.ply)||{attempts:0,needsLook:false};
 // Counts indicate only this volatile browser session's objective checks.
 observation.attempts+=1;observation.needsLook=issue;
 observation.lastKind=d.kind;observation.lastObserved=issue?'revisit':
   objective?'one-move-target-observed':'legal-variation-inspected';
 state.records.set(d.ply,observation);
 state.choice=selection;state.submitted=true;
 state.response=coord(selection)+': '+misconception(n,d,selection,analysis)+
   (analysis.legal?' '+opponentPreview(n,d,selection):'');
 state.status=issue?'Revisit this decision using the original rule evidence.':
  objective?'One-move objective observed. This is not a proficiency grade.':
  'Legal continuation inspected. Historical comparison is not a correctness grade.';
 render();
}
function moveNext(m){
 if(state.step>=state.chain.length-1){
   state.status='Journey complete. Select a different verified decision below or review the same chain again.';
   render();return;
 }
 if(!state.submitted&&!state.reveal){
   state.status='Inspect a selected point or reveal the recorded continuation before moving forward.';
   render();return;
 }
 state.step++;state.choice=null;state.submitted=false;state.hints=0;state.reveal=false;
 state.response='';state.reflection='';state.status='';
 replay()?.seekVerifiedPly?.(state.chain[state.step]);render();
}
function afterHuman(m,ply){
 const current=m.moves[ply],future=m.moves.slice(ply+1,state.chain[state.step+1]??Math.min(m.moves.length,ply+3));
 return {record:current,follow:future};
}
function ensure(){
 const e8=$('b8-review');if(!e8)return null;
 if(!$('b9-css')){
   const cssEl=document.createElement('style');cssEl.id='b9-css';cssEl.textContent=css;document.head.append(cssEl);
 }
 let el=$('b9-journeys');if(el)return el;
 el=document.createElement('section');el.id='b9-journeys';el.className='b9';el.hidden=true;
 el.setAttribute('aria-label','Original-match progressive decision journeys');
 el.innerHTML='<div class="b9-hd"><div><h3 id="b9-heading">Progressive decision journeys</h3>'+
  '<p class="b9-muted">Actual verified opponent replies · native rules · independent-to-guided practice</p></div></div>'+
  '<div id="b9-content"></div>';
 e8.append(el);return el;
}
function render(){
 const box=ensure();if(!box)return;
 const ctx=sync(),n=engine();
 box.hidden=!ctx;
 if(!ctx)return;
 const region=$('b9-content');
 if(!n||!recheck(ctx.m,n)){
   region.innerHTML='<p role="alert">Native Studio rules unavailable or the full source transcript failed verification. Progressive exercises are disabled.</p>';
   return;
 }
 if(!state.initialized)build(ctx.m,n);
 if(!state.chain.length){
   region.innerHTML='<p class="b9-muted">This verified record contains no playable human decision. No exercise is invented.</p>';return;
 }
 const active=state.chain[state.step],d=kindAt(n,ctx.m,active);
 if(!d){region.innerHTML='<p role="alert">Source position unavailable; this decision is not graded or generated.</p>';return;}
 const e8=replay()?.readOnlyState?.();
 const aligned=e8?.ply===d.ply;
 const next=state.step+1<state.chain.length,following=afterHuman(ctx.m,d.ply);
 const path=state.chain.map((p,i)=>'<li>'+esc('Decision '+(i+1)+' · before recorded ply '+(p+1)+
   (i===state.step?' · current':i<state.step?' · examined':' · upcoming'))+'</li>').join('');
 const choices=ordered().slice(0,12);
 const totalChecks=[...state.records.values()].reduce((sum,x)=>sum+x.attempts,0),
   unresolved=[...state.records.values()].filter(x=>x.needsLook).length;
 const selected=e8?.selectedIndex;
 const checkDisabled=!aligned||!Number.isInteger(selected);
 const priorFocus=document.activeElement?.id||null;
 let html='<p class="b9-muted">A journey follows up to three real recorded human decisions with the genuine bot moves in between. Alternative answers are inspected locally; subsequent positions always return to the historical transcript.</p>'+
  '<div class="b9-tags"><span>'+state.decisions.length+' genuine human checkpoints</span><span>'+totalChecks+' inspections this session</span>'+
  '<span>'+unresolved+' objective(s) flagged to revisit</span></div>'+
  '<div class="b9-toolbar"><label>Practice mode <select id="b9-mode">'+
  '<option value="independent">Independent first</option><option value="guided">Guided with hints</option></select></label>'+
  '<button class="btn ghost" type="button" id="b9-focus">Prioritize unfinished / revisits</button>'+
  '<button class="btn ghost" type="button" id="b9-chronological">Chronological</button></div>'+
  '<div class="b9-block"><strong>Linked journey · step '+(state.step+1)+' / '+state.chain.length+'</strong>'+
  '<div class="b9-meter" role="progressbar" aria-label="Current journey step" aria-valuemin="0" aria-valuemax="'+state.chain.length+
  '" aria-valuenow="'+(state.step+1)+'"><span style="width:'+(((state.step+1)/state.chain.length)*100).toFixed(0)+'%"></span></div>'+
  '<ol class="b9-path">'+path+'</ol><p><strong>'+esc(label(d.kind))+'</strong> · '+esc(prompt(d))+'</p>'+
  (!aligned?'<p class="b9-answer">E8 board is at a different recorded ply. Return to this exact decision to use the original board.</p>':'')+
  '<div class="b9-toolbar"><button class="btn ghost" id="b9-sync" type="button">Show this decision on E8 board</button>'+
  '<button class="btn" id="b9-submit" type="button" '+(checkDisabled?'disabled':'')+'>Inspect E8 selection</button>'+
  '<button class="btn ghost" id="b9-hint" type="button" '+(state.hints>=2||state.mode==='independent'?'disabled':'')+'>Hint '+state.hints+'/2</button>'+
  '<button class="btn ghost" id="b9-reveal" type="button">Reveal actual record</button></div>'+
  '<label for="b9-explain">Explain your reasoning (optional; not graded or saved)</label>'+
  '<textarea id="b9-explain" maxlength="900" placeholder="What immediate threat or rule constraint did you inspect?"></textarea>'+
  (state.hints?'<p class="b9-muted">'+esc(hint(d))+'</p>':'')+
  (state.response?'<p class="b9-answer" role="status">'+esc(state.response)+'</p>':'')+
  (state.status?'<p class="b9-muted" role="status">'+esc(state.status)+'</p>':'')+
  (state.reveal?'<div class="b9-answer"><strong>Actual source decision:</strong> '+esc(coord(following.record.i))+
    ' by '+esc(following.record.actor)+'. Not necessarily the optimal move.'+
    (following.follow.length?'<p>Recorded intervening moves: '+following.follow.map(m=>esc(m.actor+' '+coord(m.i))).join(' → ')+
     '. These are authenticated historical replies, not bot responses to your hypothetical choice.</p>':'')+
    '</div>':'')+
  '<div class="b9-toolbar"><button class="btn" type="button" id="b9-next" '+(!next||(!state.submitted&&!state.reveal)?'disabled':'')+
    '>Next original decision</button><button class="btn ghost" type="button" id="b9-restart">Repeat this journey</button></div></div>'+
  '<h4>Adaptive practice queue (this session only)</h4>'+
  '<p class="b9-muted">Order reflects rule-objective misses and uninspected source decisions in this open browser session, not stored achievement, measured skill, or a model-assigned blunder.</p>'+
  '<div class="b9-practice">'+choices.map((item,i)=>{
    const r=state.records.get(item.ply);
    return '<button type="button" data-b9-choose="'+item.ply+'"><strong>'+
      esc('Before ply '+(item.ply+1)+' · '+label(item.kind))+'</strong><span>'+
      esc(r?.needsLook?'Needs another look':r?.attempts?'Examined this session':'Not inspected')+
      ' · original '+coord(ctx.m.moves[item.ply]?.i)+'</span></button>';
  }).join('')+'</div>'+
  '<p class="b9-muted">All results are provisional local observations. No backend writes, new game branches, rated points, skill certificates, or persistent mastery.</p>';
 region.innerHTML=html;
 $('b9-mode').value=state.mode;$('b9-explain').value=state.reflection;
 $('b9-explain').oninput=e=>{state.reflection=String(e.target.value).slice(0,900);};
 $('b9-mode').onchange=e=>{state.mode=e.target.value;state.hints=0;render();};
 $('b9-focus').onclick=()=>{state.filter='focus';render();};
 $('b9-chronological').onclick=()=>{state.filter='chronological';render();};
 $('b9-sync').onclick=()=>{replay()?.seekVerifiedPly?.(d.ply);render();};
 $('b9-submit').onclick=()=>submit(ctx,n);
 $('b9-hint').onclick=()=>{if(state.mode==='guided')state.hints=Math.min(2,state.hints+1);render();};
 $('b9-reveal').onclick=()=>{state.reveal=true;render();};
 $('b9-next').onclick=()=>moveNext(ctx.m);
 $('b9-restart').onclick=()=>{
   const beginning=state.chain[0],idx=state.decisions.findIndex(item=>item.ply===beginning);
   startChain(idx,ctx.m);render();
 };
 region.querySelectorAll('[data-b9-choose]').forEach(btn=>btn.onclick=()=>choose(Number(btn.dataset.b9Choose),ctx.m));
 if(priorFocus&&['b9-submit','b9-hint','b9-reveal','b9-sync','b9-next','b9-mode'].includes(priorFocus))
   $(priorFocus)?.focus({preventScroll:true});
}
window.addEventListener('gomoku:bot-e8-position',render);
window.addEventListener('gomoku:bot-training-data-updated',render);
window.addEventListener('gomoku:bot-workspace-opened',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.GomokuBotTrainingE9=Object.freeze({version:'e9.1',render,readOnlyState:()=>{
 const ctx=sync();
 return Object.freeze({ready:!!ctx,matchId:ctx?.m.id||null,chainLength:state.chain.length,
  step:state.step,sessionInspections:[...state.records.values()].reduce((a,x)=>a+x.attempts,0),
  authoritativeGrades:false,ratingWrites:false,store:'volatile-view-only'});
}});
})();