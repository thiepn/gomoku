"""Browser acceptance for Gomoku 1.7 Competition Hub 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'competitionhub2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('COMPETITIONHUB2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(22000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuCompetitionHub2 && !!window.GomokuCompetitionBridge && !!window.GomokuCompetitive2')
        page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
        page.evaluate('GomokuCompetitionHub2.open()')
        page.locator('#ch2Dialog').wait_for(state='visible')
        assert page.locator('#ch2Grid .ch2-card').count()==5
        assert page.locator('#ch2Grid [data-id="local"]').is_visible()
        assert page.locator('#ch2Grid [data-id="ranked"]').is_visible()
        assert page.locator('#ch2Grid [data-id="tournaments"]').is_visible()
        assert page.locator('#ch2Grid [data-id="community"]').is_visible()
        assert page.locator('#ch2Grid [data-id="rooms"]').is_visible()
        snap=page.evaluate('GomokuCompetitionHub2.snapshot()')
        assert snap['current']['kind']=='none'
        page.locator('#ch2Grid [data-id="local"]').click()
        page.locator('#v97CompetitiveDialog').wait_for(state='visible')
        page.locator('#v97Close').click()
        page.evaluate('GomokuCompetitionHub2.open()')
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#ch2Close').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#ch2Grid [data-id="ranked"]').evaluate('(e)=>e.getBoundingClientRect().height>=44')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.7 Competition Hub 2.0 browser acceptance.')
