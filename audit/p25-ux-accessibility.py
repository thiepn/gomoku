"""P25 product UX/accessibility audit.

Captures the current critical surfaces and enforces an automated WCAG 2.2 AA
baseline with a small set of interaction checks that axe cannot prove.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'p25-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('P25_URL','http://127.0.0.1:8765/')
AXE=os.environ.get('P25_AXE_PATH',str(ROOT/'node_modules/axe-core/axe.min.js'))
MOBILE=os.environ.get('P25_MOBILE','0')=='1'
PROFILE='mobile' if MOBILE else 'desktop'
CHECKS=[];VIOLATIONS=[];ERRORS=[]

def check(name,condition=True,details=None):
    ok=bool(condition);CHECKS.append({'name':name,'ok':ok,'details':details})
    print(('PASS ' if ok else 'FAIL ')+name+((' '+str(details)) if details is not None else ''),flush=True)
    if not ok: raise AssertionError(name+((': '+str(details)) if details is not None else ''))

def settle(page):
    page.wait_for_function('document.body.dataset.ready==="true" && document.body.dataset.uiReady==="true" && window.GomokuStudio',timeout=30000)
    page.wait_for_timeout(800)
    page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')

def screenshot(page,name):
    page.screenshot(path=str(OUT/(name+'.png')),full_page=True)

def axe(page,step):
    page.add_script_tag(path=AXE)
    result=page.evaluate("""async()=>await axe.run(document,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']},
      resultTypes:['violations','incomplete']
    })""")
    serious=[v for v in result['violations'] if v.get('impact') in ('critical','serious')]
    VIOLATIONS.append({'step':step,'violations':result['violations'],'incomplete':result['incomplete']})
    print('AXE '+step+' violations='+str(len(result['violations']))+' serious_or_critical='+str(len(serious)),flush=True)
    for v in serious:
        print('AXE_FAIL '+v['id']+' '+str(v.get('impact'))+' '+v['help']+' targets='+str([n['target'] for n in v['nodes'][:6]]),flush=True)
    return serious

def assert_focus_not_obscured(page):
    return page.evaluate("""()=>{
      const e=document.activeElement;if(!e||e===document.body)return false;
      const r=e.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
      return r.bottom>0&&r.right>0&&r.top<vh&&r.left<vw;
    }""")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    opts={'service_workers':'block','reduced_motion':'reduce'}
    if MOBILE:
        opts.update(p.devices.get('Pixel 7') or {'viewport':{'width':412,'height':915},'is_mobile':True,'has_touch':True,'device_scale_factor':2.625})
    else:
        opts['viewport']={'width':1440,'height':900}
    context=browser.new_context(**opts)
    page=context.new_page();page.set_default_timeout(30000);page.on('pageerror',lambda e:ERRORS.append(str(e)))
    root=URL if URL.endswith('/') else URL+'/'
    page.goto(root+'?p25='+PROFILE,wait_until='domcontentloaded',timeout=45000);settle(page)

    # 01 — Play/start surface.
    screenshot(page,'01-'+PROFILE+'-play')
    serious=axe(page,'play')
    check(PROFILE+' play has no serious/critical WCAG AA violations',len(serious)==0,[v['id'] for v in serious])
    check(PROFILE+' skip link exists',page.locator('a.skip[href="#boardGrid"]').count()==1)
    page.keyboard.press('Tab')
    check(PROFILE+' first keyboard stop is skip link',page.evaluate('document.activeElement?.classList.contains("skip")') is True)
    check(PROFILE+' focused skip link is visible',assert_focus_not_obscured(page))
    page.keyboard.press('Enter');page.wait_for_timeout(80)
    check(PROFILE+' skip link lands on board grid or board point',page.evaluate('document.activeElement?.id==="boardGrid" || document.activeElement?.id?.startsWith("point-")') is True)

    # Deterministic local match through the public API surface.
    page.evaluate("""()=>{
      const g=GomokuStudio.exportGame();
      g.mode='local';g.moves=[];g.initial=[];g.startColor=1;g.terminal=null;g.aiPaused=false;g.gameId='p25-'+Math.random().toString(36).slice(2);
      GomokuStudio.importGame(g);
    }""")
    page.locator('#point-112').focus();page.keyboard.press('Enter')
    page.wait_for_function('GomokuStudio.diagnostics().moves===1')
    check(PROFILE+' keyboard can commit a legal move',page.evaluate('GomokuStudio.exportGame().moves[0].i')==112)

    # 02 — Improve.
    page.locator('#v92Primary button[data-v92-route="improve"]').click();page.wait_for_timeout(250)
    check(PROFILE+' route change is announced without moving focus',page.locator('#uiRouteStatus').text_content().strip()=='Learn section' and page.evaluate('document.activeElement?.dataset?.v92Route')=='improve')
    screenshot(page,'02-'+PROFILE+'-improve')
    serious=axe(page,'improve')
    check(PROFILE+' improve has no serious/critical WCAG AA violations',len(serious)==0,[v['id'] for v in serious])

    # 03 — Library.
    page.locator('#v92Primary button[data-v92-route="library"]').click();page.wait_for_timeout(200)
    screenshot(page,'03-'+PROFILE+'-library')
    serious=axe(page,'library')
    check(PROFILE+' library has no serious/critical WCAG AA violations',len(serious)==0,[v['id'] for v in serious])

    # 04 — Settings through the visible Menu journey, not the hidden legacy proxy.
    page.locator('#v111MenuBtn').click();page.wait_for_timeout(80)
    check(PROFILE+' menu opens from visible header control',page.locator('#v111MenuDialog').evaluate('(e)=>e.open'))
    page.locator('#v111MenuDialog [data-v111-action="settings"]').click()
    page.wait_for_function('document.querySelector("#settingsDialog")?.open===true')
    screenshot(page,'04-'+PROFILE+'-settings')
    serious=axe(page,'settings')
    check(PROFILE+' settings has no serious/critical WCAG AA violations',len(serious)==0,[v['id'] for v in serious])
    dialog=page.locator('#settingsDialog')
    check(PROFILE+' settings dialog has accessible name',dialog.get_attribute('aria-labelledby') is not None or dialog.get_attribute('aria-label') is not None)
    page.keyboard.press('Escape');page.wait_for_timeout(80)
    check(PROFILE+' Escape closes settings dialog',not dialog.evaluate('(e)=>e.open'))
    check(PROFILE+' settings returns focus to visible menu trigger',page.evaluate('document.activeElement?.id')=='v111MenuBtn')

    # Global focus/target checks. Board points are a spatial input target and
    # are excluded from WCAG 2.5.8 target-size minimum by the criterion itself.
    undersized=page.evaluate("""()=>{
      const nodes=[...document.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')]
        .filter(e=>!e.closest('#boardGrid')&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden');
      return nodes.map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,txt:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60),w:r.width,h:r.height}})
        .filter(x=>x.w>0&&x.h>0&&(x.w<24||x.h<24));
    }""")
    check(PROFILE+' visible non-board pointer targets meet 24px minimum',len(undersized)==0,undersized[:12])

    unlabeled=page.evaluate("""()=>[...document.querySelectorAll('button')].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none').filter(b=>{
      const label=(b.getAttribute('aria-label')||b.getAttribute('aria-labelledby')||b.textContent||'').trim();
      return !label;
    }).map(b=>({id:b.id,class:b.className}))""")
    check(PROFILE+' visible buttons have accessible names',len(unlabeled)==0,unlabeled[:12])

    check(PROFILE+' produced no uncaught page errors',len(ERRORS)==0,ERRORS)
    context.close();browser.close()

report={'version':'p25.audit.v1','profile':PROFILE,'url':URL,'checks':CHECKS,'axe':VIOLATIONS,'pageErrors':ERRORS}
(OUT/(PROFILE+'-audit.json')).write_text(json.dumps(report,indent=2))
print('P25 '+PROFILE+' audit complete',flush=True)
