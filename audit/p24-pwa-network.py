"""P24 Chromium-only PWA/network lifecycle qualification."""
from pathlib import Path
import json, os, time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'p24-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('P24_URL','http://127.0.0.1:8765/')
CHECKS=[];ERRORS=[]

def check(name,condition=True,details=None):
    assert condition,name+((': '+str(details)) if details is not None else '')
    CHECKS.append(name);print('PASS '+name,flush=True)

def ready(page):
    page.wait_for_function('document.body.dataset.uiReady==="true" && window.GomokuStudio',timeout=30000)
    page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')

def controlled(page):
    page.wait_for_function('!!navigator.serviceWorker.controller',timeout=30000)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(service_workers='allow',viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    page=context.new_page();page.set_default_timeout(30000);page.on('pageerror',lambda e:ERRORS.append(str(e)))
    root=URL if URL.endswith('/') else URL+'/'

    page.goto(root+'?p24=pwa-bootstrap',wait_until='domcontentloaded',timeout=45000);ready(page)
    page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    if not page.evaluate('!!navigator.serviceWorker.controller'):
        page.reload(wait_until='domcontentloaded');ready(page)
    controlled(page)
    check('Chromium PWA worker controls the application')
    scope=page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r?.scope||"")')
    check('PWA worker scope matches application root',scope.rstrip('/')==root.rstrip('/'))

    page.locator('#point-112').tap();page.locator('#placeBtn').tap()
    page.wait_for_function('GomokuStudio.diagnostics().moves===1')
    check('pre-network-change game move committed')

    other=context.new_page();other.goto('about:blank');other.bring_to_front();page.wait_for_timeout(150);page.bring_to_front()
    check('game state survives tab/background proxy',page.evaluate('GomokuStudio.diagnostics().moves')==1);other.close()

    context.set_offline(True)
    check('navigator reports offline state',page.evaluate('navigator.onLine') is False)
    page.reload(wait_until='domcontentloaded');ready(page);controlled(page)
    check('offline reload preserves committed local game state',page.evaluate('GomokuStudio.diagnostics().moves')==1)

    context.set_offline(False)
    page.reload(wait_until='domcontentloaded');ready(page);controlled(page)
    check('network restoration returns to controlled online app',page.evaluate('navigator.onLine') is True and page.evaluate('GomokuStudio.diagnostics().moves')==1)

    context.set_offline(True);page.reload(wait_until='domcontentloaded');ready(page)
    context.set_offline(False);page.reload(wait_until='domcontentloaded');ready(page)
    check('second offline-online flap recovers without state loss',page.evaluate('GomokuStudio.diagnostics().moves')==1)

    # Cache eviction proxy: remove the active cache while online; a normal
    # navigation must reconstruct a usable shell before the next offline load.
    active=page.evaluate('caches.keys()')
    for name in active:
        if name.startswith('gomoku-'):
            page.evaluate('(n)=>caches.delete(n)',name)
    page.reload(wait_until='domcontentloaded');ready(page)
    rebuilt=page.evaluate('caches.keys()')
    check('online navigation reconstructs a missing Gomoku shell cache',any(name.startswith('gomoku-') for name in rebuilt))
    context.set_offline(True);page.reload(wait_until='domcontentloaded');ready(page)
    check('reconstructed cache supports the next offline launch',page.locator('#boardGrid').is_visible())
    context.set_offline(False)

    # Worker-update proxy: unregister, seed a stale Gomoku cache, then let the
    # page install a fresh worker. Activation must delete the stale generation.
    page.evaluate('''async()=>{
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg)await reg.unregister();
      const c=await caches.open('gomoku-p24-stale-fixture');
      await c.put(new URL('index.html',location.href).href,new Response('STALE'));
    }''')
    page.reload(wait_until='domcontentloaded');ready(page)
    page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    page.reload(wait_until='domcontentloaded');ready(page);controlled(page)
    page.wait_for_function("!window.caches || true")
    keys=page.evaluate('caches.keys()')
    check('fresh worker activation removes stale Gomoku cache generation','gomoku-p24-stale-fixture' not in keys,keys)

    check('PWA/network lifecycle produced no uncaught page errors',len(ERRORS)==0,ERRORS)
    context.close();browser.close()

# High-latency cold-load proxy runs with service workers blocked so every
# static request experiences the artificial delay.
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(service_workers='block',viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    def delayed(route):
        time.sleep(0.12)
        route.continue_()
    context.route('**/*',delayed)
    page=context.new_page();page.set_default_timeout(45000)
    started=time.time();page.goto((URL if URL.endswith('/') else URL+'/')+'?p24=slow-network',wait_until='domcontentloaded',timeout=60000);ready(page)
    elapsed=round((time.time()-started)*1000)
    check('high-latency cold-load proxy reaches usable UI',page.locator('#boardGrid').is_visible(),elapsed)
    check('high-latency proxy has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
    context.close();browser.close()

report={
    'version':'p24.pwa-network.v1','url':URL,'passed':len(CHECKS),'checks':CHECKS,'pageErrors':ERRORS,
    'scope':'Chromium service-worker/network emulation: offline/reconnect, cache eviction, stale-worker activation, tab switch proxy and delayed cold load.'
}
(OUT/'pwa-network.json').write_text(json.dumps(report,indent=2))
print(str(len(CHECKS))+' P24 PWA/network checks passed',flush=True)
