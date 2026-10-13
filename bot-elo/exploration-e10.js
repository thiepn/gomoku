/* Bot Elo E10: source-grounded tactical exploration, reconstruction and
 * explicit learner priorities. Uses only the original Studio native rules.
 * All hypothetical moves exist inside this disposable training view, NEVER
 * E2 game custody, E4 rating authority, or a new mastery/profile store.
 */
(function(){
'use strict';
if(window.GomokuBotExplorationE10)return;
const $=id=>document.getElementById(id),E=window.GomokuBotEloE1;
const source=()=>window.GomokuBotWorkspaceE5?.e7SourceSnapshot?.();
const viewer=()=>window.GomokuBotReviewE8;
const account=()=>window.GomokuCompetitionBridge?.account?.();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS='ABCDEFGHJKLMNOP',CATEGORIES=[
 {id:'all',name:'All original decisions'},
 {id:'win',name:'Find immediate fives'},
 {id:'defense',name:'Inspect direct defenses'},
 {id:'opening',name:'Opening discipline'},
 {id:'legality',name:'Renju legality and shapes'},
 {id:'record',name:'Reconstruct recorded moves'}
];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=i=>i===-1?'Pass':COLS[i%15]+(15-Math.floor(i/15));
const st={owner:null,matchId:null,ply:null,tab:'explore',priority:'all',selected:null,focusCell:112,
  steps:[],notice:'',inspection:'',showRecord:false,recallStep:0,recallChecked:false,recallNotice:'',
  answers:new Map(),byPly:new Map(),queue:[],expanded:false,focusRestore:false};
let engine=null;
const CSS=[
'.b10{margin:14px 0 2px;border:1px solid var(--hair,#999);padding:12px;background:var(--card,#fff);font-size:12px;line-height:1.5;color:var(--ink,#222)}',
'.b10[hidden]{display:none!important}.b10 h3{font-size:15px;margin:0}.b10 h4{font-size:12px;margin:11px 0 5px}',
'.b10-muted{font-size:11px;color:var(--ink2,#58616c);margin:6px 0;line-height:1.55}',
'.b10-top{display:flex;align-items:start;justify-content:space-between;flex-wrap:wrap;gap:10px}',
'.b10-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0}',
'.b10-controls button,.b10-controls select{min-height:42px;font-size:12px}',
'.b10-controls button:focus-visible,.b10-grid button:focus-visible{outline:3px solid var(--seal,#315c58);outline-offset:-2px}',
'.b10-controls button:disabled{opacity:.5;cursor:default}',
'.b10-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0}',
'.b10-tabs button{min-height:42px;padding:8px 10px;border:1px solid var(--hair,#aaa);background:transparent}',
'.b10-tabs button[aria-pressed="true"]{border:2px solid var(--seal,#315c58);font-weight:700}',
'.b10-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain}',
'.b10-grid{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));min-width:345px;max-width:510px;width:100%;aspect-ratio:1;padding:3px;box-sizing:border-box;margin:0 auto;background:var(--card2,#e3d4ae);border:1px solid var(--hair,#999)}',
'.b10-grid button{padding:0;border-radius:0;background:transparent;border:1px solid color-mix(in srgb,var(--ink,#333) 17%,transparent);min-height:0;min-width:0;aspect-ratio:1;display:grid;place-items:center}',
'.b10-grid button[data-selected="true"]{outline:2px solid #8e641f;outline-offset:-3px}',
'.b10-grid button[data-new="true"]{box-shadow:inset 0 0 0 2px #2c8b7c}',
'.b10-stone{display:block;width:75%;height:75%;border-radius:50%;box-shadow:0 1px 2px #0005}',
'.b10-stone[data-color="1"]{background:#20252a;border:1px solid #000}',
'.b10-stone[data-color="2"]{background:#fcfcf8;border:1px solid #747b80}',
'.b10-box{margin:10px 0;padding:10px;border:1px solid var(--hair,#aaa)}',
'.b10-result{padding:9px;border-left:3px solid var(--seal,#315c58);background:var(--card2,#eee);margin:9px 0}',
'.b10-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:7px}',
'.b10-list button{text-align:left;padding:8px;min-height:56px;border:1px solid var(--hair,#aaa);background:var(--card2,#eee);border-radius:3px}',
'.b10-list strong,.b10-list span{display:block}.b10-list span{font-size:11px;color:var(--ink2,#58616c)}',
'.b10-stats{display:flex;gap:6px;flex-wrap:wrap}.b10-stats span{border:1px solid var(--hair,#aaa);padding:3px 6px;font-size:10px}',
'@media(max-width:490px){.b10{padding:9px}.b10-controls button{flex:1;min-width:125px}.b10-list{grid-template-columns:1fr}}'
].join('');
function native(){
 if(engine)return engine;
 if(typeof window.createEngine!=='function')return null;
 const n=window.createEngine('renju-practice');
 if(!n||typeof n.replay!=='function'||typeof n.legalMove!=='function'||
    typeof n.winningMoves!=='function'||typeof n.tacticalProfile!=='function')return null;
 engine=n;return n;
}
function clearAll(){
 st.steps=[];st.selected=null;st.notice='';st.inspection='';st.recallStep=0;
 st.recallChecked=false;st.recallNotice='';st.showRecord=false;st.queue=[];
 st.answers.clear();st.byPly.clear();st.ply=null;st.matchId=null;st.focusCell=112;
 st.priority='all';st.tab='explore';st.expanded=false;
 const box=$('b10-explore');if(box)box.hidden=true;
}
function retainPly(){
 if(!Number.isInteger(st.ply))return;
 st.byPly.delete(st.ply);
 st.byPly.set(st.ply,{steps:st.steps.map(m=>({...m})),recallStep:st.recallStep,
  recallChecked:st.recallChecked,recallNotice:st.recallNotice,tab:st.tab,
  showRecord:st.showRecord});
 while(st.byPly.size>12)st.byPly.delete(st.byPly.keys().next().value);
}
function adoptPly(ply){
 const remembered=st.byPly.get(ply);
 st.ply=ply;st.steps=remembered?.steps.map(x=>({...x}))||[];
 st.recallStep=remembered?.recallStep||0;st.recallChecked=remembered?.recallChecked||false;
 st.recallNotice=remembered?.recallNotice||'';
 st.showRecord=remembered?.showRecord||false;st.tab=remembered?.tab||st.tab;
 st.selected=null;st.notice='';st.inspection='';st.focusCell=112;
}
function context(){
 const a=account(),who=a?.connected===true&&UUID.test(String(a.userId||''))?a.userId:null;
 const v=viewer()?.readOnlyState?.(),id=v?.reviewOpen?v.matchId:null;
 if(who!==st.owner||id!==st.matchId){
   clearAll();st.owner=who;st.matchId=id;
 }
 const s=source();
 if(!who||!id||!UUID.test(id)||s?.ownerVerified!==true||s.ownerKey!==who||
    !Array.isArray(s.matches))return null;
 const m=s.matches.find(item=>item?.id===id);
 if(!m||m.ownerVerified!==true||m.integrity?.serverAuthoritative!==true||
   m.integrity?.verifiedRules!==true||m.rule!=='renju-practice'||!E?.getBot(m.botId)||
   !['completed','resigned'].includes(m.status)||!m.result||
   ![1,2].includes(m.playerColor)||!Array.isArray(m.moves)||m.moves.length>227)return null;
 const k=native();if(!k)return {m,k:null,v};
 if(st.ply!==v.ply){retainPly();adoptPly(v.ply);}
 return {m,k,v};
}
function verify(m,k){
 if(!k)return false;
 try{
   const full=k.replay(m.moves),end=full.result;
   if(m.status==='completed'&&(!end||end.winner!==m.result.winner||end.reason!==m.result.reason))return false;
   if(m.status==='resigned'&&(end||m.result.reason!=='resign'||m.result.winner!==3-m.playerColor))return false;
   for(let i=0;i<m.moves.length;i++){
     const color=i%2+1,move=m.moves[i];
     if(move.color!==color||move.actor!==(color===m.playerColor?'player':'bot'))return false;
   }
   return true;
 }catch(_){return false;}
}
function sourceFrame(m,k,ply){
 if(!Number.isInteger(ply)||ply<0||ply>m.moves.length)return null;
 try {return k.replay(m.moves.slice(0,ply));}catch(_){return null;}
}
function exactWins(k,board,color,moveCount){
 return k.winningMoves(board,color).filter(i=>{
   const r=k.legalMove(board,i,color,moveCount);
   return r.legal===true&&r.win===true;
 });
}
function themeAt(k,m,ply){
 const frame=sourceFrame(m,k,ply);if(!frame||frame.result)return null;
 const color=ply%2+1,own=exactWins(k,frame.board,color,ply),
    threat=exactWins(k,frame.board,3-color,ply),
    single=threat.length===1&&k.legalMove(frame.board,threat[0],color,ply).legal===true;
 const category=ply===0?'opening':own.length?'win':single?'defense':'record';
 return {ply,category,immediate:own.length,threats:threat.length};
}
function originalDecisions(m,k){
 if(st.queue.length)return st.queue;
 const pool=[];
 for(let p=0;p<m.moves.length;p++)if(m.moves[p].actor==='player'){
   const t=themeAt(k,m,p);
   if(t)pool.push(t);
 }
 st.queue=pool;return pool;
}
function ordered(m,k){
 const base=originalDecisions(m,k).filter(item=>st.priority==='all'||st.priority==='legality'||
   st.priority==='record'||item.category===st.priority);
 const issues=st.answers;
 base.sort((a,b)=>{
   const grade=x=>issues.get(x.ply)?.needsReview?0:
     !issues.has(x.ply)?1:2;
   return grade(a)-grade(b)||b.ply-a.ply;
 });
 return base.slice(0,9);
}
function focus(ply,m){
 if(!Number.isInteger(ply)||m.moves[ply]?.actor!=='player')return;
 const guided=window.GomokuBotTrainingE9?.focusVerifiedDecision?.(ply);
 if(!guided)viewer()?.seekVerifiedPly?.(ply);
}
function currentBoard(ctx){
 const {m,k}=ctx,frame=sourceFrame(m,k,st.ply);
 if(!frame||frame.result)return null;
 const board=Int8Array.from(frame.board);
 let passes=frame.passes||0,terminal=false;
 for(let i=0;i<st.steps.length;i++){
   const move=st.steps[i],turn=(st.ply+i)%2+1;
   if(terminal||move.color!==turn)return null;
   const r=k.legalMove(board,move.i,turn,st.ply+i);
   if(!r?.legal)return null;
   if(move.i===-1){passes++;}else{board[move.i]=turn;passes=0;}
   if(r.win||passes>=2||board.every(x=>x!==0))terminal=true;
 }
 return {board,turn:(st.ply+st.steps.length)%2+1,ply:st.ply+st.steps.length,
    done:terminal||st.steps.length>=6,terminal,passes,last:st.steps.at(-1)?.i??-2};
}
function boardHTML(board,prefix,selection,last){
 const original=document.activeElement?.dataset?.b10Cell!==undefined;
 return '<div class="b10-scroll"><div id="b10-grid" class="b10-grid" role="group" aria-label="'+
   esc(prefix)+' interactive hypothetical or reconstruction position">'+
   Array.from({length:225},(_,i)=>{
    const value=board[i];
    return '<button type="button" data-b10-cell="'+i+'" data-selected="'+(selection===i)+
     '" data-new="'+(i===last)+'" tabindex="'+(i===st.focusCell?0:-1)+
     '" aria-pressed="'+(selection===i)+'" aria-label="'+esc(coord(i)+' '+
     (value===1?'Black stone':value===2?'White stone':'empty')+(last===i?' · last hypothetical move':''))+'">'+
     (value?'<span class="b10-stone" data-color="'+value+'" aria-hidden="true"></span>':'')+
     '</button>';
   }).join('')+'</div></div>';
}
function inspect(ctx){
 const position=currentBoard(ctx);
 if(!position)return;
 const i=st.selected;
 if(i===null){st.notice='Select a coordinate on the exploration board first.';return;}
 const k=ctx.k,r=k.legalMove(position.board,i,position.turn,position.ply);
 if(!r.legal){
   const reasons={'occupied':'That point is already occupied.',
     'opening-center':'Black’s first move must be H8.',
     'double-three':'The original Renju kernel rejects a Black double-three.',
     'double-four':'The original Renju kernel rejects a Black double-four.',
     'overline':'Black cannot play a forbidden overline.'};
   st.inspection=coord(i)+': '+(reasons[r.reason]||'Illegal under original native rules: '+r.reason)+
     ' This is a legality finding, not a general strategy grade.';
   return;
 }
 const side=position.turn,own=exactWins(k,position.board,side,position.ply);
 const danger=exactWins(k,position.board,3-side,position.ply);
 const sample=new Int8Array(position.board);sample[i]=side;
 const after=r.win?[]:exactWins(k,sample,3-side,position.ply+1);
 st.inspection=coord(i)+' is legal'+(r.win?' and completes a winning five':'')+
   '. Current immediate legal fives for the mover: '+own.length+
   ', opponent: '+danger.length+'. Native four groups created: '+(r.fours?.length||0)+
   '; native three groups created: '+(r.threes?.length||0)+'.'+
   (r.win?' This is a checked one-move win.':
    ' If you choose this move, the other color has '+after.length+
      ' immediate legal five completion'+(after.length===1?'':'s')+' available. The opponent has NOT chosen a reply.')+
   ' The original shape analysis is heuristic; there is no certified strategic ranking.';
}
function play(ctx,i){
 const position=currentBoard(ctx);
 if(!position||position.done){st.notice='This local line is terminal or reached its six-ply exploration limit.';return;}
 const index=i===undefined?st.selected:i;
 if(index===null||index===undefined){st.notice='Select a point or pass explicitly.';return;}
 const r=ctx.k.legalMove(position.board,index,position.turn,position.ply);
 if(!r?.legal){inspect(ctx);st.notice='Original Renju legality rejected this hypothetical move. Nothing was added.';return;}
 st.steps.push({i:index,color:position.turn});st.selected=null;st.inspection='';
 st.notice='Added hypothetical '+(position.turn===1?'Black':'White')+' '+coord(index)+
   '. No opponent move was generated and no original server game was modified.';
}
function undo(){
 if(st.steps.length){st.steps.pop();st.selected=null;st.inspection='';st.notice='Last local move undone.';}
}
function reconstruction(ctx){
 const {m,k}=ctx,max=Math.min(4,m.moves.length-st.ply);
 if(max<=0)return '<p class="b10-muted">This source position is the final recorded board. Move earlier to reconstruct a continuation.</p>';
 const step=Math.max(0,Math.min(st.recallStep,max-1)),ply=st.ply+step,
   prefix=sourceFrame(m,k,ply);
 if(!prefix||prefix.result)return '<p class="b10-muted">The source sequence has ended.</p>';
 const actual=m.moves[ply];
 return '<div class="b10-box"><h4>Reconstruct the authentic continuation · '+(step+1)+' / '+max+'</h4>'+
  '<p>Recall the next <strong>'+esc(actual.color===1?'Black':'White')+'</strong> move from this verified game. Choose a coordinate below, or use Pass when the original move was a pass. This is historical recall, not tactical correctness.</p>'+
  boardHTML(prefix.board,'Recorded-position reconstruction',st.selected,ply?m.moves[ply-1]?.i:-2)+
  '<div class="b10-controls"><button class="btn" id="b10-compare" type="button" '+(st.selected===null?'disabled':'')+
   '>Compare selected point to record</button><button class="btn ghost" id="b10-pass-recall">Compare Pass to record</button>'+
   '<button class="btn ghost" id="b10-reveal-recall">Reveal actual move</button>'+
   '<button class="btn ghost" id="b10-next-recall" '+(!st.recallChecked||step>=max-1?'disabled':'')+'>Next recorded decision</button>'+
   '<button class="btn ghost" id="b10-restart-recall">Restart recall</button></div>'+
   (st.recallNotice?'<p class="b10-result" role="status">'+esc(st.recallNotice)+'</p>':'')+
   '<p class="b10-muted">After each step, the source board advances only along actual verified moves, not guesses. Memory recall comparisons are not skill grades or Elo adjustments.</p></div>';
}
function compareRecall(ctx,selected,reveal){
 const {m}=ctx,ply=st.ply+st.recallStep,actual=m.moves[ply];
 if(!actual)return;
 if(!reveal&&selected===null){st.notice='Choose a square or Pass.';return;}
 const accurate=!reveal&&selected===actual.i;
 const item=st.answers.get(ply)||{inspections:0,needsReview:false};
 item.inspections++;
 item.needsReview=!accurate;item.kind='recorded-recall';
 st.answers.set(ply,item);
 st.recallChecked=true;
 st.recallNotice='Recorded '+(actual.actor==='player'?'human':'bot')+' move: '+coord(actual.i)+'. '+
    (reveal?'The record was revealed without a recall attempt.':
     accurate?'Your selected coordinate matches the recorded move.':
     'Your selection was '+coord(selected)+', which differs from the historical record.')+
    ' This measures only that one recall comparison, not whether a different move would be strategically inferior.';
}
function recordedCompare(ctx){
 const {m}=ctx;
 const original=m.moves.slice(st.ply,Math.min(m.moves.length,st.ply+6));
 if(!original.length)return 'There is no recorded continuation from this final source ply.';
 const hypothetical=st.steps.map(x=>(x.color===1?'Black ':'White ')+coord(x.i)).join(' → ');
 return 'Original verified next moves: '+original.map(x=>x.actor+' '+coord(x.i)).join(' → ')+
  '. '+(hypothetical?'Your local what-if line: '+hypothetical+'. ':
     'Your local what-if line is empty. ')+
   'The original bot responses apply only to the ORIGINAL human choices, not to your imagined line.';
}
function ensure(){
 const parent=$('b8-review');if(!parent)return null;
 if(!$('b10-style')){const style=document.createElement('style');style.id='b10-style';style.textContent=CSS;document.head.append(style);}
 let node=$('b10-explore');if(node)return node;
 node=document.createElement('section');node.id='b10-explore';node.className='b10';
 node.hidden=true;node.setAttribute('aria-label','Native tactical exploration and recorded-decision reconstruction');
 node.innerHTML='<div class="b10-top"><div><h3>Explore & reconstruct</h3>'+
   '<p class="b10-muted">Original verified game · independent hypothetical choices · no generated bot replies</p></div></div><div id="b10-content"></div>';
 parent.append(node);return node;
}
function render(){
 const node=ensure();if(!node)return;
 const ctx=context();
 node.hidden=!ctx;if(!ctx)return;
 const el=$('b10-content');
 if(!ctx.k||!verify(ctx.m,ctx.k)){
   el.innerHTML='<p role="alert" class="b10-result">Verified match transcript or original native Renju kernel is unavailable. Exploration is disabled; no substitute analysis is shown.</p>';return;
 }
 if(!Number.isInteger(st.ply)||st.ply<0||st.ply>ctx.m.moves.length){
   el.innerHTML='<p class="b10-muted">Choose an original recorded position in the E8 replay to begin.</p>';return;
 }
 const focus=document.activeElement?.dataset?.b10Cell!==undefined,
       pos=st.tab==='explore'?currentBoard(ctx):null;
 const actual=ctx.m.moves[st.ply],humanCount=originalDecisions(ctx.m,ctx.k).length;
 let html='<p class="b10-muted">Source ply '+st.ply+' / '+ctx.m.moves.length+
   ' · '+esc(ctx.m.playerColor===1?'Played as Black':'Played as White')+
   ' · '+esc(ctx.m.botId)+' · '+esc(actual?'next recorded actor '+actual.actor:'last position')+
   '. E8 remains the authentic replay.</p>'+
   '<div class="b10-tabs" role="group" aria-label="Training approach">'+
   ['explore','recall','priorities'].map((tab,i)=>'<button type="button" data-b10-tab="'+tab+
   '" aria-pressed="'+(st.tab===tab)+'">'+['Explore hypothetical moves','Reconstruct actual record','Choose training priorities'][i]+'</button>').join('')+
   '</div>';
 if(st.tab==='explore'){
   if(!pos)html+='<p class="b10-result" role="alert">The original Renju kernel could not replay the local branch. Clear the branch to continue.</p>';
   else html+='<div class="b10-box"><h4>What-if sandbox · '+st.steps.length+' / 6 local plies</h4>'+
     '<p class="b10-muted">This is a disposable copy of the source position, never the real game board. You choose moves for BOTH colors; the bot does not respond to hypotheticals.</p>'+
     '<p><strong>'+esc(pos.done?'Local line complete':pos.turn===1?'Black to choose':'White to choose')+'</strong></p>'+
     boardHTML(pos.board,'Non-authoritative what-if',st.selected,pos.last)+
     '<div class="b10-controls"><button class="btn ghost" id="b10-inspect" '+(st.selected===null||pos.done?'disabled':'')+'>Inspect exact native facts</button>'+
     '<button class="btn" id="b10-play" '+(st.selected===null||pos.done?'disabled':'')+'>Add selected move</button>'+
     '<button class="btn ghost" id="b10-pass" '+(pos.done?'disabled':'')+'>Pass (if legal)</button>'+
     '<button class="btn ghost" id="b10-undo" '+(!st.steps.length?'disabled':'')+'>Undo local move</button>'+
     '<button class="btn ghost" id="b10-clear" '+(!st.steps.length?'disabled':'')+'>Reset to source</button></div>'+
     '<div class="b10-stats"><span>Source point '+st.ply+'</span><span>'+st.steps.length+' self-chosen local plies</span>'+
     '<span>No generated opponent reply</span></div>'+
     (st.inspection?'<p class="b10-result" role="status">'+esc(st.inspection)+'</p>':'')+
     (st.notice?'<p class="b10-muted" role="status">'+esc(st.notice)+'</p>':'')+
     '<div class="b10-controls"><button class="btn ghost" id="b10-show-record">Compare with original record</button>'+
     '<button class="btn ghost" id="b10-open-recall">Recall historical continuation instead</button></div>'+
     (st.showRecord?'<p class="b10-result">'+esc(recordedCompare(ctx))+'</p>':'')+
     '<p class="b10-muted">Move legality and immediate fives come from the original native Renju kernel. Four/three counts are shape heuristics, not proof of a forced multi-ply win.</p></div>';
 }else if(st.tab==='recall')html+=reconstruction(ctx);
 else {
   const entries=ordered(ctx.m,ctx.k);
   html+='<div class="b10-box"><h4>Select your training focus</h4>'+
    '<label>Priority <select id="b10-priority">'+CATEGORIES.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
    '<p class="b10-muted">These filters reflect native one-move facts and explicit personal choice. They do not label historical moves as good or bad.</p>'+
    '<div class="b10-stats"><span>'+humanCount+' authentic human decisions</span>'+
    '<span>'+st.answers.size+' comparisons this session</span><span>'+st.byPly.size+' restored source checkpoints (max 12)</span></div>'+
    '<div class="b10-list">'+(entries.length?entries.map(item=>{
      const count=st.answers.get(item.ply),caption=item.category==='win'?'Legal immediate five present':
       item.category==='defense'?'One-square direct block available':
       item.category==='opening'?'Black center-first rule':'Authentic independent decision';
      return '<button type="button" data-b10-focus="'+item.ply+'"><strong>Before ply '+(item.ply+1)+
       ' · '+esc(caption)+'</strong><span>'+
       esc(count?.needsReview?'Revisit a factual recall/one-move objective':
         count?'Inspected this session':'Not yet inspected')+'</span></button>';
    }).join(''):'<p class="b10-muted">No verified human decisions meet this filter in the loaded match.</p>')+
    '</div><p class="b10-muted">Open a checkpoint in the original E8/E9 replay, then return to this panel for independent what-if analysis or recorded recall. Priorities and choices live only in this browser session.</p></div>';
 }
 el.innerHTML=html;
 el.querySelectorAll('[data-b10-tab]').forEach(btn=>btn.onclick=()=>{
   st.tab=btn.dataset.b10Tab;st.selected=null;st.inspection='';st.notice='';st.focusCell=112;render();
 });
 if(st.tab==='priorities'){
   $('b10-priority').value=st.priority;
   $('b10-priority').onchange=e=>{st.priority=e.target.value;render();};
   el.querySelectorAll('[data-b10-focus]').forEach(btn=>btn.onclick=()=>focus(Number(btn.dataset.b10Focus),ctx.m));
   return;
 }
 const grid=$('b10-grid');
 if(grid){
   grid.addEventListener('click',e=>{
     const cell=e.target.closest('[data-b10-cell]');if(!cell)return;
     st.selected=Number(cell.dataset.b10Cell);st.focusCell=st.selected;
     st.inspection='';render();$('b10-grid')?.querySelector('[data-b10-cell="'+st.focusCell+'"]')?.focus({preventScroll:true});
   });
   grid.addEventListener('keydown',e=>{
     const button=e.target.closest('[data-b10-cell]');
     if(!button||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
     e.preventDefault();const i=Number(button.dataset.b10Cell),x=i%15,y=Math.floor(i/15);
     const dest=e.key==='ArrowLeft'?Math.max(0,x-1)+15*y:
       e.key==='ArrowRight'?Math.min(14,x+1)+15*y:
       e.key==='ArrowUp'?x+15*Math.max(0,y-1):
       e.key==='ArrowDown'?x+15*Math.min(14,y+1):
       e.key==='Home'?15*y:15*y+14;
     st.focusCell=dest;grid.querySelectorAll('[data-b10-cell]').forEach(b=>b.tabIndex=Number(b.dataset.b10Cell)===dest?0:-1);
     grid.querySelector('[data-b10-cell="'+dest+'"]')?.focus({preventScroll:true});
   });
 }
 if(st.tab==='explore'&&pos){
   $('b10-inspect').onclick=()=>{inspect(ctx);render();};
   $('b10-play').onclick=()=>{play(ctx);render();};
   $('b10-pass').onclick=()=>{play(ctx,-1);render();};
   $('b10-undo').onclick=()=>{undo();render();};
   $('b10-clear').onclick=()=>{st.steps=[];st.selected=null;st.inspection='';st.notice='Reset to the verified source position.';render();};
   $('b10-show-record').onclick=()=>{st.showRecord=!st.showRecord;render();};
   $('b10-open-recall').onclick=()=>{st.tab='recall';st.selected=null;render();};
 }
 if(st.tab==='recall'&&$('b10-compare')){
   $('b10-compare').onclick=()=>{compareRecall(ctx,st.selected,false);render();};
   $('b10-pass-recall').onclick=()=>{compareRecall(ctx,-1,false);render();};
   $('b10-reveal-recall').onclick=()=>{compareRecall(ctx,null,true);render();};
   $('b10-next-recall').onclick=()=>{if(st.recallChecked){
     st.recallStep++;st.recallChecked=false;st.recallNotice='';st.selected=null;render();
   }};
   $('b10-restart-recall').onclick=()=>{st.recallStep=0;st.recallChecked=false;st.recallNotice='';st.selected=null;render();};
 }
 if(focus)grid?.querySelector('[data-b10-cell="'+st.focusCell+'"]')?.focus({preventScroll:true});
}
window.addEventListener('gomoku:bot-e8-position',render);
window.addEventListener('gomoku:bot-training-data-updated',render);
window.addEventListener('gomoku:bot-workspace-opened',render);
window.addEventListener('gomoku:bot-match-updated',()=>{if(st.matchId)render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.GomokuBotExplorationE10=Object.freeze({version:'e10.1',render,readOnlyState:()=>{
 const ctx=context();
 return Object.freeze({active:!!ctx&&!!ctx.k,ownerScoped:!!ctx,matchId:ctx?.m.id||null,
  verifiedSourcePly:ctx?.v.ply??null,localPlies:st.steps.length,
  visibleSourceSnapshots:st.byPly.size,sessionComparisons:st.answers.size,
  newGameWriter:false,ratingWriter:false,persistentMastery:false});
}});
})();