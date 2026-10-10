"""A17 real desktop/mobile-emulated Chromium test of OFFLINE evidence desk only.
Nothing here is a physical Android/Samsung/installed PWA acceptance.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
srv=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
thread=Thread(target=srv.serve_forever,daemon=True);thread.start()
url=f"http://127.0.0.1:{srv.server_port}/a17-evidence-desk.html"
count=0
def check(title,predicate):
    global count
    assert predicate,title
    count+=1
    print('PASS '+title,flush=True)
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
        for label,width,height in [('desktop',1280,720),('mobile-emulation',390,844)]:
            context=browser.new_context(viewport={'width':width,'height':height},
                                        is_mobile=width==390,has_touch=width==390,
                                        accept_downloads=True,reduced_motion='reduce')
            page=context.new_page()
            errors=[]
            requests=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('request',lambda request:requests.append(request.url))
            page.goto(url,wait_until='domcontentloaded')
            check(label+' release blocked',page.locator('#release-status').inner_text()=='RELEASE BLOCKED')
            check(label+' immutable 0/18 physical acceptance',page.locator('#physical-count').inner_text()=='0 / 18')
            check(label+' complete untested A11 platform matrix',page.locator('.case').count()==18)
            check(label+' all rows explicitly NOT TESTED',all(e.inner_text()=='NOT TESTED' for e in page.locator('.case em').all()))
            check(label+' mobile and desktop layout has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
            page.get_by_label('Filter platform').select_option('installed-android-pwa')
            check(label+' installed PWA has 5 untested cases',page.locator('.case').count()==5)
            page.get_by_label('Filter platform').select_option('all')
            check(label+' filter restores 18 original cases',page.locator('.case').count()==18)
            with page.expect_download() as d:
                page.get_by_role('button',name='Export untested worksheet').click()
            dl=d.value
            path=ROOT/'a17-test-export-temporary.json'
            dl.save_as(str(path))
            obj=json.loads(path.read_text())
            path.unlink()
            check(label+' downloaded worksheet is explicitly unapproved',obj['physicalAcceptance']=='OPEN' and obj['ownerAuthorization']=='not_approved')
            check(label+' downloaded 7/6/5 statuses all untested',
                  sorted(len(v['cases']) for v in obj['platforms'].values())==[5,6,7] and
                  all(x['status']=='not_tested' for v in obj['platforms'].values() for x in v['cases']))
            check(label+' no production or external requests',all(x.startswith('http://127.0.0.1:') for x in requests))
            check(label+' browser startup and export have no JS errors',not errors)
            if label=='desktop':
                page.evaluate("document.body.style.zoom='2'")
                check(label+' 200% zoom no clipped horizontal content',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
                page.evaluate("document.body.style.zoom='1'")
                page.keyboard.press('Tab')
                check('desktop keyboard focus is visible on controls',page.evaluate('document.activeElement!==document.body'))
            context.close()
        browser.close()
finally:
    srv.shutdown();srv.server_close()
print(f'{count} A17 REAL Chromium browser regressions passed on localhost. ZERO physical devices/human approvals.')
