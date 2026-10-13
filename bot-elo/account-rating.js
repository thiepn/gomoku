/* E4: actual owner-authorized Bot Elo account read surface.
 * Not a local rating store. All numbers come from gomoku-room's rating authority.
 * This does NOT replace or modify the existing E1 hypothetical preview.
 */
(function(){
'use strict';
if(window.GomokuBotRatingAccountE4)return;
const $=id=>document.getElementById(id);
const bridge=()=>window.GomokuCompetitionBridge;
let mount=null,busy=false,loaded=false,last=null,history=[],error='';
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n).toLocaleString():'—';
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(){
 if(mount?.isConnected)return mount;
 const dialog=$('botEloE2Dialog');
 if(!dialog)return null;
 const content=dialog.querySelector('.b2-content');
 if(!content)return null;
 const style=document.createElement('style');style.id='b4-style';
 style.textContent=[
 '.b4-account{border-top:1px solid var(--hair,#9ca3a9);margin-top:15px;padding-top:14px;color:var(--ink,#222)}',
 '.b4-top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px}',
 '.b4-top h3{font-size:14px;font-weight:750;margin:0}.b4-top button{min-height:32px}',
 '.b4-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}',
 '.b4-kpi{padding:9px;background:var(--card2,#eee);border:1px solid var(--hair2,#aaa);border-radius:6px}',
 '.b4-kpi small{display:block;font-size:10px;opacity:.75}.b4-kpi b{font-size:16px;font-variant-numeric:tabular-nums}',
 '.b4-message{font-size:11px;line-height:1.6;margin:7px 0;color:var(--ink2,#56616c)}',
 '.b4-history{list-style:none;padding:0;margin:8px 0}.b4-history li{display:flex;gap:8px;justify-content:space-between;border-bottom:1px solid var(--hair,#aaa);padding:5px 0;font-size:11px}',
 '.b4-control{display:flex;gap:8px;flex-wrap:wrap}.b4-control button{font-size:11px;min-height:32px}',
 '@media(max-width:420px){.b4-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'
 ].join('');
 if(!$('b4-style'))document.head.append(style);
 mount=document.createElement('section');mount.id='botRatingAccountE4';mount.className='b4-account';
 mount.setAttribute('aria-label','Your verified Bot Elo rating');
 mount.innerHTML='<div class="b4-top"><h3>Your Bot Elo · account rating</h3><button type="button" class="btn ghost" id="b4-refresh">Refresh</button></div>'+
 '<div id="b4-summary" role="status" aria-live="polite"></div>'+
 '<div class="b4-control"><button type="button" class="btn ghost" id="b4-recover" hidden>Retry pending settlement</button></div>'+
 '<div id="b4-events"></div>';
 content.append(mount);
 $('b4-refresh').onclick=()=>refresh();
 $('b4-recover').onclick=()=>recover();
 render();
 return mount;
}
function render(){
 if(!setup())return;
 const account=bridge()?.account?.(),connected=account?.connected===true;
 $('b4-refresh').disabled=busy||!connected;
 const p=last?.profile,availability=last?.availability;
 $('b4-recover').hidden=!connected||!availability?.newRatedMatches;
 $('b4-recover').disabled=busy;
 if(!connected){
   $('b4-summary').innerHTML='<p class="b4-message">Connect your THIEPN Account in Online Rooms to view your server-owned Bot Elo profile. Local practice and simulated E1 ratings are not account Elo.</p>';
   $('b4-events').textContent='';return;
 }
 if(error){
   $('b4-summary').innerHTML='<p class="b4-message" role="alert">'+safe(error)+'</p>';
   return;
 }
 if(!loaded){
   $('b4-summary').innerHTML='<p class="b4-message">'+(busy?'Reading verified account rating…':'No rating loaded. Select Refresh.')+'</p>';
   return;
 }
 const active=availability?.newRatedMatches===true;
 const badge=active?'Reviewed calibration active':'Not activated · calibration unavailable';
 const score=p?.rating==null?'Not rated':fmt(p.rating);
 const progress=p?.rating==null?'—':(p.provisional?'Provisional':'Established');
 const stats=p?((p.wins||0)+' W · '+(p.draws||0)+' D · '+(p.losses||0)+' L'):'No rated games';
 $('b4-summary').innerHTML=
   '<p class="b4-message"><strong>'+safe(badge)+'</strong> · Server-owned, separate from human PvP.</p>'+
   '<div class="b4-kpis"><div class="b4-kpi"><small>Bot Elo</small><b>'+score+'</b></div>'+
   '<div class="b4-kpi"><small>Peak</small><b>'+fmt(p?.peakRating)+'</b></div>'+
   '<div class="b4-kpi"><small>Rated games</small><b>'+Number(p?.ratedGames||0)+'</b></div></div>'+
   '<p class="b4-message">'+safe(progress)+' · '+safe(stats)+'.'+
   (p?.placementRemaining>0?' '+p.placementRemaining+' placement games remaining.':'')+'</p>'+
   '<p class="b4-message">E1 example ratings are not calibrated. E2 verified training matches do not generate Elo while the E4 activation gate is off.</p>';
 if(!history.length){
   $('b4-events').innerHTML='<p class="b4-message">No verified Bot Elo events yet. This is expected until measured calibration and rating activation.</p>';
 }else{
   $('b4-events').innerHTML='<p class="b4-message"><strong>Recent immutable rating events</strong></p><ul class="b4-history">'+
     history.slice(0,8).map(e=>'<li><span>'+safe(e.botId)+' · '+safe(e.releaseId)+
     '</span><span>'+(Number(e.delta)>0?'+':'')+Number(e.delta).toFixed(3)+' → '+fmt(e.ratingAfter)+'</span></li>').join('')+'</ul>';
 }
}
async function refresh(){
 if(busy)return;const b=bridge();if(!b?.account?.().connected){loaded=false;last=null;history=[];render();return;}
 if(!setup())return;
 busy=true;error='';render();
 try{
   const [profile,ledger]=await Promise.all([
     b.accountGet('/api/bot-rating/me'),b.accountGet('/api/bot-rating/history')
   ]);
   if(profile?.mode!=='bot-elo'||!profile?.profile||!Array.isArray(ledger?.events))
     throw Error('Server rating authority returned an incomplete response.');
   last=profile;history=ledger.events;loaded=true;
 }catch(e){
   error=e?.status===404?
     'Bot Elo account API is not deployed. The E4 code is only in a draft PR.':
     String(e?.message||'Rating authority unavailable.');
   loaded=false;
 }finally{busy=false;render();}
}
async function recover(){
 const b=bridge();if(busy||!b?.account?.().connected)return;
 busy=true;error='';render();
 try{
   const data=await b.accountPost('/api/bot-rating/recover',{});
   if(!data||!Number.isInteger(data.retried))throw Error('Invalid settlement recovery response.');
 }catch(e){error=String(e?.message||'Recovery unavailable.');}finally{
   busy=false;if(!error){await refresh();}else render();
 }
}
const api=Object.freeze({version:'e4.1',open:async()=>{if(setup())await refresh();},refresh,
  state:()=>({connected:bridge()?.account?.().connected===true,
    loaded,enabled:last?.availability?.newRatedMatches===true,error})});
window.GomokuBotRatingAccountE4=api;
})();
