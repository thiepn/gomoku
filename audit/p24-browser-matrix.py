"""P24 cross-browser, viewport and input qualification.

This proves browser-engine compatibility in Playwright-controlled environments.
It does NOT label emulated mobile profiles as physical-device certification.
"""
from pathlib import Path
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'p24-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('P24_URL','http://127.0.0.1:8765/')
PROFILE=os.environ.get('P24_PROFILE','chromium-desktop')
CHECKS=[];ERRORS=[]

PROFILES={
    'chromium-desktop':{'engine':'chromium','kind':'desktop','viewport':{'width':1440,'height':900},'label':'Chromium desktop'},
    'firefox-desktop':{'engine':'firefox','kind':'desktop','viewport':{'width':1440,'height':900},'label':'Firefox desktop'},
    'webkit-desktop':{'engine':'webkit','kind':'desktop','viewport':{'width':1440,'height':900},'label':'WebKit desktop'},
    'chromium-android':{'engine':'chromium','kind':'mobile','device':'Pixel 7','fallback':{'viewport':{'width':412,'height':915},'screen':{'width':412,'height':915},'device_scale_factor':2.625,'is_mobile':True,'has_touch':True},'label':'Android/Chromium emulation'},
    'webkit-ios':{'engine':'webkit','kind':'mobile','device':'iPhone 13','fallback':{'viewport':{'width':390,'height':844},'screen':{'width':390,'height':844},'device_scale_factor':3,'is_mobile':True,'has_touch':True},'label':'iOS/WebKit emulation'},
}
if PROFILE not in PROFILES:
    raise SystemExit('Unknown P24 profile '+PROFILE)

def check(name,condition=True,details=None):
    assert condition,name+((': '+str(details)) if details is not None else '')
    CHECKS.append(name);print('PASS '+name,flush=True)

def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')

def close_dialogs(page):
    page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')

with sync_playwright() as p:
    cfg=PROFILES[PROFILE]
    browser_type=getattr(p,cfg['engine'])
    browser=browser_type.launch(headless=True,args=['--no-sandbox'] if cfg['engine']=='chromium' else [])
    options={'service_workers':'block','reduced_motion':'reduce'}
    if cfg['kind']=='mobile':
        device=p.devices.get(cfg['device'])
        if device:
            options.update(device)
        else:
            options.update(cfg['fallback'])
    else:
        options['viewport']=cfg['viewport']
    context=browser.new_context(**options)
    page=context.new_page();page.set_default_timeout(30000)
    page.on('pageerror',lambda e: ERRORS.append(str(e)))

    root=URL if URL.endswith('/') else URL+'/'
    page.goto(root+'?p24='+PROFILE,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function('document.body.dataset.ready==="true" && document.body.dataset.uiReady==="true" && window.GomokuStudio')
    page.wait_for_timeout(200);close_dialogs(page)
    if page.evaluate('Boolean(window.GomokuPlayer2)'):
        page.wait_for_function('document.body.dataset.pj2Route === "home" || document.body.dataset.pj2Route === "app"',timeout=10000)
        if page.locator('#pj2Home').is_visible():
            check(PROFILE+' Player Journey home opens',True)
            page.locator('#v92Primary button[data-v92-route="play"]').click()
            page.locator('#boardGrid').wait_for(state='visible')
    page.evaluate("""()=>{
      const game=GomokuStudio.exportGame();
      game.mode='local';game.moves=[];game.initial=[];game.startColor=1;game.terminal=null;
      game.aiPaused=false;game.gameId='p24-'+Math.random().toString(36).slice(2);
      GomokuStudio.importGame(game);
    }""")
    # First-run onboarding is intentionally asynchronous. Settle it once after
    # fixture setup so browser speed cannot determine whether it intercepts
    # the navigation matrix.
    page.wait_for_timeout(700);close_dialogs(page)

    check(PROFILE+' app booted',page.locator('#boardGrid').is_visible())
    check(PROFILE+' exposes 225 board intersections',page.locator('[id^="point-"]').count()==225)
    check(PROFILE+' has exactly three primary destinations',page.locator('#v92Primary button[data-v92-route]').count()==3)
    check(PROFILE+' initial layout has no horizontal overflow',no_overflow(page))

    for route in ['play','improve','library']:
        close_dialogs(page)
        page.locator('#v92Primary button[data-v92-route="'+route+'"]').click()
        page.wait_for_timeout(80)
        check(PROFILE+' '+route+' route remains visible',page.locator('#v92Primary').is_visible())
        check(PROFILE+' '+route+' route has no horizontal overflow',no_overflow(page))

    close_dialogs(page);page.locator('#v92Primary button[data-v92-route="play"]').click();page.wait_for_timeout(80)
    page.locator('#point-112').focus();page.keyboard.press('ArrowRight')
    check(PROFILE+' board keyboard navigation works',page.evaluate('document.activeElement?.id')=='point-113')
    page.locator('#point-112').focus()

    touch_capable=bool(page.evaluate('navigator.maxTouchPoints>0'))
    if cfg['kind']=='mobile' and touch_capable:
        page.locator('#point-112').tap()
        check(PROFILE+' touch selection exposes reachable confirmation',page.locator('#placeBtn').is_visible() and not page.locator('#placeBtn').is_disabled())
        page.locator('#placeBtn').tap()
    else:
        # Fine-pointer desktop and WebKit mobile emulation use the app's
        # universal keyboard commit path. Explicit Place is intentionally a
        # coarse-pointer/touch UI and must not be required on desktop.
        page.locator('#point-112').focus();page.keyboard.press('Enter')
        check(PROFILE+' keyboard commit path remains available',True)

    page.wait_for_function('GomokuStudio.diagnostics().moves===1')
    check(PROFILE+' commits the intended center move',page.evaluate('GomokuStudio.exportGame().moves[0].i')==112)

    if cfg['kind']=='mobile':
        check(PROFILE+' primary navigation is anchored to viewport bottom',page.locator('#v92Primary').evaluate('(e)=>Math.abs(e.getBoundingClientRect().bottom-innerHeight)<=3'))
        page.set_viewport_size({'width':844,'height':390})
        page.wait_for_timeout(100)
        check(PROFILE+' landscape proxy has no horizontal overflow',no_overflow(page))
        page.set_viewport_size({'width':360,'height':800})
        page.wait_for_timeout(100)
        check(PROFILE+' 360px narrow proxy has no horizontal overflow',no_overflow(page))
        check(PROFILE+' board remains visible at 360px',page.locator('#boardGrid').is_visible())

    second=context.new_page();second.goto('about:blank');second.bring_to_front();page.wait_for_timeout(100);page.bring_to_front()
    check(PROFILE+' state survives tab/background proxy',page.evaluate('GomokuStudio.diagnostics().moves')==1)
    second.close()

    check(PROFILE+' produced no uncaught page errors',len(ERRORS)==0,ERRORS)
    report={
        'version':'p24.browser-matrix.v1','profile':PROFILE,'label':cfg['label'],'engine':cfg['engine'],
        'kind':cfg['kind'],'touchCapabilityObserved':touch_capable,'url':root,'passed':len(CHECKS),'checks':CHECKS,'pageErrors':ERRORS,
        'scope':'Playwright browser-engine/device emulation; not physical-device certification.'
    }
    (OUT/(PROFILE+'.json')).write_text(json.dumps(report,indent=2))
    context.close();browser.close()

print(str(len(CHECKS))+' P24 '+PROFILE+' checks passed',flush=True)
