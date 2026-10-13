/* Bot Elo E7 — evidence-derived practice progress and training in the existing E2/E5 workspace.
 * Display-only derivations from authenticated E2 matches and original E4 ledger.
 * Never scores a board, persists mastery, awards achievements or calculates Elo.
 */
(function(){
'use strict';
if(window.GomokuBotTrainingE7)return;
const E=window.GomokuBotEloE1;
if(!E)return;
const $=id=>document.getElementById(id);
const source=()=>window.GomokuBotWorkspaceE5?.e7SourceSnapshot?.();
const rating=()=>window.GomokuBotRatingAccountE4?.snapshot?.();
const game=()=>window.GomokuTrustedBotE2;
const account=()=>window.GomokuCompetitionBridge?.account?.();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bot=id=>E.getBot(id);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATCH_LIMIT=30,EVENT_LIMIT=50;
const nativeIds=E.BOTS.map(b=>b.id);
let selectedFilter='review',lastOwner=null,notice='';
function outcome(m){
 if(m.result?.winner===0)return 'draw';
 return m.result?.winner===m.playerColor?'win':'loss';
}
function time(m){
 const t=Date.parse(m.completedAt||m.startedAt||'');
 return Number.isFinite(t)?t:0;
}
function verifiedMatch(m){
 return m&&typeof m==='object'&&m.ownerVerified===true&&m.integrity?.serverAuthoritative===true&&
   m.integrity?.verifiedRules===true&&UUID.test(String(m.id||''))&&
   nativeIds.includes(m.botId)&&[1,2].includes(m.playerColor)&&
   ['completed','resigned'].includes(m.status)&&m.result&&
   [0,1,2].includes(m.result.winner)&&Array.isArray(m.moves)&&
   (m.status!=='resigned'||m.result.winner===3-m.playerColor);
}
function summarize(matches,events){
 const seen=new Set(),finished=[];
 for(const m of (Array.isArray(matches)?matches:[])){
   if(!verifiedMatch(m)||seen.has(m.id))continue;
   seen.add(m.id);finished.push({...m,outcome:outcome(m)});
 }
 finished.sort((a,b)=>time(b)-time(a)||String(b.id).localeCompare(String(a.id)));
 const wins=finished.filter(m=>m.outcome==='win'),draws=finished.filter(m=>m.outcome==='draw');
 const losses=finished.filter(m=>m.outcome==='loss');
 const byBot=E.BOTS.map(b=>{
   const ms=finished.filter(m=>m.botId===b.id);
   return {id:b.id,label:b.label,order:b.order,played:ms.length,
     wins:ms.filter(m=>m.outcome==='win').length,draws:ms.filter(m=>m.outcome==='draw').length,
     losses:ms.filter(m=>m.outcome==='loss').length};
 });
 const distinct=byBot.filter(x=>x.played).length;
 const colors=new Set(finished.map(m=>m.playerColor));
 const milestones=[
   {id:'first',label:'Finish a verified bot game',done:finished.length>=1,detail:finished.length+' observed'},
   {id:'five',label:'Complete five verified games',done:finished.length>=5,detail:Math.min(finished.length,5)+' / 5'},
   {id:'both',label:'Play both stone colors',done:colors.size===2,detail:colors.size+' / 2 colors'},
   {id:'variety',label:'Face three different native opponents',done:distinct>=3,detail:Math.min(distinct,3)+' / 3'},
   {id:'win',label:'Record a verified game win',done:wins.length>=1,detail:wins.length+' observed'},
   {id:'multiwin',label:'Win against two different opponents',done:new Set(wins.map(m=>m.botId)).size>=2,
     detail:new Set(wins.map(m=>m.botId)).size+' / 2 opponents'},
   {id:'ten',label:'Complete ten verified games',done:finished.length>=10,detail:Math.min(finished.length,10)+' / 10'}
 ];
 // Existing E4 owner-scoped ledger is the only rating source. No derived Elo entries.
 const ledger=(Array.isArray(events)?events:[]).filter(e=>e&&UUID.test(String(e.matchId||''))&&
   Number.isInteger(e.gameNumber)&&e.gameNumber>0&&
   Number.isFinite(e.ratingBefore)&&Number.isFinite(e.ratingAfter)&&Number.isFinite(e.delta));
 ledger.sort((a,b)=>a.gameNumber-b.gameNumber);
 const oldest=ledger[0],newest=ledger[ledger.length-1];
 const trajectory=oldest&&newest?{events:ledger.length,first:oldest.ratingBefore,
   current:newest.ratingAfter,net:newest.ratingAfter-oldest.ratingBefore,
   latestGame:newest.gameNumber,lastDelta:newest.delta}:null;
 const latest=finished[0]||null,recent=finished.slice(0,6);
 // Recommendation is practice sequencing, not an AI-estimated skill level.
 let proposed=bot('first'),reason='Start with the native Beginner bot to establish a verified practice record.';
 if(latest){
   const index=nativeIds.indexOf(latest.botId);
   const sameLastTwo=finished.length>1&&finished[1].botId===latest.botId&&
     finished[1].outcome==='win'&&latest.outcome==='win';
   if(sameLastTwo&&index<nativeIds.length-1){
     proposed=bot(nativeIds[index+1]);
     reason='Two consecutive recorded wins against the same opponent: try the next native difficulty. This is not a measured rating.';
   }else{
     proposed=bot(latest.botId);
     reason=latest.outcome==='loss'?'Repeat the opponent from the latest recorded loss; review that game before trying again.':
       latest.outcome==='draw'?'Repeat the latest drawn opponent and compare decisions in the verified board.':
       'Consolidate this difficulty with another game; two consecutive wins against it suggest a harder practice opponent.';
   }
 }
 const focus=losses.length?
   'Review a recent loss before the next game. Use the recorded board; no engine judgment has been performed.':
   finished.length&&!colors.has(1)?'Try a game as Black for opening-color variety.':
   finished.length&&!colors.has(2)?'Try a game as White for opening-color variety.':
   finished.length?'Review one recorded decision, then play a new independent game.':
     'Play one completed verified game to unlock evidence-based practice guidance.';
 const reviews=[...finished.filter(m=>m.outcome!=='win'),...finished.filter(m=>m.outcome==='win')].slice(0,5);
 return Object.freeze({finished,wins:wins.length,draws:draws.length,losses:losses.length,
   byBot,milestones,proposed,reason,focus,reviews,trajectory,recent,
   observedGames:finished.length,distinct,completedGoals:milestones.filter(x=>x.done).length});
}
function renderRate(traj,loaded){
 if(!loaded)return '<p class="b7-muted">Verified Bot Elo ledger unavailable. No rating trend is inferred.</p>';
 if(!traj)return '<p class="b7-muted">No server-settled Bot Elo events in the loaded ledger. Practice results never change Elo.</p>';
 const n=traj.net,sign=n>0?'+':'',delta=traj.lastDelta>0?'+':'';
 return '<p><strong>'+esc(traj.events)+'</strong> verified settled events loaded · '+
   '<strong>'+esc(traj.first.toFixed(1))+' → '+esc(traj.current.toFixed(1))+'</strong> ('+
   esc(sign+n.toFixed(1))+') · latest settled change '+esc(delta+traj.lastDelta.toFixed(1))+
   ' at rated game '+esc(traj.latestGame)+'.</p>'+
   '<p class="b7-muted">Based on up to '+EVENT_LIMIT+' most recent owner-authorized ledger events, not a simulated or lifetime chart. Full chart remains in Verified matches.</p>';
}
const styles=[
 '.b7{border-top:1px solid var(--hair,#999);margin:12px 0;padding-top:12px;color:var(--ink,#222);font-size:12px;line-height:1.5}',
 '.b7 h3{font-size:14px;margin:0 0 4px}.b7 h4{font-size:12px;margin:13px 0 6px}',
 '.b7-muted{font-size:11px;color:var(--ink2,#596471);margin:5px 0;line-height:1.5}',
 '.b7-head{display:flex;gap:9px;align-items:start;justify-content:space-between;flex-wrap:wrap}',
 '.b7-stat{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:11px 0}',
 '.b7-stat div{padding:7px;border:1px solid var(--hair,#999);background:var(--card2,#eee);min-width:0}',
 '.b7-stat strong{display:block;font-size:15px;font-variant-numeric:tabular-nums}.b7-stat span{font-size:10px;color:var(--ink2,#596471)}',
 '.b7-plan{border:1px solid var(--hair,#999);padding:10px;margin:10px 0}',
 '.b7-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.b7-actions button{min-height:40px;font-size:11px}',
 '.b7 details{border-top:1px solid var(--hair,#bbb);margin:10px 0 0;padding-top:9px}',
 '.b7 summary{font-weight:700;cursor:pointer;min-height:32px}.b7 ol,.b7 ul{padding-left:20px;margin:7px 0}',
 '.b7 li{padding:6px 0;border-bottom:1px solid var(--hair,#ddd)}',
 '.b7-goal{display:flex;gap:7px;justify-content:space-between;align-items:start}',
 '.b7-goal em{font-style:normal;color:var(--ink2,#596471);font-size:10px;white-space:nowrap}',
 '.b7-table{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0}',
 '.b7-level{border:1px solid var(--hair,#aaa);padding:9px;text-align:left;background:var(--card2,#eee);border-radius:2px;min-height:54px}',
 '.b7-level strong{display:block;font-size:12px}.b7-level small{display:block;font-size:10px;line-height:1.4}',
 '.b7-level:focus-visible,.b7 button:focus-visible,.b7 select:focus-visible{outline:3px solid var(--seal,#315c58);outline-offset:2px}',
 '.b7-queue-head{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap}',
 '.b7-queue-head select{min-height:38px;max-width:190px}',
 '.b7-review-row{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}',
 '.b7-review-row button{min-height:38px;font-size:11px}',
 '.b7-result{font-weight:700}.b7-status{margin:6px 0}',
 '@media(max-width:480px){.b7-stat{grid-template-columns:repeat(2,minmax(0,1fr))}.b7-table{grid-template-columns:1fr}.b7-actions button{flex:1}}'
].join('');
function ensure(){
 const hub=$('b5-hub');if(!hub)return null;
 if(!$('b7-style')){const style=document.createElement('style');style.id='b7-style';style.textContent=styles;document.head.append(style);}
 let panel=$('b7-training');
 if(panel)return panel;
 panel=document.createElement('section');panel.id='b7-training';panel.className='b7';
 panel.setAttribute('aria-label','Verified bot practice progression and training');
 panel.innerHTML='<div class="b7-head"><div><h3>Practice progression & training</h3>'+
  '<p class="b7-muted">Evidence from signed-in server matches only. Milestones are informal observations, not rewards, ranks or mastery.</p></div></div>'+
  '<div id="b7-content" aria-live="polite"></div>';
 const target=$('b5-selection');
 if(target)target.before(panel);else hub.append(panel);
 return panel;
}
function reviewPrompt(m){
 if(m.status==='resigned')return 'Resignation: inspect what led you to stop and compare earlier choices.';
 if(m.result?.reason==='passes')return 'Passed game: examine the positions before the final passes.';
 if(m.outcome==='loss')return 'Loss: choose a decision to inspect. No move quality or tactical cause is asserted.';
 if(m.outcome==='draw')return 'Draw: revisit a contested position, then replay the opening.';
 return 'Win: identify one decision worth testing against a different reply.';
}
function reviewMarkup(m){
 const name=bot(m.botId)?.label||m.botId;
 return '<li><div class="b7-review-row"><span><strong class="b7-result">'+esc(m.outcome.toUpperCase())+
   '</strong> · '+esc(name)+' · '+esc(m.playerColor===1?'Black':'White')+
   ' · '+esc(m.moves.length)+' recorded plies'+
   '<span class="b7-muted" style="display:block">'+esc(reviewPrompt(m))+'</span></span>'+
   '<button class="btn ghost" type="button" data-b7-board="'+esc(m.id)+'">View verified board</button></div></li>';
}
function render(){
 const p=ensure();if(!p)return;
 const s=source(),user=account(),owner=user?.connected===true?String(user.userId||''):null;
 if(lastOwner!==owner){lastOwner=owner;notice='';selectedFilter='review';}
 const root=$('b7-content');
 if(!owner||!s?.ownerVerified||s.ownerKey!==owner){
   root.innerHTML='<p class="b7-muted" role="status">'+(!owner?
     'Connect THIEPN Account to use your owner-private verified practice history. Offline games and illustrative sample ratings are excluded.':
     'Verified match history is not available yet. Refresh account and matches above. No progress is inferred from missing data.')+'</p>';
   return;
 }
 const snap=rating(),verifiedLedger=snap?.loaded===true&&snap.connected===true,
   analysis=summarize(s.matches,verifiedLedger?snap.events:[]);
 const limited=s.matches.length>=MATCH_LIMIT;
 const current=s.currentMatch?.status==='active';
 let html='<div class="b7-stat" aria-label="Recent verified match statistics">'+
   [['Completed',analysis.observedGames],['Wins',analysis.wins],['Draws',analysis.draws],['Losses',analysis.losses]]
   .map(([label,count])=>'<div><span>'+esc(label)+'</span><strong>'+esc(count)+'</strong></div>').join('')+'</div>'+
   '<p class="b7-muted">These counts use only completed or resigned server-verified games from the latest '+
   esc(s.matches.length)+' matches returned (API limit '+MATCH_LIMIT+').'+
   (limited?' Older games are excluded; these are not career totals.':' No unsupported historical totals are assumed.')+'</p>'+
   '<div class="b7-plan"><strong>Next practice session</strong><p>'+esc(analysis.focus)+'</p>'+
   '<p><strong>Suggested opponent:</strong> '+esc(analysis.proposed?.label||'Beginner')+
   ' · '+esc(analysis.reason)+'</p>'+
   (current?'<p class="b7-muted">An active verified match is open. Complete or close it before changing opponents.</p>':'')+
   '<div class="b7-actions"><button class="btn" type="button" id="b7-select" '+
   (current?'disabled':'')+'>Select suggested opponent</button>'+
   (analysis.reviews.length?'<button class="btn ghost" type="button" id="b7-review-latest">Review a recorded game</button>':'')+'</div></div>'+
   '<details id="b7-goals"><summary>Observed milestones · '+analysis.completedGoals+'/'+analysis.milestones.length+
   ' in loaded history</summary><ol>'+
   analysis.milestones.map(x=>'<li class="b7-goal"><span>'+esc(x.done?'Observed: ':'Not yet observed: ')+
     esc(x.label)+'</span><em>'+esc(x.detail)+'</em></li>').join('')+
   '</ol><p class="b7-muted">Derived when viewing from the current owner’s latest server results. No achievement is saved or awarded; older history outside the window may change this view.</p></details>'+
   '<details id="b7-ladder"><summary>Native opponent practice ladder · eight original levels</summary>'+
   '<div class="b7-table">'+analysis.byBot.map(x=>'<button class="b7-level" type="button" data-b7-bot="'+esc(x.id)+'"'+(current?' disabled':'')+
   '><strong>'+esc(x.order)+'. '+esc(x.label)+'</strong><small>'+esc(x.played)+' games · '+
   esc(x.wins)+' W / '+esc(x.draws)+' D / '+esc(x.losses)+' L in loaded history</small></button>').join('')+
   '</div><p class="b7-muted">Native level order, not measured Elo or a proficiency ladder. Choosing a bot never starts a match or changes a score.</p></details>'+
   '<details id="b7-review" open><summary>Evidence-based board review</summary>'+
   '<div class="b7-queue-head"><p class="b7-muted">Choose a server record; prompts do not evaluate move quality.</p>'+
   '<label>Show <select id="b7-filter"><option value="review">Review losses & draws</option><option value="all">All games</option><option value="wins">Wins</option></select></label></div>';
 const entries=selectedFilter==='wins'?analysis.finished.filter(m=>m.outcome==='win'):
    selectedFilter==='all'?analysis.finished:analysis.finished.filter(m=>m.outcome!=='win');
 html+='<ol id="b7-review-rows">'+(entries.length?entries.slice(0,6).map(reviewMarkup).join(''):
   '<li>No matching verified records in the loaded history. Change the filter to view other results.</li>')+'</ol>'+
   '<p class="b7-muted">View board uses the original E2 owner-authorized match loader. It does not create a lesson grade, replay engine or analysis verdict.</p></details>'+
   '<details id="b7-trajectory"><summary>Actual settled rating trajectory</summary>'+
   renderRate(analysis.trajectory,verifiedLedger)+'</details>'+
   '<p class="b7-muted b7-status" id="b7-notice" role="status">'+esc(notice)+'</p>'+
   '<p class="b7-muted">'+(s.releaseActive?
      'An approved rated release is reported active. Server admission and E4 ledger alone determine actual rated outcomes.':
      'Bot Elo remains uncalibrated or inactive here. All suggestions are for practice only; no points or proficiency claims.')+'</p>';
 root.innerHTML=html;
 $('b7-filter').value=selectedFilter;
 $('b7-filter').onchange=e=>{selectedFilter=e.target.value;render();};
 $('b7-select').onclick=()=>choose(analysis.proposed?.id);
 $('b7-review-latest')?.addEventListener('click',()=>view(analysis.reviews[0]?.id));
 root.querySelectorAll('[data-b7-bot]').forEach(button=>{
   button.onclick=()=>choose(button.dataset.b7Bot);
 });
 root.querySelectorAll('[data-b7-board]').forEach(button=>{
   button.onclick=()=>view(button.dataset.b7Board);
 });
}
function choose(id){
 if(!bot(id))return;
 if(game()?.selectBot?.(id)){
   notice='Selected '+bot(id).label+'. Set your color above, then start a verified game when ready.';
 }else notice='Could not change opponents while a verified match remains active.';
 render();
}
async function view(id){
 const s=source();
 if(!s?.ownerVerified||!s.matches.some(m=>verifiedMatch(m)&&m.id===id))return;
 notice='Opening the original owner-authorized verified board…';render();
 try{
   await game()?.loadMatch?.(id);
   if(source()?.ownerKey!==account()?.userId){notice='Account changed. The previous private board is no longer available.';render();return;}
   notice='Board loaded. Review the recorded positions using the original match view; no local engine conclusion is implied.';
   render();$('b2-board')?.scrollIntoView?.({block:'nearest',behavior:'auto'});
 }catch(e){
   notice='Could not load the verified board. Reconnect and retry from match history.';render();
 }
}
window.addEventListener('gomoku:bot-workspace-opened',render);
window.addEventListener('gomoku:bot-training-data-updated',render);
window.addEventListener('gomoku:bot-match-updated',render);
window.addEventListener('gomoku:bot-rating-updated',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.GomokuBotTrainingE7=Object.freeze({version:'e7.1',render,
 readOnlySummary:()=>{
   const s=source(),a=account();
   if(!s?.ownerVerified||!a?.connected||s.ownerKey!==a.userId)return null;
   const r=rating(),x=summarize(s.matches,r?.loaded&&r?.connected?r.events:[]);
   return Object.freeze({scope:'latest-30-owner-verified-match-records',games:x.observedGames,
     wins:x.wins,draws:x.draws,losses:x.losses,observedMilestones:x.completedGoals,
     suggestedBotId:x.proposed?.id||'first'});
 }});
})();