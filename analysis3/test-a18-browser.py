"""A18 real Chromium on local offline operator reviewer desk only; no physical acceptance."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
DIR=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(DIR)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/a18-original-review.html'
n=0
def verify(name,ok):
    global n
    assert ok,name
    n+=1
    print('PASS A18 browser '+name,flush=True)
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for label,width,height in [('desktop',1280,720),('mobile-viewport-emulation',390,844)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width==390,
          has_touch=width==390,accept_downloads=True,reduced_motion='reduce')
        pg=ctx.new_page()
        requests=[];errors=[]
        pg.on('request',lambda r:requests.append(r.url))
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto(url,wait_until='domcontentloaded')
        verify(label+' permanent RELEASE HOLD',pg.locator('#release-state').inner_text()=='RELEASE HOLD')
        verify(label+' real physical accepted count never more than 0/18',pg.locator('#case-count').inner_text()=='0 / 18')
        verify(label+' five real signer keys currently unprovisioned',pg.locator('#signer-status').inner_text()=='0 / 5')
        verify(label+' nine release gate rows',pg.locator('#gate-list>.row').count()==9)
        verify(label+' platform Chrome seven originals',pg.locator('#case-list li').count()==7)
        pg.locator('#platform').select_option('samsung-internet')
        verify(label+' Samsung six originals',pg.locator('#case-list li').count()==6)
        pg.locator('#platform').select_option('installed-android-pwa')
        verify(label+' installed PWA five originals',pg.locator('#case-list li').count()==5)
        pg.locator('#platform').select_option('android-chrome')
        pg.locator('#form button').click()
        verify(label+' empty observation rejected without status upgrade','Rejected' in pg.locator('#feedback').inner_text())
        pg.locator('#evidence-digest').fill('a'*64)
        pg.locator('#witness-note').fill('SYNTHETIC CI browser viewport - NOT a physical device original observation.')
        pg.locator('#form button').click()
        verify(label+' documentary observation only pending review',
          'Pending independent review' in pg.locator('#feedback').inner_text() and
          pg.locator('#case-list li small').first.inner_text()=='PENDING REVIEW')
        pg.locator('#form button').click()
        verify(label+' duplicate original case refused','Rejected' in pg.locator('#feedback').inner_text())
        with pg.expect_download() as future:
            pg.locator('#export').click()
        path=DIR/'a18-playwright-export-temporary.json'
        future.value.save_as(str(path))
        report=json.loads(path.read_text())
        path.unlink()
        verify(label+' unsigned exported packet cannot certify or deploy',
          report['format']=='GomokuA18OfflineReviewDraft' and
          report['physicalAccepted']==0 and report['ownerApproved'] is False and
          report['liveHostVerified'] is False and report['canDeploy'] is False and
          report['canCloseRelease'] is False and len(report['documentaryNotes'])==1)
        verify(label+' no horizontal document overflow',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        verify(label+' no external request or production hostname',
          all(x.startswith('http://127.0.0.1:') for x in requests))
        verify(label+' no JS startup/input error',not errors)
        if label=='desktop':
            pg.locator('#platform').focus()
            pg.keyboard.press('Tab')
            verify('desktop keyboard platform tab moves to case selector',pg.evaluate("document.activeElement?.id==='case-id'"))
            pg.evaluate("document.body.style.zoom='2'")
            verify('desktop 200% zoom remains horizontally unclipped',
              pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        ctx.close()
    browser.close()
finally:
 server.shutdown();server.server_close()
print(f'{n} A18 real desktop/mobile-emulated Chromium tests passed. ZERO physical device acceptance, remote hosted byte probes or human signatures.')
