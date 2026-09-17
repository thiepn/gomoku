/* Personal mistake rehearsal. Separate board and transactional progress;
 * never imports a training position into the live match. */
if(typeof window!=='undefined') (()=>{
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const side=c=>c===1?'Black':'White',coord=i=>i<0?'Pass':'ABCDEFGHJKLMNOP'[i%15]+(15-Math.floor(i/15));
 let dialog=null,S=null,A=null,epoch=0,opener=null,restore=null;
 const token=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 function note(text){if($('a2TrainingFeedback'))$('a2TrainingFeedback').textContent=text;}
 function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function ensure(){
   if(dialog)return;A=createAnalysis2(createEngine,createStudioCore,createGuidedReviewCore);
   dialog=document.createElement('dialog');dialog.id='a2Trainer';dialog.setAttribute('aria-labelledby','a2TrainingTitle');
   dialog.innerHTML=`<div class="gr-shell"><header class="gr-header"><div><p class="gr-kicker">ANALYSIS 2.0 / PERSONAL PRACTICE</p><h2 id="a2TrainingTitle">Your mistake library</h2><p id="a2TrainingMeta"></p></div><button type="button" id="a2TrainingClose" class="gr-btn gr-close">Close ×</button></header><div class="gr-content"><section class="gr-board-column"><div class="gr-board-heading"><div><span class="gr-kicker" id="a2TrainingMode">RECALL, NOT REPLAY</span><h3 id="a2Question">Choose a position to practise</h3></div></div><div id="a2TrainingBoardWrap" class="gr-board-wrap"><div class="gr-top-coords" aria-hidden="true">${[...'ABCDEFGHJKLMNOP'].map(c=>`<span>${c}</span>`).join('')}</div><div class="gr-side-coords" aria-hidden="true">${Array.from({length:15},(_,i)=>`<span>${15-i}</span>`).join('')}</div><div id="a2TrainingBoard" class="gr-board" role="grid" aria-label="Mistake training board" aria-rowcount="15" aria-colcount="15"></div></div><p class="gr-board-help" id="a2TrainingHelp">The answer stays hidden until you try. Any independently supported alternative can count.</p><div class="gr-feedback" id="a2TrainingFeedback" role="status" aria-live="polite"></div><nav class="gr-navigation" aria-label="Training queue"><button type="button" class="gr-btn" id="a2TrainingPrev">← Previous</button><span id="a2TrainingCounter"></span><button type="button" class="gr-btn gr-primary" id="a2TrainingNext">Next position →</button></nav></section><section class="gr-inspector"><div class="gr-section-head"><h3 id="a2TrainingVerdict">Learn from your own decisions</h3><button class="gr-link" type="button" id="a2TrainingReset">Try another move</button></div><p id="a2TrainingWhy">Mistakes found during game review are saved here on this device. Review a game to build your personal practice set.</p><div class="gr-action-row a2-training-actions"><button class="gr-btn" type="button" id="a2TrainingHint">Get a hint</button><button class="gr-btn" type="button" id="a2TrainingSolution">Show solution</button><button class="gr-btn" type="button" id="a2TrainingDeepen">Recheck deeper</button></div><p class="gr-muted" id="a2TrainingSchedule"></p><details class="gr-details"><summary>How practice is assessed</summary><p>Every position and attempt is analyzed with the current engine. Equivalent winning moves and supported alternatives count. Unresolved attempts do not advance your schedule. Hints and solutions are recorded as assisted. Only the first resolved attempt per position in this session updates recall history.</p><p>Successful unassisted recalls are suggested again after 1, 3, 7, 14, 30 and 60 days. A miss is due again after 10 minutes. These are practice intervals, not a claim of an optimal memory model. You can practise any saved position at any time.</p></details><section class="gr-record"><div class="gr-section-head"><h4>Saved positions</h4><select id="a2TrainingFilter" aria-label="Filter mistake library"><option value="all">All positions</option><option value="due">Due now</option><option value="game">This game</option></select></div><div id="a2TrainingList" class="a2-library-list"></div></section><div class="a2-library-actions"><button class="gr-link" id="a2TrainingExport" type="button">Export library</button><label class="gr-link a2-import">Import library<input id="a2TrainingImport" type="file" accept="application/json,.json"></label><button class="gr-link" id="a2TrainingRemove" type="button">Remove this position</button></div><p class="gr-muted" id="a2TrainingStorage"></p></section></div><footer class="gr-footer"><span>Practice never changes your recorded game. Escape returns safely.</span><span id="a2RecallTotals"></span></footer></div>`;
   document.body.append(dialog);
   for(let row=0;row<15;row++){const line=document.createElement('div');line.className='gr-board-row';line.setAttribute('role','row');for(let col=0;col<15;col++){const i=row*15+col,b=document.createElement('button');b.type='button';b.className='gr-cell';b.dataset.a2Point=i;b.setAttribute('role','gridcell');b.setAttribute('aria-rowindex',row+1);b.setAttribute('aria-colindex',col+1);b.tabIndex=i===112?0:-1;b.innerHTML='<span class="gr-stone"></span><span class="gr-point-mark"></span>';line.append(b);} $('a2TrainingBoard').append(line);}
   $('a2TrainingClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
   $('a2TrainingFilter').onchange=()=>{S.filter=$('a2TrainingFilter').value;renderList();};
   $('a2TrainingPrev').onclick=()=>selectIndex(Math.max(0,S.index-1));$('a2TrainingNext').onclick=()=>selectIndex((S.index+1)%S.queue.length);
   $('a2TrainingReset').onclick=()=>{if(!S?.card)return;epoch++;window.GomokuAnalysisRuntime.cancel();S.busy=false;S.attempt=null;S.preview=null;render();note('Try a different move. This does not create another scored recall in the same session.');};
   $('a2TrainingHint').onclick=hint;$('a2TrainingSolution').onclick=solution;$('a2TrainingDeepen').onclick=()=>{if(S?.attempt)attempt(S.attempt.i,2400);else if(S?.card)checkReference(2400);};
   $('a2TrainingExport').onclick=async()=>{try{download(await GomokuMistakes.exportData(),'gomoku-mistake-library.json');note('Library exported with your practice history.');}catch(e){note(e.message);}};
   $('a2TrainingImport').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>14000000)throw Error('Import limit: 14 MB.');const n=await GomokuMistakes.importData(JSON.parse(await f.text()));await refresh();note(`Imported ${n} validated positions. Existing local recall history was preserved.`);}catch(e){note('Import rejected: '+e.message);}finally{ev.target.value='';}};
   $('a2TrainingRemove').onclick=async()=>{if(!S?.card)return;try{const id=S.card.id;epoch++;GomokuAnalysisRuntime.cancel();const current=S;await GomokuMistakes.remove(id);if(S!==current)return;S.card=null;S.attempt=null;S.busy=false;await refresh();note('Position removed from the practice library. Your original game is unchanged.');}catch(e){note(e.message);}};
   dialog.addEventListener('click',ev=>{const p=ev.target.closest('[data-a2-point]');if(p){attempt(Number(p.dataset.a2Point));return;}const c=ev.target.closest('[data-a2-card]');if(c){const id=c.dataset.a2Card;if(!S.queue.some(x=>x.id===id))S.queue=S.items.slice();selectIndex(S.queue.findIndex(x=>x.id===id));}});
   dialog.addEventListener('keydown',ev=>{const cell=ev.target.closest('[data-a2-point]');if(!cell||ev.altKey||ev.ctrlKey||ev.metaKey)return;let i=Number(cell.dataset.a2Point),j=i;if(ev.key==='ArrowLeft')j=i%15?i-1:i;else if(ev.key==='ArrowRight')j=i%15<14?i+1:i;else if(ev.key==='ArrowUp')j=Math.max(0,i-15);else if(ev.key==='ArrowDown')j=Math.min(224,i+15);else if(ev.key==='Home')j=i-i%15;else if(ev.key==='End')j=i-i%15+14;else return;ev.preventDefault();cell.tabIndex=-1;const n=dialog.querySelector(`[data-a2-point="${j}"]`);n.tabIndex=0;n.focus();});
 }
 async function refresh(){
   if(!S)return;const current=S,items=await GomokuMistakes.list();if(S!==current)return;S.items=items.sort((a,b)=>(a.stats.due||0)-(b.stats.due||0)||b.updated-a.updated);
   S.queue=S.ids?.length?S.items.filter(c=>S.ids.includes(c.id)):S.items.slice();
   if(S.card){const latest=S.items.find(c=>c.id===S.card.id);if(latest)S.card={...S.card,stats:latest.stats,events:latest.events};}
   render();
 }
 function renderList(){
   if(!S)return;const rows=S.items.filter(c=>S.filter==='due'?c.stats.due<=Date.now():S.filter==='game'?S.ids?.includes(c.id):true);
   $('a2TrainingList').innerHTML=rows.length?rows.map(c=>`<button type="button" class="a2-library-card" data-a2-card="${esc(c.id)}" aria-current="${S.card?.id===c.id?'true':'false'}"><span><b>Move ${c.source.ply} · ${side(c.color)}</b><small>${esc(c.source.title)} · ${esc(c.rule)}</small></span><span>${c.stats.due<=Date.now()?'Due now':new Date(c.stats.due).toLocaleDateString()}<small>${c.stats.successes||0} successful recall${c.stats.successes===1?'':'s'}</small></span></button>`).join(''):'<p class="gr-muted">No positions in this filter. All saved positions remain available without a time gate.</p>';
 }
 function render(){
   if(!S||!dialog.open)return;const c=S.card,at=S.attempt;
   $('a2TrainingTitle').textContent=c?'Mistake training':'Your mistake library';
   $('a2TrainingMeta').textContent=`${S.items.length} saved · ${S.items.filter(x=>x.stats.due<=Date.now()).length} due now · ${GomokuMistakes.status().persistent?'Stored on this device':'Tab-only storage'}`;
   $('a2Question').textContent=c?`${side(c.color)} to play · original move ${c.source.ply}`:'Choose a saved position below';
   const board=c?c.board.slice():new Array(225).fill(0);const i=S.preview??at?.i;if(c&&Number.isInteger(i))board[i]=c.color;
   for(const b of $('a2TrainingBoard').querySelectorAll('[data-a2-point]')){const j=Number(b.dataset.a2Point);b.dataset.stone=board[j];b.classList.toggle('gr-last',j===i&&!!board[j]);b.querySelector('.gr-stone').textContent=j===i?'•':'';b.setAttribute('aria-label',`${coord(j)}, ${board[j]?side(board[j])+' stone':'empty'}`);b.setAttribute('aria-disabled',String(!c||!!c.board[j]||S.busy));}
   $('a2TrainingCounter').textContent=c?`${S.index+1} / ${S.queue.length}`:'0 / 0';
   $('a2TrainingVerdict').textContent=S.busy?'Analyzing…':at?.verdict?({correct:'Supported solution',incorrect:'Look for a stronger move',unresolved:'More evidence needed'}[at.verdict.status]):c?'Find your move':'Learn from your own decisions';
   $('a2TrainingWhy').textContent=at?.result?at.result.explanation.why:c?'No answer markers or candidate moves are shown. Look for a win, a mandatory block, then forcing threats.':'Review a game to save your first personal practice positions. Nothing here is invented or based on a sample game.';
   $('a2TrainingSchedule').textContent=c?`${c.stats.attempts} scored attempt${c.stats.attempts===1?'':'s'} · ${c.stats.successes} successful recalls · ${c.stats.assisted} assisted · ${c.stats.lapses} misses. ${S.assisted?'This attempt is assisted.':''}`:'';
   for(const id of ['a2TrainingPrev','a2TrainingNext','a2TrainingReset','a2TrainingHint','a2TrainingSolution','a2TrainingDeepen','a2TrainingRemove'])$(id).disabled=!c||S.busy;
   $('a2TrainingHint').textContent=S.hints?'Another hint':'Get a hint';
   const status=GomokuMistakes.status();$('a2TrainingStorage').textContent=status.persistent?'Private local library · export it to move to another browser or device.':`Storage unavailable: this library is kept only in this tab. Export before closing. ${status.error||''}`;
   $('a2RecallTotals').textContent=`${S.items.reduce((n,x)=>n+(x.stats.successes||0),0)} successful recalls`;
   renderList();
 }
 async function selectIndex(index){
   if(!S||index<0||index>=S.queue.length)return;
   epoch++;GomokuAnalysisRuntime.cancel();S.index=index;S.card=S.queue[index];S.attempt=null;S.preview=null;S.hints=0;S.assisted=false;S.reference=null;S.busy=false;
   render();note('Checking the saved position with the current analysis engine…');await checkReference(1000);
 }
 async function checkReference(budget){
   if(!S?.card)return;const s=S,c=s.card,id=++epoch;s.busy=true;render();
   try{const r=await GomokuAnalysisRuntime.request(c.board,c.color,c.rule,c.played,{preset:budget>1000?'deep':'standard',timeMs:budget,context:c.context});if(S!==s||epoch!==id)return;s.reference=r;note(A.trainable(r)?'Position checked. Choose your move; the answer is still hidden.':'Reanalysis no longer confirms the saved mistake. This position is for exploration; deepen the reference search or remove it. Recall history will not change.');}
   catch(e){if(S===s&&epoch===id&&e.name!=='AbortError')note('Analysis unavailable: '+e.message+' Use Recheck deeper to retry.');}
   finally{if(S===s&&epoch===id){s.busy=false;render();}}
 }
 async function attempt(i,budget=1000){
   if(!S?.card||S.busy)return;const s=S,c=s.card;if(!s.reference){note('Recheck this saved position before scoring an attempt.');return;}
   const legal=A.legal(c.board,c.color,c.rule,i,c.context);if(!legal.legal){note('Illegal move: '+legal.reason);return;}
   const id=++epoch;s.busy=true;s.preview=null;s.attempt={i,result:null,verdict:null};render();note(`Checking ${coord(i)} and the strongest alternatives…`);
   try{
     const r=await GomokuAnalysisRuntime.request(c.board,c.color,c.rule,i,{preset:budget>1000?'deep':'standard',timeMs:budget,context:c.context});if(S!==s||epoch!==id)return;
     const verdict=A.attemptVerdict(r,s.reference,s.assisted);s.attempt={i,result:r,verdict};
     await GomokuMistakes.record(c.id,verdict,`${s.runId}:${c.id}`);if(S!==s||epoch!==id)return;
     await refresh();note(verdict.message+(verdict.status!=='unresolved'?' Recall history saved.':''));
   }catch(e){if(S===s&&epoch===id&&e.name!=='AbortError')note('The attempt was not recorded: '+e.message);}
   finally{if(S===s&&epoch===id){s.busy=false;render();}}
 }
 function hint(){
   if(!S?.card||S.busy)return;S.assisted=true;S.hints++;const r=S.reference;
   note(S.hints===1?'Scan both colors for a move that completes five. Deal with immediate danger before improving a shape.':S.hints===2?r?.explanation?.lesson||'Compare forcing threats and legal extensions.':r?.bestShape?.fours?.length?'Look for a move that creates a four with a legal finishing point.':r?.bestShape?.threes?.length?'Look for a genuine three that can legally extend to a straight four.':'Look for connected, unblocked five-cell lines; compare them with the opponent’s threats.');render();
 }
 async function solution(){
   if(!S?.card||S.busy)return;S.assisted=true;
   if(!S.reference)await checkReference(1000);
   if(!S?.reference||S.busy)return;const best=S.reference.best;if(!Number.isInteger(best)||best<0){note('No legal suggestion established; recheck deeper.');return;}
   await attempt(best,1000);
 }
 async function open(options={}){
   if(dialog?.open)return;
   const api=window.GomokuStudio;if(!api)return;
   try{
     opener=document.activeElement;
     if($('grDialog')?.open){GomokuReview.pause();restore=null;}
     else{const p=api.prepareGuidedReview?.();restore=p?()=>api.finishGuidedReview?.(!p.wasReviewing):null;}
     ensure();S={items:[],queue:[],ids:options.ids||null,index:-1,card:null,reference:null,attempt:null,busy:false,hints:0,assisted:false,preview:null,filter:options.ids?.length?'game':'all',runId:token()};
     dialog.showModal();$('a2TrainingFilter').value=S.filter;await refresh();if(!S||!dialog.open)return;note('Choose a saved position. Due dates are suggestions, never locks.');$('a2TrainingClose').focus();
     if(S.queue.length)await selectIndex(0);
   }catch(e){restore?.();restore=null;console.error('Mistake training:',e);if(dialog?.open)note('Could not open practice: '+e.message);else{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Finish the current move before opening mistake training: '+e.message;document.body.append(p);setTimeout(()=>p.remove(),7000);}}
 }
 function close(){epoch++;GomokuAnalysisRuntime.release();S=null;dialog?.close();restore?.();restore=null;opener?.focus?.();}
 function mount(){const host=document.querySelector('#uiLearning .ui-learning-actions');if(!host){setTimeout(mount,200);return;}if($('a2OpenTraining'))return;const b=document.createElement('button');b.type='button';b.id='a2OpenTraining';b.innerHTML='<span aria-hidden="true">↺</span><span><b>Your mistakes</b><small>Recall your own key positions</small></span><span aria-hidden="true">→</span>';b.onclick=()=>open();host.append(b);}
 window.GomokuTraining=Object.freeze({open,close,selectIndex,attempt,hint,solution,state:()=>S?JSON.parse(JSON.stringify({index:S.index,card:S.card,attempt:S.attempt,busy:S.busy,assisted:S.assisted,hints:S.hints,queueLength:S.queue.length})):null});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&S?.busy){epoch++;GomokuAnalysisRuntime.cancel();S.busy=false;render();note('Analysis paused while this tab is hidden. Recheck the position when you return.');}});
 mount();
})();
