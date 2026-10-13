/* E2 trusted bot games inside Gomoku Studio. Board here is presentation ONLY:
 * no second game evaluator, no local AI, no client-authoritative result or Elo.
 * Uses the original THIEPN Account/competition bridge.
 */
(function(){
'use strict';
if(window.GomokuTrustedBotE2)return;
const $=id=>document.getElementById(id),E=window.GomokuBotEloE1;
if(!E)return;
const BRIDGE=()=>window.GomokuCompetitionBridge;
const files='ABCDEFGHJKLMNOP';
const stoneName=c=>c===1?'Black':c===2?'White':'Empty';
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dialog=null,game=null,busy=false,pendingId=null,selectedColor=1,selectedBot='mid',message='';
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
const css=[
'.b2-panel{width:min(96vw,720px);max-width:720px;max-height:94dvh;overflow-y:auto;padding:0;background:var(--paper,#fff);color:var(--ink,#242424);border:1px solid var(--hair,#999);border-radius:10px}',
'.b2-head{position:sticky;top:0;background:var(--paper,#fff);z-index:2;padding:15px 18px;border-bottom:1px solid var(--hair,#aaa);display:flex;gap:12px;align-items:start;justify-content:space-between}',
'.b2-head h2{font-size:19px;line-height:1.2;margin:0 0 4px}.b2-head p{font-size:11px;color:var(--ink2,#5b6571);margin:0}',
'.b2-content{padding:15px 18px 20px}.b2-fields{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-bottom:11px}',
'.b2-fields label{display:grid;gap:4px;flex:1;min-width:135px;font-size:12px}',
'.b2-fields select{width:100%;min-height:38px}',
'.b2-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:9px 0}',
'.b2-toolbar button{min-height:37px}.b2-status{font-size:12px;line-height:1.5;border:1px solid var(--hair,#999);padding:8px 10px;border-radius:6px;margin:10px 0}',
'.b2-board{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));width:min(100%,535px);margin:12px auto;border:1px solid var(--hair2,#888);padding:5px;gap:0;background:var(--card2,#ded1af);aspect-ratio:1;box-sizing:border-box}',
'.b2-cell{appearance:none;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--ink,#333) 17%,transparent);border-radius:0;background:transparent;aspect-ratio:1;min-width:0;min-height:0;cursor:pointer;padding:0}',
'.b2-cell:disabled{cursor:default;opacity:1}.b2-cell:focus-visible{outline:2px solid var(--seal,#27605f);outline-offset:-2px;z-index:1}',
'.b2-stone{display:block;width:75%;height:75%;border-radius:50%;box-shadow:0 1px 2px #0006}',
'.b2-stone[data-color="1"]{background:#24272d;border:1px solid #050506}',
'.b2-stone[data-color="2"]{background:#f9f9f5;border:1px solid #a5a4a1}',
'.b2-cell[data-last="true"] .b2-stone{outline:2px solid var(--seal,#27605f);outline-offset:2px}',
'.b2-note{font-size:11px;line-height:1.5;color:var(--ink2,#5b6571)}',
'.b2-launch{margin-top:8px;min-height:37px;width:100%;font-size:12px}',
'.b2-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}',
'@media(max-width:480px){.b2-content{padding:10px}.b2-head{padding:12px}.b2-board{padding:2px}}'
].join('');
function ensure(){
 if(dialog)return dialog;
 const st=document.createElement('style');st.id='b2-style';st.textContent=css;document.head.append(st);
 dialog=document.createElement('dialog');dialog.id='botEloE2Dialog';dialog.className='b2-panel';
 dialog.setAttribute('aria-labelledby','b2-heading');
 dialog.innerHTML='<header class="b2-head"><div><h2 id="b2-heading">Play against a verified bot</h2><p>E2 · server-controlled match · no rating changes</p></div><button type="button" class="btn ghost" id="b2-close" aria-label="Close bot match">Close</button></header>'+
 '<div class="b2-content"><div class="b2-fields"><label>Opponent<select id="b2-level"></select></label><label>Your color<select id="b2-color"><option value="1">Black · first</option><option value="2">White · second</option></select></label></div>'+
 '<div class="b2-toolbar"><button class="btn" id="b2-start" type="button">Start verified match</button><button class="btn ghost" type="button" id="b2-resume">Resume active match</button><button class="btn ghost" type="button" id="b2-refresh" hidden>Refresh state</button><button class="btn ghost" type="button" id="b2-resign" hidden>Resign</button></div>'+
 '<div class="b2-status" id="b2-status" role="status" aria-live="polite"></div>'+
 '<div id="b2-board" class="b2-board" role="group" aria-label="Verified Gomoku board" hidden></div>'+
 '<p class="b2-note" id="b2-description">Your moves are submitted to the original authenticated Gomoku server. Bot decisions and results come back from the server. This mode awards no Elo until later phases.</p></div>';
 document.body.append(dialog);
 for(const b of E.BOTS){const o=document.createElement('option');o.value=b.id;o.textContent=b.label+' · provisional tier';$('b2-level').append(o);}
 $('b2-level').value=selectedBot;$('b2-color').value=String(selectedColor);
 $('b2-level').addEventListener('change',e=>{selectedBot=e.target.value;render();});
 $('b2-color').addEventListener('change',e=>{selectedColor=Number(e.target.value);render();});
 $('b2-close').addEventListener('click',()=>dialog.close());
 $('b2-start').addEventListener('click',start);
 $('b2-resume').addEventListener('click',resume);
 $('b2-refresh').addEventListener('click',refresh);
 $('b2-resign').addEventListener('click',()=>{if(game?.status==='active'&&confirm('Resign this verified bot match?'))send('resign',null);});
 $('b2-board').addEventListener('click',e=>{const cell=e.target.closest?.('[data-b2-cell]');if(cell&&!cell.disabled)send('move',Number(cell.dataset.b2Cell));});
 $('b2-board').addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   const el=e.target.closest?.('[data-b2-cell]');if(!el)return;
   e.preventDefault();const i=Number(el.dataset.b2Cell),x=i%15,y=Math.floor(i/15);
   const dest=e.key==='ArrowLeft'?Math.max(0,x-1)+y*15:e.key==='ArrowRight'?Math.min(14,x+1)+y*15:
    e.key==='ArrowUp'?x+Math.max(0,y-1)*15:e.key==='ArrowDown'?x+Math.min(14,y+1)*15:
    e.key==='Home'?y*15:14+y*15;
   $('b2-board').querySelector('[data-b2-cell="'+dest+'"]')?.focus();
 });
 return dialog;
}
function auth(){
 const b=BRIDGE();
 if(!b||!b.account?.().connected){message='Connect your THIEPN Account through Online Rooms to start or resume a verified bot match.';render();return null;}
 return b;
}
function render(){
 if(!dialog)return;
 $('b2-level').value=selectedBot;$('b2-color').value=String(selectedColor);
 const isPlaying=!!game&&game.status==='active',hasGame=!!game,bridge=BRIDGE();
 $('b2-level').disabled=busy||isPlaying;$('b2-color').disabled=busy||isPlaying;
 $('b2-start').disabled=busy||isPlaying||!bridge?.account?.().connected;
 $('b2-resume').disabled=busy;
 $('b2-refresh').hidden=!hasGame;$('b2-refresh').disabled=busy;
 $('b2-resign').hidden=!isPlaying;$('b2-resign').disabled=busy;
 const board=$('b2-board');board.hidden=!hasGame;
 let status=message||'Select a bot. Account sign-in and the E2 backend are required.';
 if(game){
   const turn=game.moves.length%2+1,me=Number(game.playerColor),bot=E.getBot(game.botId);
   status=(game.status==='active'?(turn===me?'Your turn.':'Server bot turn pending.'):
     game.result?.reason==='resign'?'You resigned.':
     game.result?.winner===0?'Game drawn.':
     game.result?.winner===me?'You won the verified match.':'Bot won the verified match.')+
     ' · '+(bot?.label||game.botId)+' · '+game.moves.length+' moves · no Elo adjustment.';
   const current=new Array(225).fill(0);let last=-1;
   for(const m of game.moves){if(m.i>=0){current[m.i]=m.color;last=m.i;}}
   const interactive=isPlaying&&turn===me&&!busy;
   board.innerHTML=current.map((color,i)=>{
     const coord=files[i%15]+(15-Math.floor(i/15)),occupied=!!color;
     return '<button class="b2-cell" type="button" data-b2-cell="'+i+'" data-last="'+(i===last)+
       '" aria-label="'+coord+' '+stoneName(color)+'" '+(!interactive||occupied?'disabled':'')+'>'+
       (color?'<span class="b2-stone" data-color="'+color+'" aria-hidden="true"></span>':'')+'</button>';
   }).join('');
   $('b2-description').textContent='Match '+game.id+' · revision '+game.revision+' · '+game.bot.policy+
     '. Server-owned moves and outcome. No undo, hints, local AI decisions, historical Elo or offline rating.';
 }
 $('b2-status').textContent=status;
}
async function work(callback){
 if(busy)return;busy=true;message='Contacting verified Gomoku server…';render();
 try{message='';await callback();window.GomokuBotRatingAccountE4?.refresh?.();}catch(e){
   message=e.status===404?'Bot match API is not available on the deployed server yet. E2 remains a draft.':
     String(e.message||'Server request failed.');
 }finally{busy=false;render();}
}
async function start(){
 const b=auth();if(!b)return;
 const requestId=pendingId||uid();pendingId=requestId;
 await work(async()=>{const data=await b.accountPost('/api/bot-matches',{requestId,level:selectedBot,color:selectedColor});
   if(!data.match)throw Error('Server did not return a verified match.');
   game=data.match;pendingId=null;selectedBot=game.botId;selectedColor=game.playerColor;});
}
async function resume(){
 const b=auth();if(!b)return;
 await work(async()=>{const data=await b.accountGet('/api/bot-matches/active');
   if(!data.match){game=null;message='No active verified bot match. Start one above.';return;}
   game=data.match;pendingId=null;selectedBot=game.botId;selectedColor=game.playerColor;});
}
async function refresh(){
 const b=auth();if(!b||!game)return;
 await work(async()=>{const data=await b.accountGet('/api/bot-matches/'+encodeURIComponent(game.id));
   if(!data.match)throw Error('Server could not find this match.');game=data.match;});
}
async function send(action,i){
 const b=auth();if(!b||!game||game.status!=='active')return;
 const identity=uid(),revision=game.revision,matchId=game.id;
 await work(async()=>{const data=await b.accountPost('/api/bot-matches/'+encodeURIComponent(matchId)+'/action',
   {commandId:identity,revision,action,i});if(!data.match)throw Error('Missing authoritative match state.');game=data.match;});
}
function open(){
 ensure();if(!dialog.open)dialog.showModal();
 render();window.GomokuBotRatingAccountE4?.open?.();if(BRIDGE()?.account?.().connected&&!game)resume();
}
function launch(){
 for(const area of ['botEloE1New','botEloE1Side','botEloE1Competitive']){
   const host=$(area);if(!host||host.querySelector('[data-b2-launch]'))continue;
   const b=document.createElement('button');b.type='button';b.className='btn ghost b2-launch';b.dataset.b2Launch='true';
   b.textContent='Play verified bot training · E2 (no Elo yet)';
   b.onclick=()=>{if(area==='botEloE1New')selectedBot=$('levelSelect')?.value||'mid';
     if(area==='botEloE1Side')selectedBot=window.GomokuStudio?.diagnostics?.()?.ai?.level||'mid';
     if(area==='botEloE1Competitive')selectedBot=$('v97Level')?.value||'mid';
     if(!game)selectedColor=Number($('colorSelect')?.value)||1;open();};
   host.append(b);
 }
}
launch();
window.GomokuTrustedBotE2=Object.freeze({version:'e2.1',open,refresh,reset:()=>{if(!game||game.status!=='active'){game=null;render();}}});
})();
