"""P22 real-origin PWA/offline regression.
Uses a fresh browser profile; no production saves or multiplayer rooms are created.
"""
from pathlib import Path
from urllib.parse import urljoin
import json, os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'p22-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('P22_URL','http://127.0.0.1:8765/')
CHECKS=[]

def check(name, condition=True):
    assert condition, name
    CHECKS.append(name)
    print('PASS '+name, flush=True)

with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH','playwright')
    browser=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,args=['--no-sandbox'])
    context=browser.new_context(service_workers='allow')
    page=context.new_page();page.set_default_timeout(20000)

    root=URL if URL.endswith('/') else URL+'/'
    page.goto(root+'?p22=bootstrap',wait_until='domcontentloaded')
    page.wait_for_function('document.body.dataset.uiReady==="true"')
    page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    if not page.evaluate('!!navigator.serviceWorker.controller'):
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true"')
    page.wait_for_function('!!navigator.serviceWorker.controller')

    check('fresh profile is controlled by the Gomoku service worker')
    scope=page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r?.scope||"")')
    check('service worker scope matches the Gomoku application root',scope.rstrip('/')==root.rstrip('/'))
    cache_names=page.evaluate('caches.keys()')
    check('P22 cache version is installed',any('p22-client-resilience' in name for name in cache_names))

    # The old worker poisoned index.html by caching any same-scope navigation as the shell.
    page.goto(urljoin(root,'ui/'),wait_until='domcontentloaded')
    check('documentation navigation is not replaced by the game shell',page.locator('#boardGrid').count()==0)

    context.set_offline(True)
    try:
        page.goto(root+'?p22=offline-return',wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true"')
        check('offline return after documentation loads the game shell',page.locator('#boardGrid').count()==1)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true"')
        check('offline reload remains controlled and usable',page.locator('#boardGrid').count()==1 and page.evaluate('!!navigator.serviceWorker.controller'))
    finally:
        context.set_offline(False)

    page.goto(root+'?p22=online-again',wait_until='domcontentloaded')
    page.wait_for_function('document.body.dataset.uiReady==="true"')
    check('network restoration returns to the normal app',page.locator('#boardGrid').count()==1)

    (OUT/'browser.json').write_text(json.dumps({
        'url':root,'passed':len(CHECKS),'checks':CHECKS,
        'scope':'Fresh Chromium profile; real HTTP/HTTPS origin; service-worker install, scope, offline return and reload.'
    },indent=2))
    context.close();browser.close()

print(str(len(CHECKS))+' P22 browser checks passed',flush=True)
