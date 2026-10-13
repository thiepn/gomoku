/* E1 learner-facing preview in the native setup and opponent panels. No persistence. */
(function(){
'use strict';
const E=window.GomokuBotEloE1,$=id=>document.getElementById(id);
if(!E||$('botEloE1New'))return;
const styles=document.createElement('style');styles.id='botEloE1Styles';
styles.textContent=[
 '.be1{margin:12px 0;padding:12px;border:1px solid var(--hair2,#999);border-radius:8px;background:var(--card2,#f5f5f4);color:var(--ink,#222);font-size:12px}',
 '.be1-title{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
 '.be1-title strong{font-size:13px}.be1-flag{border:1px solid currentColor;border-radius:4px;padding:2px 6px;font-size:10px}',
 '.be1-controls{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}.be1-controls label{flex:1;min-width:125px;font-size:11px;display:grid;gap:3px}',
 '.be1-controls input,.be1-controls select{width:100%;box-sizing:border-box;min-height:34px}',
 '.be1-data{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:9px 0}',
 '.be1-data b{display:block;font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
 '.be1-data small{display:block;font-size:10px;opacity:.76}.be1-note{margin:6px 0 0;font-size:11px;opacity:.85}',
 '@media(max-width:430px){.be1-data{grid-template-columns:repeat(2,minmax(0,1fr))}}'
].join('');
document.head.append(styles);
const simulation={rating:1200,games:20},fmt=n=>(n>0?'+':'')+n.toFixed(2);
function mount(id,node,compact=false){
 if(!node||$(id))return null;
 const el=document.createElement('section');el.id=id;el.className='be1';el.setAttribute('aria-label','Bot Elo E1 preview');
 el.innerHTML='<div class="be1-title"><strong>Bot Elo · scoring preview</strong><span class="be1-flag">Practice only</span></div>'+
 (compact?'':'<div class="be1-controls"><label>Simulated player Elo<input class="be1-rating" aria-label="Simulated player rating" type="number" min="400" max="3200" step="50" inputmode="numeric" value="1200"></label><label>Experience · K-factor<select class="be1-games" aria-label="Simulated games"><option value="0">Placement · 0</option><option value="20" selected>Regular · 20</option><option value="100">Established · 100</option></select></label></div>')+
 '<div class="be1-content" aria-live="polite"></div>';node.insertAdjacentElement('afterend',el);return el;
}
const newBox=mount('botEloE1New',$('newAIFields'));
const sideBox=mount('botEloE1Side',$('levelSection')?.querySelector('.engine-note'),true);
const otherDialog=$('v97CompetitiveDialog'),otherBox=mount('botEloE1Competitive',otherDialog?.querySelector('.v97-body')?.lastElementChild);
function renderItem(box,place){
 if(!box)return;
 const mode=place==='side'?'ai':place==='new'?$('modeSelect')?.value:
  $('v97ModeAI')?.getAttribute('aria-pressed')==='true'?'ai':'local';
 box.hidden=mode!=='ai';if(box.hidden)return;
 const liveLevel=window.GomokuStudio?.diagnostics?.()?.ai?.level;
 const level=place==='side'?(E.getBot(liveLevel)?liveLevel:$('levelSelect')?.value):
  place==='new'?$('levelSelect')?.value:$('v97Level')?.value;
 const data=E.inspect({level,mode,opening:place==='new'?$('openingSelect')?.value:'empty',
  style:place==='side'?$('styleSelect')?.value:'balanced',profile:simulation});
 const bot=data.bot,content=box.querySelector('.be1-content');
 if(!bot){content.textContent='No supported AI level selected.';return;}
 // All values are from the trusted local registry, not external player input.
 content.innerHTML='<p class="be1-note">'+bot.label+' · '+bot.id+' · provisional design target (not measured)</p>'+
 '<div class="be1-data"><div><small>Bot target</small><b>'+bot.ratingTarget+'</b></div>'+
 '<div><small>Expected player score</small><b>'+(data.expected*100).toFixed(1)+'%</b></div>'+
 '<div><small>Win / draw / loss</small><b>'+fmt(data.points.win)+'</b><small>'+fmt(data.points.draw)+' / '+fmt(data.points.loss)+'</small></div></div>'+
 '<p class="be1-note">'+(data.hypotheticalEligible?'Theoretical eligibility: within rating range':data.reasons.join(' · '))+'</p>'+
 '<p class="be1-note">K '+data.k+' · '+data.phase+'. Ratings are uncalibrated; games here remain ordinary practice. No account rating is read or changed.</p>';
}
function render(){renderItem(newBox,'new');renderItem(sideBox,'side');renderItem(otherBox,'other');}
for(const box of [newBox,otherBox]){
 if(!box)continue;
 box.querySelector('.be1-rating')?.addEventListener('input',e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=400&&n<=3200){simulation.rating=n;for(const field of document.querySelectorAll('.be1-rating'))if(field!==e.target)field.value=String(n);render();}});
 box.querySelector('.be1-games')?.addEventListener('change',e=>{simulation.games=Number(e.target.value);for(const field of document.querySelectorAll('.be1-games'))if(field!==e.target)field.value=e.target.value;render();});
}
for(const id of ['levelSelect','modeSelect','openingSelect','colorSelect','styleSelect','v97Level','v97Opening','v97Rule'])$(id)?.addEventListener('change',render);
$('levels')?.addEventListener('click',()=>queueMicrotask(render));
for(const id of ['v97ModeAI','v97ModeLocal'])$(id)?.addEventListener('click',()=>queueMicrotask(render));
const obs=new MutationObserver(render);
for(const d of [$('newDialog'),otherDialog])if(d)obs.observe(d,{attributes:true,attributeFilter:['open']});
window.addEventListener('gomoku:v97-open',()=>queueMicrotask(render));
render();
window.GomokuBotEloPreviewE1=Object.freeze({version:E.VERSION,refresh:render,simulatedProfile:()=>E.normalizeProfile(simulation)});
})();
