/* Bot Elo E5 — original Studio account-first bot workspace.
 * Presentation only. The E2 game, E4 rating profile/event ledger, E1 native IDs
 * and signed THIEPN Account transport remain the only authorities.
 * E3 has no measured approved calibration; NEVER manufacture skill or rewards.
 */
(function(){
'use strict';
if(window.GomokuBotWorkspaceE5)return;
const $=id=>document.getElementById(id),E=window.GomokuBotEloE1;
if(!E)return;
const bridge=()=>window.GomokuCompetitionBridge;
const gameAPI=()=>window.GomokuTrustedBotE2;
const ownerAPI=()=>window.GomokuBotRatingAccountE4;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>{const n=Date.parse(s||'');return Number.isFinite(n)?new Date(n).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Unknown date';};
const num=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n).toLocaleString():'—';
const signed=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(3):'—';
const NATIVE_IDS=E.BOTS.map(b=>b.id);
const state={view:null,opponents:null,matchHistory:[],loading:false,error:'',
 connectedKey:null,currentMatch:null,settlement:null,selection:null,reportLoaded:false};
const css=[
'.b5-hub{padding:13px;border:1px solid var(--hair,#9da5aa);border-radius:8px;background:var(--card,#fff);margin-bottom:14px;line-height:1.5}',
'.b5-top{display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
'.b5-top h3{margin:0 0 4px;font-size:16px;line-height:1.25}.b5-status{font-size:11px;color:var(--ink2,#53616b);margin:3px 0}',
'.b5-top button{min-height:36px;font-size:11px}.b5-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:12px 0 10px}',
'.b5-kpi{border:1px solid var(--hair,#999);background:var(--card2,#f1f0ee);border-radius:5px;padding:9px;min-width:0}',
'.b5-kpi span{display:block;color:var(--ink2,#53616b);font-size:10px}.b5-kpi strong{font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
'.b5-journey{margin:7px 0 12px;font-size:11px}.b5-meter{height:5px;border-radius:0;background:var(--hair,#ccc);overflow:hidden;margin-top:5px}',
'.b5-fill{height:100%;background:var(--seal,#315c58);width:0;transition:width .2s ease}',
'.b5-info{border-top:1px solid var(--hair,#ccc);padding-top:10px;font-size:12px}',
'.b5-info strong{font-size:13px}.b5-conditions{margin:5px 0;color:var(--ink2,#53616b);font-size:11px}',
'.b5-rewards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:9px 0}',
'.b5-rewards div{border:1px solid var(--hair,#ccc);padding:7px;min-width:0}.b5-rewards small{display:block;font-size:10px;color:var(--ink2,#53616b)}',
'.b5-rewards b{font-size:14px;font-variant-numeric:tabular-nums}',
'.b5-recommend{margin-top:10px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
'.b5-recommend span{flex:1;min-width:140px;font-size:11px}.b5-recommend button{min-height:38px}',
'.b5-result{border:1px solid var(--hair,#999);background:var(--card2,#f3f3f2);padding:11px;border-radius:6px;margin:12px 0;font-size:12px}',
'.b5-result h3{font-size:13px;margin:0 0 5px}.b5-result strong{font-variant-numeric:tabular-nums}',
'.b5-history{margin-top:14px;border-top:1px solid var(--hair,#ccc);padding-top:10px}',
'.b5-history summary{cursor:pointer;font-size:13px;font-weight:700;min-height:30px}',
'.b5-history ol{padding-left:22px;margin:8px 0}.b5-history li{padding:7px 0;border-bottom:1px solid var(--hair,#ddd);font-size:11px}',
'.b5-history-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
'.b5-history-row button{min-height:32px;font-size:10px}.b5-chart{max-width:100%;margin:8px 0}',
'.b5-chart svg{display:block;width:100%;height:105px;max-width:500px;overflow:visible}',
'.b5-aux{color:var(--ink2,#53616b);font-size:11px;line-height:1.5;margin-top:7px}',
'.b5-entry{width:100%;min-height:40px;margin:8px 0 2px}',
'.b5-collapsed{margin:6px 0}.b5-collapsed summary{font-size:11px;cursor:pointer;color:var(--ink2,#53616b)}',
'.b5-collapsed .be1{margin:6px 0}',
'.b5-scroller{overflow-x:auto;max-width:100%;overscroll-behavior-x:contain}',
'.b5-scroller:focus-within{outline:1px solid var(--seal,#315c58)}',
'.b5-account-details{border-top:1px solid var(--hair,#ccc);padding-top:9px;margin-top:13px}',
'.b5-account-details summary{font-size:12px;cursor:pointer}',
'@media(max-width:560px){.b5-hub{padding:10px}.b5-kpis{gap:4px}.b5-kpi{padding:7px}.b5-kpi strong{font-size:15px}',
'.b5-scroller #b2-board{width:495px;min-width:495px;height:495px;max-width:none;aspect-ratio:auto;margin:8px 0}',
'.b2-toolbar button{min-height:44px}.b5-history-row button{min-height:40px}}',
'@media(prefers-reduced-motion:reduce){.b5-fill{transition:none}}'
].join('');
function connected(){
 const a=bridge()?.account?.();
 return a?.connected===true;
}
function accountKey(){
 const a=bridge()?.account?.();
 return a?.connected?String(a.username||'connected-account'):'';
}
function clearDisconnected(){
 state.opponents=null;state.matchHistory=[];state.currentMatch=null;state.settlement=null;
 state.reportLoaded=false;state.error='';state.view=null;
}
function profileSnapshot(){
 const snap=ownerAPI()?.snapshot?.();
 if(!snap?.connected||!snap.loaded)return null;
 return snap;
}
function locationLabel(bot){
 if(!bot)return 'Unknown bot';
 return bot.label||E.getBot(bot.id)?.label||bot.id;
}
function nativeSelected(){
 const id=gameAPI()?.selected?.()||$('b2-level')?.value||'mid';
 return NATIVE_IDS.includes(id)?id:'mid';
}
function selectedChoice(){
 const chosen=nativeSelected();
 return state.opponents?.opponents?.find(b=>b.id===chosen)||null;
}
function releaseActive(){
 return state.opponents?.availability?.ratedEnabled===true &&
  profileSnapshot()?.availability?.newRatedMatches===true;
}
function accountRating(){
 const snap=profileSnapshot();
 return snap?.profile?.rating??null;
}
function recommendation(){
 const rows=state.opponents?.opponents||[];
 const rating=accountRating();
 if(releaseActive()&&typeof rating==='number'){
   const eligible=rows.filter(x=>x.ratedEligible===true&&Number.isFinite(x.measuredRating));
   const closest=eligible.sort((a,b)=>Math.abs(a.measuredRating-rating-150)-Math.abs(b.measuredRating-rating-150))[0];
   if(closest)return {bot:closest,reason:'Closer calibrated challenge; potential eligibility is confirmed again when you start.'};
 }
 const completed=state.matchHistory.find(m=>m?.result&&m?.status!=='active');
 if(completed){
   const i=NATIVE_IDS.indexOf(completed.botId);
   const won=completed.result.winner===completed.playerColor;
   const next=E.getBot(NATIVE_IDS[won?Math.min(NATIVE_IDS.length-1,i+1):Math.max(0,i)])||E.getBot('first');
   return {bot:next,reason:won?
     'Suggested next practice level after your most recent recorded win; not an Elo estimate.':
     'Repeat your recent practice opponent; not a skill or mastery assessment.'};
 }
 return {bot:E.getBot('first'),reason:'Beginner is an optional practice starting point, not a measured skill recommendation.'};
}
function labelReason(reason){
 const labels={
   'calibration-not-activated':'Calibrated Bot Elo is not active. All games are practice only.',
   'calibration-release-not-verified':'The rating release could not be verified. Practice only.',
   'earlier-rated-game-awaits-settlement':'An earlier rated result must settle first. This match will be practice only.',
   'opponent-below-eligibility':'Your rating is at least 400 points above this bot. Practice only.',
   'win-would-exceed-ceiling':'The maximum win would exceed this bot’s +400 ceiling. Practice only.',
   'potentially-eligible':'Potentially rated; the server makes a binding admission decision when the match starts.',
   'eligible':'Eligible at creation, subject to authoritative settlement.',
   'legacy-unrated':'This earlier game is practice only.'
 };
 return labels[reason]||'No rated rewards have been authorized for this match.';
}
function ensure(){
 const d=$('botEloE2Dialog'),content=d?.querySelector('.b2-content');
 if(!d||!content)return false;
 if(!$('b5-style')){
   const st=document.createElement('style');st.id='b5-style';st.textContent=css;document.head.append(st);
 }
 if(!$('b5-hub')){
   const section=document.createElement('section');section.id='b5-hub';section.className='b5-hub';
   section.setAttribute('aria-label','Bot challenge rating and opponent readiness');
   section.innerHTML='<div class="b5-top"><div><h3>Bot challenge</h3><p class="b5-status" id="b5-mode" role="status" aria-live="polite"></p></div>'+
     '<div class="b5-top-actions"><button class="btn ghost" type="button" id="b5-connect" hidden>Connect THIEPN Account</button> <button class="btn ghost" type="button" id="b5-refresh">Refresh account and matches</button></div></div>'+
     '<div class="b5-kpis"><div class="b5-kpi"><span>Account Bot Elo</span><strong id="b5-rating">Not rated</strong></div>'+
     '<div class="b5-kpi"><span>Personal best</span><strong id="b5-peak">—</strong></div>'+
     '<div class="b5-kpi"><span>Rated matches</span><strong id="b5-games">0</strong></div></div>'+
     '<div id="b5-journey" class="b5-journey"></div>'+
     '<div id="b5-selection" class="b5-info" aria-live="polite"></div>'+
     '<div id="b5-suggest" class="b5-recommend"></div>';
   content.insertBefore(section,content.querySelector('.b2-fields'));
   $('b5-refresh').onclick=refresh;
   $('b5-connect').onclick=()=>$('onlineBtn')?.click();
 }
 if(!$('b5-history')){
   const region=document.createElement('section');region.id='b5-history';
   region.innerHTML='<div id="b5-result"></div><details class="b5-history" id="b5-records">'+
     '<summary>Verified matches and Bot Elo progression</summary>'+
     '<div id="b5-history-content"></div></details>';
   const desc=$('b2-description');
   if(desc)desc.insertAdjacentElement('afterend',region);else content.append(region);
 }
 const board=$('b2-board');
 if(board&&!board.parentElement?.classList.contains('b5-scroller')){
   const wrap=document.createElement('div');wrap.className='b5-scroller';
   wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Horizontally scrollable game board on smaller screens');
   wrap.tabIndex=0;
   board.before(wrap);wrap.append(board);
 }
 const legacy=$('botRatingAccountE4');
 if(legacy&&!legacy.parentElement?.classList.contains('b5-account-details')){
   const details=document.createElement('details');details.className='b5-account-details';
   const summary=document.createElement('summary');summary.textContent='Detailed verified account ledger';
   details.append(summary);legacy.before(details);details.append(legacy);
 }
 return true;
}
function decorateLaunchers(){
 for(const id of ['botEloE1New','botEloE1Side','botEloE1Competitive']){
   const node=$(id);
   if(!node||node.closest('.b5-collapsed'))continue;
   const parent=node.parentNode;if(!parent)continue;
   const btn=document.createElement('button');
   btn.className='btn b5-entry';btn.type='button';btn.textContent='Open Bot Challenge · verified practice';
   btn.setAttribute('aria-label','Open signed-in Bot Challenge workspace');
   btn.addEventListener('click',()=>{
     const selected=id==='botEloE1New'?$('levelSelect')?.value:
       id==='botEloE1Competitive'?$('v97Level')?.value:
         window.GomokuStudio?.diagnostics?.()?.ai?.level;
     if(E.getBot(selected))gameAPI()?.selectBot?.(selected);
     gameAPI()?.open?.();
   });
   parent.insertBefore(btn,node);
   const note=document.createElement('p');note.className='b5-aux';
   note.textContent='Practice is available without any Elo change. Official rating requires verified calibration and server admission.';
   parent.insertBefore(note,node);
   const details=document.createElement('details');details.className='b5-collapsed';
   const summary=document.createElement('summary');
   summary.textContent='Optional sample Elo calculator · simulated, not your account rating';
   details.append(summary);parent.insertBefore(details,node);details.append(node);
 }
}
function renderJourney(p){
 if(!p||p.rating==null){
   $('b5-journey').innerHTML='<span class="b5-aux">No established account Bot Elo. Starting numbers in the sample calculator are not real progress.</span>';
   return;
 }
 const count=Number(p.ratedGames)||0,placement=count<10,provisional=count<20;
 const target=placement?10:provisional?20:100;
 const start=placement?0:provisional?10:20;
 const fraction=Math.max(0,Math.min(1,(count-start)/(target-start)));
 const mode=placement?'Placement':provisional?'Provisional rating':count<100?'Building a stable rating':'Established rating';
 const label=count<100?count+' of '+target+' rated matches in this stage':'100+ rated matches';
 $('b5-journey').innerHTML='<strong>'+esc(mode)+'</strong> · '+esc(label)+
   '<div class="b5-meter" role="progressbar" aria-label="Rated match stage progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(100*fraction)+'">'+
   '<div class="b5-fill" style="width:'+Math.round(100*fraction)+'%"></div></div>'+
   (placement?'<span class="b5-aux">'+Math.max(0,10-count)+' placement matches remaining.</span>':'');
}
function renderChoice(){
 const selected=nativeSelected(),bot=E.getBot(selected),official=selectedChoice(),ranked=releaseActive();
 const list=$('b2-level');
 if(list)for(const option of list.options){
   const measured=state.opponents?.opponents?.find(b=>b.id===option.value);
   const native=E.getBot(option.value);
   if(native)option.textContent=native.label+
     (ranked&&Number.isFinite(measured?.measuredRating)?
       ' · reviewed '+num(measured.measuredRating):' · strength not measured');
 }
 const name=esc(locationLabel(bot));
 let html='<strong>'+name+'</strong> · Native difficulty '+(bot?.order||'—')+' / 8';
 if(!official||!ranked||!Number.isFinite(official.measuredRating)){
   html+='<p class="b5-conditions">This bot has no approved measured rating in the active server policy. '+
     'E1 reference numbers are illustrative only. Your next match is verified practice; it cannot award or deduct Elo.</p>';
 }else{
   html+='<p class="b5-conditions">Reviewed bot strength: '+num(official.measuredRating)+
     ' · Expected player score: '+(100*official.expectedScore).toFixed(1)+
     '% · K '+official.kFactor+'</p>';
   html+='<p class="b5-conditions">'+esc(labelReason(official.reason))+'</p>'+
     '<p class="b5-aux">Color advantage is not included in these indicative changes; the final server admission remains authoritative.</p>';
   if(official.ratedEligible&&official.changes){
     html+='<div class="b5-rewards" aria-label="Indicative Bot Elo changes">'+
       [['Win',official.changes.win],['Draw',official.changes.draw],['Loss',official.changes.loss]]
       .map(([name,n])=>'<div><small>'+name+'</small><b>'+signed(n)+'</b></div>').join('')+'</div>'+
       '<p class="b5-aux">Indicative values only. The game server freezes the actual admission before the first move; only the E4 ledger settles results.</p>';
   }
 }
 const game=state.currentMatch,admission=game?.rating;
 if(game?.status==='active'&&admission){
   html+='<p class="b5-conditions"><strong>Current match:</strong> '+
     (admission.admitted?'Server admitted this match as rated.':'Practice-only admission.')+
     ' '+esc(labelReason(admission.reason))+'</p>';
 }
 $('b5-selection').innerHTML=html;
}
function renderRecommendation(){
 const rec=recommendation();
 if(!rec?.bot)return;
 const b=rec.bot,ident=b.id;
 $('b5-suggest').innerHTML='<span><strong>Suggested opponent:</strong> '+esc(locationLabel(b))+
   '<span class="b5-aux">'+esc(rec.reason)+'</span></span>'+
   '<button class="btn ghost" id="b5-choose" type="button">Select opponent</button>';
 $('b5-choose').disabled=state.currentMatch?.status==='active';
 $('b5-choose').onclick=()=>{
   if(gameAPI()?.selectBot?.(ident))render();
 };
}
function ratingChart(events){
 const data=events.slice().filter(e=>Number.isFinite(e.ratingAfter)&&Number.isFinite(e.ratingBefore))
   .sort((a,b)=>Number(a.gameNumber)-Number(b.gameNumber));
 if(!data.length)return '<p class="b5-aux">No recorded rating changes yet. A chart appears only after actual settled matches.</p>';
 const values=[data[0].ratingBefore,...data.map(e=>e.ratingAfter)];
 const lo=Math.min(...values),hi=Math.max(...values),range=Math.max(1,hi-lo);
 const points=values.map((value,i)=>(20+(i/Math.max(1,values.length-1))*440).toFixed(2)+','+
   (80-(value-lo)/range*58).toFixed(2)).join(' ');
 const marks=[data[0].gameNumber-1,...data.map(e=>e.gameNumber)];
 const title='Recorded Bot Elo from game '+marks[0]+' to game '+marks[marks.length-1]+
   '. Minimum '+num(lo)+', maximum '+num(hi)+'.';
 return '<div class="b5-chart"><svg viewBox="0 0 480 105" role="img" aria-label="'+esc(title)+'" xmlns="http://www.w3.org/2000/svg">'+
   '<line x1="20" y1="82" x2="460" y2="82" stroke="currentColor" opacity=".24"/>'+
   '<line x1="20" y1="18" x2="20" y2="82" stroke="currentColor" opacity=".24"/>'+
   '<polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" points="'+points+'"/>'+
   '<text x="23" y="12" fill="currentColor" font-size="10">Peak '+num(hi)+'</text>'+
   '<text x="460" y="99" text-anchor="end" fill="currentColor" font-size="10">Game '+marks[marks.length-1]+'</text>'+
   '</svg></div>';
}
function resultName(game){
 if(game?.status==='abandoned')return 'Practice closed';
 if(!game?.result)return game?.status==='active'?'In progress':'Not complete';
 if(game.result.winner===0)return 'Draw';
 return game.result.winner===game.playerColor?'Win':'Loss';
}
function renderResult(){
 const region=$('b5-result');if(!region)return;
 const match=state.currentMatch;
 if(!match||match.status==='active'){region.innerHTML='';return;}
 const event=profileSnapshot()?.events?.find(e=>e.matchId===match.id)||null;
 const b=E.getBot(match.botId);
 const score=resultName(match),color=match.playerColor===1?'Black':'White';
 let expl='';
 if(event&&match.rating?.admitted){
   expl='Bot Elo '+signed(Number(event.delta))+' · '+num(event.ratingBefore)+' → '+num(event.ratingAfter)+
     ' (verified ledger event '+String(event.gameNumber)+').';
 }else if(match.rating?.admitted){
   expl='Rated match admitted by the server; settlement has not appeared in your verified ledger. Refresh or use recovery if enabled.';
 }else{
   expl='Verified practice result. No Elo points gained or lost; placement and rating history are unchanged.';
 }
 if(state.settlement?.status==='retry-required'){
   expl+=' The backend reported that settlement must be retried; no points have been assumed.';
 }
 if(match.status==='abandoned')expl='This practice match closed without a scored win, loss or Elo adjustment. The server retains its verified move history.';
 region.innerHTML='<div class="b5-result" role="status" aria-live="polite">'+
   '<h3>'+esc(score)+' against '+esc(b?.label||match.botId)+'</h3>'+
   '<p>'+match.moves.length+' recorded turns · Played as '+color+
   ' · '+esc(match.result?.reason||'finished')+'</p><p><strong>'+esc(expl)+'</strong></p>'+
   '<p class="b5-aux">The board and final result come from the verified match server, not local analysis.</p></div>';
}
function renderHistory(){
 const region=$('b5-history-content');if(!region)return;
 const snap=profileSnapshot(),events=snap?.events||[];
 let html='<h4 style="font-size:12px;margin:10px 0 4px">Actual Bot Elo progression</h4>'+ratingChart(events);
 if(!state.matchHistory.length){
   html+='<p class="b5-aux">'+(connected()?
     'No completed or active server matches returned. Verified games will appear here when available.':
     'Connect your THIEPN Account to see owner-private verified match history.')+'</p>';
 }else{
   html+='<h4 style="font-size:12px;margin:13px 0 4px">Verified match history</h4>'+
     '<ol>'+state.matchHistory.slice(0,15).map((m,i)=>{
       const b=E.getBot(m.botId),rated=m.rating?.admitted===true,
         event=events.find(e=>e.matchId===m.id);
       const outcome=resultName(m);
       const ratingResult=event?' · Elo '+signed(Number(event.delta)):
         rated?' · Server settlement pending':m.status==='abandoned'?' · Closed without rating':' · Practice only';
       return '<li><div class="b5-history-row"><span><strong>'+esc(outcome)+'</strong> · '+
         esc(b?.label||m.botId)+' · '+date(m.completedAt||m.startedAt)+
         '<br><span class="b5-aux">'+Number(m.moves?.length||0)+' moves'+esc(ratingResult)+'</span></span>'+
         '<button class="btn ghost" type="button" data-b5-view="'+i+'">View board</button></div></li>';
     }).join('')+'</ol>';
 }
 if(state.error)html+='<p class="b5-aux" role="alert">'+esc(state.error)+'</p>';
 region.innerHTML=html;
 region.querySelectorAll('[data-b5-view]').forEach(btn=>btn.onclick=()=>{
   const m=state.matchHistory[Number(btn.dataset.b5View)];
   if(m?.id)gameAPI()?.loadMatch?.(m.id);
 });
}
function render(){
 if(!ensure())return;
 if(!connected()){
   if(state.connectedKey!==null)clearDisconnected();
   state.connectedKey=null;
 }else if(state.connectedKey!==accountKey()){
   clearDisconnected();state.connectedKey=accountKey();
 }
 const p=profileSnapshot()?.profile;
 $('b5-rating').textContent=p?.rating==null?'Not rated':num(p.rating);
 $('b5-peak').textContent=p?.peakRating==null?'—':num(p.peakRating);
 $('b5-games').textContent=String(p?.ratedGames||0);
 renderJourney(p);
 const active=releaseActive();
 $('b5-mode').textContent=!connected()?
   'Guest/local play is practice only. Sign in to see verified bot challenges.':
   state.loading?'Reading authoritative account and opponent data…':
   active?'Reviewed calibration active · eligible bot matches may award Elo after server admission.':
   'Practice-only mode · no approved measured bot Elo release. No rating changes.';
 $('b5-refresh').disabled=state.loading||!connected();
 $('b5-refresh').hidden=!connected();
 $('b5-connect').hidden=connected();
 renderChoice();renderRecommendation();renderResult();renderHistory();
 const legacy=$('botRatingAccountE4');
 if(legacy&&!legacy.parentElement?.classList.contains('b5-account-details'))ensure();
 for(const id of ['b5-mini-New','b5-mini-Side','b5-mini-Competitive']){
   const el=$(id);if(!el)continue;
   el.textContent=active?'Measured opponents available · official eligibility determined by server':
     'Verified bot practice · official Elo remains inactive';
 }
}
async function refresh(){
 if(state.loading)return;
 if(!connected()){
   clearDisconnected();state.connectedKey=null;render();return;
 }
 state.loading=true;state.error='';state.connectedKey=accountKey();render();
 const b=bridge();
 try{
   // Account rating remains solely the E4 owner-authenticated profile authority.
   const requests=[
     b.accountGet('/api/bot-rating/opponents'),
     b.accountGet('/api/bot-matches/history'),
     ownerAPI()?.refresh?.()
   ];
   const all=await Promise.allSettled(requests);
   if(all[0].status==='fulfilled'&&all[0].value?.verifiedForOwner===true){
     state.opponents=all[0].value;
   }else{
     state.opponents=null;
     state.error='Account-opponent preview is unavailable until the E5 backend is deployed.';
   }
   if(all[1].status==='fulfilled'&&Array.isArray(all[1].value?.matches)){
     state.matchHistory=all[1].value.matches;
   }else{
     state.matchHistory=[];
     state.error+=(state.error?' ':'')+
       'Verified match history could not be retrieved.';
   }
   if(all[2].status==='rejected'){
     state.error+=(state.error?' ':'')+'Bot Elo account information is unavailable.';
   }
   // Clear previous account data after an account switch / sign-out mid-request.
   if(!connected()||state.connectedKey!==accountKey()){
     clearDisconnected();state.connectedKey=connected()?accountKey():null;
   }else state.reportLoaded=true;
 }catch(e){
   state.error=String(e?.message||'Could not fetch verified bot account data.');
 }finally{
   state.loading=false;render();
 }
}
function onOpened(e){
 ensure();state.currentMatch=e?.detail?.match||gameAPI()?.match?.()||null;
 state.selection=e?.detail?.selectedBot||nativeSelected();
 render();refresh();
}
window.addEventListener('gomoku:bot-workspace-opened',onOpened);
window.addEventListener('gomoku:bot-match-updated',e=>{
 state.currentMatch=e?.detail?.match||null;state.settlement=e?.detail?.settlement||null;
 render();
 if(state.currentMatch?.status&&state.currentMatch.status!=='active')refresh();
});
window.addEventListener('gomoku:bot-selection-updated',()=>{if(ensure())render();});
window.addEventListener('gomoku:bot-rating-updated',()=>{if(ensure())render();});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&$('botEloE2Dialog')?.open&&connected()&&!state.loading)refresh();
});
decorateLaunchers();
window.GomokuBotWorkspaceE5=Object.freeze({version:'e5.1',refresh,open:()=>gameAPI()?.open?.(),
 readOnlyState:()=>({connected:connected(),releaseActive:releaseActive(),hasAuthoritativeProfile:!!profileSnapshot()?.profile,
   selectedBot:nativeSelected(),historyCount:state.matchHistory.length,error:state.error})});
})();
