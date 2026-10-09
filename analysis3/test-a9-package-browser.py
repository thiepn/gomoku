"""A9 installable candidate smoke check against extracted ZIP (real HTTP + offline Chromium).
This is *not* physical Android Chrome/Samsung Internet/PWA qualification.
"""
from pathlib import Path
import functools
import http.server
import json
import os
import tempfile
import threading
import zipfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis9-test-output'
ZIP=OUT/'gomoku-analysis3-a9-offline-candidate.zip'
checks=[]
def check(label,ok):
    assert ok,label
    checks.append(label)
    print('PASS '+label,flush=True)

with tempfile.TemporaryDirectory(prefix='gomoku-a9-package-') as tmp:
    extracted=Path(tmp)
    with zipfile.ZipFile(ZIP) as z:
        z.extractall(extracted)
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(extracted))
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    base='http://127.0.0.1:'+str(server.server_port)+'/'
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            context=browser.new_context(service_workers='allow',viewport={'width':390,'height':844},
                is_mobile=True,has_touch=True)
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base,wait_until='domcontentloaded',timeout=45000)
            page.wait_for_function('!!window.GomokuStudio&&!!window.GomokuReview&&!!window.GomokuMistakes',timeout=25000)
            check('A9 unpacked offline candidate initializes actual Gomoku game and learning modules',
                page.evaluate('!!GomokuStudio&&!!GomokuReview&&!!GomokuMistakes'))
            manifest=page.evaluate("""async()=>{const r=await fetch('./manifest.webmanifest');return r.json()}""")
            check('A9 installed PWA manifest has standalone scoped launch',
                manifest.get('display')=='standalone' and manifest.get('scope')=='./' and
                manifest.get('start_url')=='./')
            icons=page.evaluate("""async()=>Promise.all(['icon-192.png','icon-512.png','maskable-icon-512.png'].map(async name=>{
              const r=await fetch('./icons/'+name);return {ok:r.ok,type:r.headers.get('content-type')}}))""")
            check('A9 packaged PWA icons are reachable from extracted archive',
                all(x['ok'] and 'image/png' in (x['type'] or '') for x in icons))
            page.wait_for_function('navigator.serviceWorker&&navigator.serviceWorker.ready',timeout=20000)
            page.evaluate('navigator.serviceWorker.ready')
            if not page.evaluate('navigator.serviceWorker.controller!==null'):
                page.reload(wait_until='domcontentloaded',timeout=30000)
            page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
            check('A9 real Chromium controls unpacked application with packaged SW',
                page.evaluate('!!navigator.serviceWorker.controller'))
            ctx_cache=page.evaluate("""async()=>{
              const keys=await caches.keys();const v=await navigator.serviceWorker.ready;
              return {keys,scope:v.scope}}""")
            check('A9 scoped offline shell cache created from package',
                any(x.startswith('gomoku-') for x in ctx_cache['keys']) and ctx_cache['scope']==base)
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded',timeout=40000)
            page.wait_for_function('!!window.GomokuStudio&&!!window.GomokuMistakes',timeout=30000)
            check('A9 extracted PWA fully reloads offline with actual game and practice engine',
                page.evaluate('!!GomokuStudio&&!!GomokuMistakes'))
            check('A9 offline reload has no uncaught JavaScript startup exceptions',not errors)
            context.set_offline(False)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
OUT.mkdir(exist_ok=True)
(OUT/'a9-package-browser.json').write_text(json.dumps({'checks':checks,'passed':len(checks),
 'limitation':'Real Chromium HTTP+offline emulation. No physical Android or cloud deployment.'},indent=2)+'\n')
print(f'{len(checks)} A9 package HTTP/Chromium smoke checks passed',flush=True)
