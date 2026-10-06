"""Browser acceptance for Gomoku 2.0 Unified Player Journey."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'v2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('GOMOKU_V2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(24000);errors=[]
        page.add_init_script("localStorage.setItem('gomoku.v112.onboarding.seen','1')")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuV2 && !!window.GomokuStudio')
        assert page.locator('#v2HomeNav').count()==1
        assert page.locator('#v2HomeNav').evaluate('(e)=>e.parentElement.firstElementChild===e')
        # Migration-safe launch remains Play.
        assert page.locator('#v2Home').is_hidden()
        assert page.locator('main').is_visible()
        page.locator('#v2HomeNav').click()
        page.locator('#v2Home').wait_for(state='visible')
        snap=page.evaluate('window.GomokuV2.snapshot()')
        assert snap['version']=='2.0.0'
        assert snap['primary']['id']
        assert page.locator('#v2Plan .v2-plan-row').count()>=1
        assert page.locator('.v2-around-rows > button').count()==4
        assert page.locator('main').is_hidden()
        assert page.locator('#v2HomeNav').get_attribute('aria-current')=='page'
        # Existing destinations remain authoritative and return cleanly.
        page.locator('#v92Primary [data-v92-route="play"]').click()
        assert page.locator('main').is_visible()
        assert page.evaluate("document.body.dataset.v2Route||''")==''
        page.locator('#v2HomeNav').click()
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#v2Primary').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#v2HomeNav').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#v2Primary').evaluate('(e)=>e.getBoundingClientRect().height>=44')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 2.0 Unified Player Journey browser acceptance.')
