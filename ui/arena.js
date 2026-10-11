/* U2 Precision Arena — presentation adapter, not a replacement router. */
(() => {
  'use strict';
  if (window.GomokuArena) return;
  const byId=id=>document.getElementById(id);
  let attempts=0,active='play';
  const destinations=Object.freeze(['play','analyze','learn','library']);
  const routes=Object.freeze({play:'play',analyze:'improve',learn:'improve',library:'library'});
  const label=Object.freeze({play:'Play',analyze:'Analyze',learn:'Learn',library:'Library'});
  function selected(){
    const route=document.body.dataset.v92Route||'play';
    if(route==='improve') return document.body.dataset.v92Sub==='study'?'analyze':'learn';
    return route==='library'?'library':'play';
  }
  function sync(){
    const nav=byId('v92Primary'),analysis=byId('arenaAnalyze');
    if(!nav||!analysis) return;
    active=selected();
    for(const button of nav.querySelectorAll('[data-v92-route]')){
      const id=button.dataset.v92Route==='improve'?'learn':button.dataset.v92Route;
      button.setAttribute('aria-label',label[id]||id);
      button.setAttribute('aria-current',id===active?'page':'false');
      button.dataset.arenaActive=String(id===active);
    }
    analysis.setAttribute('aria-current',active==='analyze'?'page':'false');
    analysis.dataset.arenaActive=String(active==='analyze');
    nav.dataset.arenaCurrent=active;
    const status=byId('uiRouteStatus');
    if(status&&active!==sync.last) status.textContent=label[active]+' section';
    sync.last=active;
  }
  function activate(destination){
    if(!destinations.includes(destination)) return false;
    const nav=byId('v92Primary');
    if(!nav)return false;
    const source=nav.querySelector('[data-v92-route="'+routes[destination]+'"]');
    if(!source||source.disabled)return false;
    source.click();
    if(destination==='analyze'){
      const study=byId('v92StudyChoice');
      if(study&&!study.disabled) study.click();
    }
    requestAnimationFrame(sync);
    return true;
  }
  function mount(){
    const nav=byId('v92Primary'),main=nav?.querySelector('.v92-nav-main');
    if(!main||!window.GomokuAppearance||document.body.dataset.uiReady!=='true'){
      if(++attempts<240)setTimeout(mount,50);
      return;
    }
    document.body.classList.add('ui-arena');
    if(!byId('arenaAnalyze')){
      const extra=document.createElement('button');
      extra.type='button';
      extra.id='arenaAnalyze';
      extra.className='v92-nav-btn arena-extra';
      extra.dataset.uiDestination='analyze';
      extra.setAttribute('aria-label','Analyze');
      extra.textContent='Analyze';
      const learn=main.querySelector('[data-v92-route="improve"]');
      if(!learn)return;
      main.insertBefore(extra,learn);
      extra.addEventListener('click',()=>activate('analyze'));
    }
    nav.setAttribute('aria-label','Primary navigation');
    main.querySelector('[data-v92-route="improve"]')?.setAttribute('aria-label','Learn');
    const repaint=()=>{
      const meta=document.querySelector('meta[name="theme-color"]');
      if(meta)meta.content=['night','dark'].includes(document.body.dataset.theme)?'#0a1116':'#111b20';
    };
    const observer=new MutationObserver(()=>{sync();repaint();});
    observer.observe(document.body,{attributes:true,attributeFilter:['data-v92-route','data-v92-sub','data-theme']});
    nav.addEventListener('click',()=>requestAnimationFrame(sync));
    repaint();sync();
    window.GomokuArena=Object.freeze({
      version:'2.0.0-u2',
      destinations,
      navigate:activate,
      current:()=>active,
      diagnostics:()=>({current:active,legacyRoute:document.body.dataset.v92Route||'play',sub:document.body.dataset.v92Sub||'',learningChapters:window.GomokuAppearance?.courseSummary?.().length||0})
    });
  }
  mount();
})();