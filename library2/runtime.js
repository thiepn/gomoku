/* Gomoku 1.9 — Library & Archive 2.0 composition layer. */
(()=>{
  'use strict';
  if(window.GomokuLibrary2)return;
  const Core=window.GomokuLibrary2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let last=null,lastKey='',timer=0,observer=null,digestRevision=-1,digestRows=[],digestToken=0,scanComplete=false;
  function api(){return window.GomokuStudio||null;}
  function library(){try{return api()?.libraryState?.()||{items:[]};}catch{return {items:[]};}}
  function game(){try{return api()?.exportGame?.()||{};}catch{return {};}}
  function ensure(){
    const panel=$('panel-library');if(!panel)return null;
    let home=$('lib2Home');
    if(!home){
      home=document.createElement('section');home.id='lib2Home';home.setAttribute('aria-labelledby','lib2Title');
      home.innerHTML='<div class="lib2-head"><div><p class="eyebrow">LIBRARY & ARCHIVE · 2.0</p><h2 id="lib2Title">Your games, studies and review queue.</h2><p>Save once, then search, review and reopen from the same archive.</p></div><span class="lib2-storage" id="lib2Storage"></span></div><div class="lib2-metrics" aria-label="Archive summary"><button type="button" data-lib2-route="all"><strong id="lib2Total">0</strong><span>saved</span></button><button type="button" data-lib2-route="studies"><strong id="lib2Studies">0</strong><span>studies</span></button><button type="button" data-lib2-route="review-center"><strong id="lib2NeedsReview">0</strong><span>need review</span></button><button type="button" data-lib2-route="flagged"><strong id="lib2Flagged">0</strong><span>key moments</span></button></div><div class="lib2-next"><div><span>NEXT ARCHIVE ACTION</span><strong id="lib2PrimaryTitle"></strong><p id="lib2PrimaryDetail"></p></div><button type="button" class="btn" id="lib2Primary"></button></div><div class="lib2-filters" aria-label="Library filters"><input type="search" id="lib2Search" placeholder="Search title, tag, folder, rules…" aria-label="Search Library"><select id="lib2Rule" aria-label="Filter Library by rules"><option value="">All rules</option><option value="renju-practice">Renju</option><option value="exact-five">Exact five</option><option value="freestyle">Freestyle</option></select><select id="lib2Result" aria-label="Filter Library by result"><option value="">All results</option><option value="1">Black wins</option><option value="2">White wins</option><option value="0">Draws</option><option value="unfinished">Unfinished</option></select><button type="button" class="lib2-clear" id="lib2Clear">Clear</button></div><div class="lib2-actions"><button type="button" data-lib2-route="review-center">Review Center</button><button type="button" data-lib2-route="stats">Statistics</button><button type="button" data-lib2-route="backup">Back up</button><button type="button" data-lib2-route="import">Import</button></div><p class="lib2-scan" id="lib2Scan" role="status"></p>';
      const intro=$('v92LibraryIntro');
      if(intro)intro.insertAdjacentElement('afterend',home);else panel.prepend(home);
      home.addEventListener('click',e=>{const b=e.target.closest('[data-lib2-route]');if(b)route(b.dataset.lib2Route);});
      $('lib2Primary').onclick=()=>route($('lib2Primary').dataset.route);
      $('lib2Clear').onclick=clearFilters;
      for(const [proxy,source] of [['lib2Search','librarySearch'],['lib2Rule','libraryRuleFilter'],['lib2Result','libraryResultFilter']]){
        $(proxy).addEventListener('input',()=>writeFilter(proxy,source));
        $(proxy).addEventListener('change',()=>writeFilter(proxy,source));
      }
    }
    return home;
  }
  function syncFilters(){
    for(const [proxy,source] of [['lib2Search','librarySearch'],['lib2Rule','libraryRuleFilter'],['lib2Result','libraryResultFilter']]){
      if($(proxy)&&$(source)&&$(proxy).value!==$(source).value)$(proxy).value=$(source).value;
    }
  }
  function writeFilter(proxy,source){
    if(!$(proxy)||!$(source))return;
    $(source).value=$(proxy).value;
    $(source).dispatchEvent(new Event('input',{bubbles:true}));
  }
  function clearFilters(){
    for(const [proxy,source] of [['lib2Search','librarySearch'],['lib2Rule','libraryRuleFilter'],['lib2Result','libraryResultFilter']]){
      if($(proxy))$(proxy).value='';
      if($(source))$(source).value='';
    }
    $('librarySearch')?.dispatchEvent(new Event('input',{bubbles:true}));
    syncFilters();
  }
  function openEntry(id){
    const button=[...document.querySelectorAll('[data-library][data-action="open"]')].find(x=>x.dataset.library===String(id));
    if(button){button.click();return true;}
    const entry=library().items?.find(x=>String(x.id)===String(id));
    if(entry){try{api()?.importGame?.(entry.data);return true;}catch{}}
    return false;
  }
  function route(id){
    if(id==='play'){document.querySelector('[data-v92-route="play"]')?.click();return true;}
    if(id==='save-current'){$('saveGameBtn')?.click();return true;}
    if(id==='review-center'){api()?.openReviewCenter?.();return true;}
    if(id==='flagged'){
      const p=last?.primary;
      if(p?.entryId&&api()?.openReviewedGame)return api().openReviewedGame(p.entryId,p.ply||null),true;
      api()?.openReviewCenter?.();return true;
    }
    if(id==='latest')return openEntry(last?.primary?.entryId);
    if(id==='stats'){$('openStatsBtn')?.click();return true;}
    if(id==='backup'){$('backupAllBtn')?.click();return true;}
    if(id==='import'){$('importBtn')?.click();return true;}
    if(id==='all'){clearFilters();$('libraryList')?.scrollIntoView({block:'start',behavior:'auto'});return true;}
    if(id==='studies'){
      const search=$('lib2Search');if(search){search.value='type:study';writeFilter('lib2Search','librarySearch');}
      $('libraryList')?.scrollIntoView({block:'start',behavior:'auto'});return true;
    }
    return false;
  }
  function apply(state){
    const home=ensure();if(!home)return null;
    last=Core.summary(state,digestRows,game());
    const c=last.counts,key=JSON.stringify([state.revision,state.count,c.total,c.studies,c.needsReview,c.flagged,last.primary.id,last.primary.entryId,scanComplete]);
    syncFilters();
    if(key===lastKey)return last;lastKey=key;
    $('lib2Total').textContent=c.total;
    $('lib2Studies').textContent=c.studies;
    $('lib2NeedsReview').textContent=c.needsReview;
    $('lib2Flagged').textContent=c.flagged;
    $('lib2Storage').textContent=(state.backend==='indexeddb'?'Local IndexedDB':state.backend==='localstorage'?'Local compatibility storage':'Local archive')+(state.limit?' · '+c.total+' / '+state.limit:'');
    $('lib2PrimaryTitle').textContent=last.primary.label;
    $('lib2PrimaryDetail').textContent=last.primary.detail;
    const primary=$('lib2Primary');primary.textContent=last.primary.label;primary.dataset.route=last.primary.id;
    $('lib2Scan').textContent=scanComplete?'Review status is based on the current Review Center profile.':c.total?'Checking saved-game review status…':'Your Library is local-first. Export backups if you need portability.';
    return last;
  }
  function scan(state){
    const revision=Number(state.revision)||0;
    if(digestRevision===revision)return;
    digestRevision=revision;digestRows=[];scanComplete=false;const token=++digestToken,items=Array.isArray(state.items)?state.items.slice():[];let i=0;
    apply(state);
    const chunk=()=>{
      if(token!==digestToken)return;
      const until=Math.min(items.length,i+32);
      for(;i<until;i++){
        const entry=items[i];let digest=null;
        try{digest=api()?.reviewDigest?.(entry.id)||null;}catch{}
        digestRows.push({id:String(entry.id),digest});
      }
      if(i<items.length){setTimeout(chunk,0);return;}
      if(token!==digestToken)return;scanComplete=true;lastKey='';apply(library());
    };
    if(items.length)setTimeout(chunk,0);else{scanComplete=true;lastKey='';apply(state);}
  }
  function refresh(){
    const state=library();ensure();apply(state);scan(state);return last;
  }
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(refresh,delay);}
  function boot(){
    ensure();refresh();
    const target=$('libraryList')||$('panel-library');
    if(target){
      observer=new MutationObserver(()=>schedule(40));
      observer.observe(target,{childList:true,subtree:true,characterData:true});
    }
    const count=$('libraryCount');if(count)new MutationObserver(()=>schedule(40)).observe(count,{childList:true,characterData:true,subtree:true});
    window.addEventListener('storage',()=>schedule(80));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(60);});
  }
  window.GomokuLibrary2=Object.freeze({version:Core.VERSION,refresh,route,snapshot:()=>last?JSON.parse(JSON.stringify(last)):null});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
