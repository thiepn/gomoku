"""A10 extracted-A9 static preview acceptance on real Chromium HTTP origin.
Physical Chrome/Samsung Internet/installed Android PWA remain unverified.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import hashlib,json,os
ROOT=Path(__file__).resolve().parents[1]
SITE=Path(os.environ.get("A10_SITE_ROOT",str(ROOT/"analysis10-test-output/preview-static")))
OUT=ROOT/"analysis10-test-output"
receipt=json.loads((OUT/"a10-verified-preview.json").read_text())
checks=[]
def check(name,truth):
    assert truth,name
    checks.append(name);print("PASS "+name,flush=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(SITE)))
thread=Thread(target=server.serve_forever,daemon=True);thread.start()
url=f"http://127.0.0.1:{server.server_port}/"
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
        for width,height in [(390,844),(768,1024),(1440,900)]:
            ctx=browser.new_context(viewport={"width":width,"height":height},is_mobile=width==390,
                has_touch=width==390,reduced_motion="reduce",service_workers="allow")
            pg=ctx.new_page();errors=[]
            pg.on("pageerror",lambda e:errors.append(str(e)))
            pg.goto(url,wait_until="domcontentloaded",timeout=45000)
            pg.wait_for_function("!!window.GomokuStudio&&!!window.GomokuMistakes&&!!window.GomokuReview",timeout=28000)
            check(f"{width}px packaged game/review/trainer initialized",pg.evaluate("!!GomokuStudio&&!!GomokuReview&&!!GomokuMistakes"))
            check(f"{width}px no horizontal document overflow",pg.evaluate("document.documentElement.scrollWidth<=innerWidth+2"))
            check(f"{width}px reduced-motion setting active",pg.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"))
            check(f"{width}px no startup JS errors",not errors)
            if width==390:
                # The isolated HTTP origin verifies service worker behavior. All live
                # human Android checks must be repeated on a real HTTPS phone preview.
                reg=pg.evaluate("navigator.serviceWorker.ready.then(r=>({scope:r.scope,active:!!r.active}))")
                check("candidate PWA service worker registered for its own root",reg["active"] and reg["scope"]==url)
                if not pg.evaluate("!!navigator.serviceWorker.controller"):
                    pg.reload(wait_until="domcontentloaded")
                pg.wait_for_function("!!navigator.serviceWorker.controller",timeout=25000)
                check("candidate service worker actively controls app",pg.evaluate("!!navigator.serviceWorker.controller"))
                asset=pg.evaluate("""async()=>{
                  const result={};
                  for(const p of ['manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-icon-512.png']){
                    const r=await fetch('./'+p);result[p]={ok:r.ok,size:(await r.arrayBuffer()).byteLength};
                  }return result}""")
                check("manifest and all installable icons are available",
                      all(x["ok"] and x["size"]>100 for x in asset.values()))
                manifest=pg.evaluate("fetch('./manifest.webmanifest').then(r=>r.json())")
                check("manifest supports isolated standalone PWA install",
                    manifest.get("display")=="standalone" and
                    manifest.get("start_url")=="./" and manifest.get("scope")=="./")
                ctx.set_offline(True)
                pg.reload(wait_until="domcontentloaded",timeout=30000)
                pg.wait_for_function("!!window.GomokuStudio&&!!window.GomokuMistakes",timeout=23000)
                check("synthetic Android viewport reloads from offline installed shell",
                    pg.evaluate("!!GomokuStudio&&!!GomokuMistakes"))
                check("offline PWA preserves active service worker controller",
                    pg.evaluate("!!navigator.serviceWorker.controller"))
                ctx.set_offline(False)
                # The SW MUST NOT forge a successful HTML page for an unrelated path.
                result=pg.evaluate("""async()=>{
                  const r=await fetch('./a10-not-the-app-route',{cache:'no-store'});
                  return {status:r.status,text:(await r.text()).slice(0,100)}
                }""")
                check("offline shell does not poison arbitrary sibling routes",result["status"]==404)
                check("network reconnect retains playable shell",pg.evaluate("!!window.GomokuStudio"))
                pg.screenshot(path=str(OUT/"a10-mobile-packaged.png"),full_page=False)
            if width==768:pg.screenshot(path=str(OUT/"a10-tablet-packaged.png"),full_page=False)
            ctx.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
(OUT/"a10-browser.json").write_text(json.dumps({"status":"passed","count":len(checks),"checks":checks,
 "notes":"Real Chromium over localhost; synthetic touch/mobile only, not physical device or hosted HTTPS preview."},indent=2)+"\n")
print(f"{len(checks)} A10 packaged PWA/device-emulation checks passed")
