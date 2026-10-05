"""P25 evidence-first UX/accessibility journey audit."""
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'p25-audit-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('P25_URL','http://127.0.0.1:8765/')
AXE=os.environ.get('P25_AXE','node_modules/axe-core/axe.min.js')
RESULT={'version':'p25.audit.v1','url':URL,'profiles':{},'findings':[]}

PROFILES={
  'desktop':dict(viewport={'width':1440,'height':1000},is_mobile=False,has_touch=False),
  'mobile':dict(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=3)
}

def screenshot(page,profile,step):
    path=OUT/f'{profile}-{step}.png'
    page.screenshot(path=str(path),full_page=True)
    return path.name

def add(profile,kind,message,details=None,step=None,severity='medium'):
    RESULT['findings'].append({'profile':profile,'kind':kind,'message':message,'details':details,'step':step,'severity':severity})

def axe(page,profile,step):
    page.add_script_tag(path=AXE)
    data=page.evaluate("""async()=>await axe.run(document,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}
    })""")
    for v in data.get('violations',[]):
        add(profile,'axe',v['help'],{
          'id':v['id'],'impact':v.get('impact'),'helpUrl':v.get('helpUrl'),
          'nodes':[{'target':n.get('target'),'summary':n.get('failureSummary')} for n in v.get('nodes',[])[:8]]
        },step,'high' if v.get('impact') in ('critical','serious') else 'medium')
    return [{'id':v['id'],'impact':v.get('impact'),'nodes':len(v.get('nodes',[]))} for v in data.get('violations',[])]

def custom(page,profile,step):
    data=page.evaluate("""()=>{
      const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const name=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||e.value||'').trim();
      const interactive=[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[role="tab"]')].filter(visible);
      const unnamed=interactive.filter(e=>!name(e)).map(e=>({tag:e.tagName,id:e.id,role:e.getAttribute('role')}));
      const positiveTab=[...document.querySelectorAll('[tabindex]')].filter(e=>Number(e.getAttribute('tabindex'))>0).map(e=>({tag:e.tagName,id:e.id,tabindex:e.getAttribute('tabindex')}));
      const small=interactive.filter(e=>!e.closest('#boardGrid')).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,text:name(e).slice(0,80),w:Math.round(r.width),h:Math.round(r.height)}}).filter(x=>x.w<24||x.h<24);
      const ids=[...document.querySelectorAll('[id]')].map(e=>e.id),dupes=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
      const dialogs=[...document.querySelectorAll('dialog')].map(d=>({id:d.id,open:d.open,labelledby:d.getAttribute('aria-labelledby'),label:d.getAttribute('aria-label')}));
      const grid=document.querySelector('#boardGrid');
      return {
        unnamed,positiveTab,small,dupes,dialogs,
        h1Visible:[...document.querySelectorAll('h1')].filter(visible).map(e=>e.textContent.trim()),
        ariaCurrent:[...document.querySelectorAll('[aria-current="page"]')].filter(visible).map(e=>name(e)),
        live:[...document.querySelectorAll('[aria-live]')].filter(visible).map(e=>({id:e.id,live:e.getAttribute('aria-live'),text:e.textContent.trim().slice(0,100)})),
        board:grid?{role:grid.getAttribute('role'),label:grid.getAttribute('aria-label'),cells:grid.querySelectorAll('[role="gridcell"]').length}:null,
        overflow:document.documentElement.scrollWidth-innerWidth
      };
    }""")
    if data['unnamed']: add(profile,'accessible-name','Visible interactive controls without accessible names',data['unnamed'],step,'high')
    if data['positiveTab']: add(profile,'focus-order','Positive tabindex changes natural focus order',data['positiveTab'],step,'high')
    if data['small']: add(profile,'target-size','Visible non-board controls below 24×24 CSS px',data['small'][:25],step,'medium')
    if data['dupes']: add(profile,'dom','Duplicate IDs',data['dupes'],step,'high')
    if data['overflow']>2: add(profile,'responsive','Document horizontally overflows viewport',data['overflow'],step,'high')
    if len(data['ariaCurrent'])!=1: add(profile,'navigation','Expected exactly one visible aria-current=page item',data['ariaCurrent'],step,'medium')
    if data['board'] and (data['board']['role']!='grid' or not data['board']['label']): add(profile,'board-semantics','Board grid semantics incomplete',data['board'],step,'high')
    return data

with sync_playwright() as p:
  for profile,opts in PROFILES.items():
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(service_workers='block',reduced_motion='reduce',**opts)
    page=context.new_page();page.set_default_timeout(25000)
    page_errors=[];page.on('pageerror',lambda e: page_errors.append(str(e)))
    root=URL if URL.endswith('/') else URL+'/'
    page.goto(root+'?p25='+profile,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function('document.body.dataset.uiReady==="true" && window.GomokuStudio')
    page.wait_for_timeout(500)
    steps=[]

    # Step 1: first-run state exactly as a new user sees it.
    steps.append({'step':'01-first-run','screenshot':screenshot(page,profile,'01-first-run'),'axe':axe(page,profile,'01-first-run'),'custom':custom(page,profile,'01-first-run')})
    open_dialog=page.locator('dialog[open]')
    if open_dialog.count():
      focused=page.evaluate('document.activeElement && document.activeElement.closest("dialog[open]")?.id || null')
      if not focused:add(profile,'dialog-focus','Open first-run dialog does not own initial focus',None,'01-first-run','high')
      if page.locator('#v112Local').count() and page.locator('#v112Local').is_visible():
        page.locator('#v112Local').click();page.wait_for_timeout(250)
      else:
        page.keyboard.press('Escape');page.wait_for_timeout(100)

    # Step 2: the onboarding choice already starts the visible local game.
    page.locator('[data-v92-route="play"]').first.click();page.wait_for_timeout(180)
    steps.append({'step':'02-local-game','screenshot':screenshot(page,profile,'02-local-game'),'axe':axe(page,profile,'02-local-game'),'custom':custom(page,profile,'02-local-game')})
    page.locator('#point-112').focus();page.keyboard.press('ArrowRight')
    if page.evaluate('document.activeElement?.id')!='point-113':add(profile,'keyboard','Board arrow-key navigation failed',None,'03-first-move','high')
    page.locator('#point-112').click();page.wait_for_timeout(180)
    if page.evaluate('GomokuStudio.diagnostics().moves')==0 and page.locator('#placeBtn').is_visible() and page.locator('#placeBtn').is_enabled():
      page.locator('#placeBtn').click()
    page.wait_for_function('GomokuStudio.diagnostics().moves===1')
    steps.append({'step':'03-first-move','screenshot':screenshot(page,profile,'03-first-move'),'axe':axe(page,profile,'03-first-move'),'custom':custom(page,profile,'03-first-move')})

    # Step 4: improve landing.
    page.locator('[data-v92-route="improve"]').first.click();page.wait_for_timeout(180)
    steps.append({'step':'04-improve','screenshot':screenshot(page,profile,'04-improve'),'axe':axe(page,profile,'04-improve'),'custom':custom(page,profile,'04-improve')})

    # Step 5: library.
    page.locator('[data-v92-route="library"]').first.click();page.wait_for_timeout(180)
    steps.append({'step':'05-library','screenshot':screenshot(page,profile,'05-library'),'axe':axe(page,profile,'05-library'),'custom':custom(page,profile,'05-library')})

    # Step 6: settings through the visible Menu path and focus return to Menu.
    page.locator('[data-v92-route="play"]').first.click();page.locator('#v111MenuBtn').focus()
    page.locator('#v111MenuBtn').click();page.wait_for_timeout(80)
    if not page.evaluate('!!document.activeElement?.closest("#v111MenuDialog")'): add(profile,'dialog-focus','Menu dialog does not contain focus after open',None,'06-settings','high')
    page.locator('#v111MenuDialog [data-v111-action="settings"]').click();page.wait_for_timeout(120)
    steps.append({'step':'06-settings','screenshot':screenshot(page,profile,'06-settings'),'axe':axe(page,profile,'06-settings'),'custom':custom(page,profile,'06-settings')})
    if not page.evaluate('!!document.activeElement?.closest("#settingsDialog")'): add(profile,'dialog-focus','Settings dialog does not contain focus after open',None,'06-settings','high')
    page.keyboard.press('Escape');page.wait_for_timeout(120)
    returned=page.evaluate('document.activeElement?.id')
    if returned!='v111MenuBtn':add(profile,'dialog-focus-return','Closing Settings does not return focus to the visible Menu trigger',{'after':returned},'06-settings','high')

    # Step 7: online entry / recovery messaging, no mutations.
    if page.locator('#v92OnlineMode').count():
      page.locator('#v92OnlineMode').click();page.wait_for_timeout(1000)
      steps.append({'step':'07-online-entry','screenshot':screenshot(page,profile,'07-online-entry'),'axe':axe(page,profile,'07-online-entry'),'custom':custom(page,profile,'07-online-entry')})

    if page_errors:add(profile,'runtime','Uncaught page errors during journey',page_errors,None,'high')
    RESULT['profiles'][profile]={'steps':steps,'pageErrors':page_errors}
    context.close();browser.close()

(OUT/'audit.json').write_text(json.dumps(RESULT,indent=2))
print(json.dumps({'profiles':list(RESULT['profiles']),'findings':len(RESULT['findings']),'byKind':{k:sum(1 for x in RESULT['findings'] if x['kind']==k) for k in sorted(set(x['kind'] for x in RESULT['findings']))}},indent=2))
