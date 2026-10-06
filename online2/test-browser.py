"""Browser acceptance for Gomoku 1.7 Online Competition 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'online2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('ONLINE2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(22000);errors=[]
        page.add_init_script("localStorage.setItem('gomoku.v112.onboarding.seen','1')")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuOnline2 && !!window.GomokuCompetitionBridge && !!document.querySelector("#v111MenuBtn")')
        page.locator('#v111MenuBtn').click()
        page.wait_for_function('!!document.querySelector("#v12PrivateRoomMenu")')
        page.locator('#v12PrivateRoomMenu').click()
        page.locator('#oc2Home').wait_for(state='visible')
        assert page.locator('#oc2Grid .oc2-destination').count()==5
        assert page.locator('#oc2Primary').is_visible()
        assert page.locator('#roomRankedPanel').count()==1
        assert page.locator('#roomAccountPanel').count()==1
        # Anonymous online remains usable; ranked setup routes to identity rather than disabling the whole online surface.
        page.evaluate('document.querySelector("#v112WelcomeDialog")?.open && document.querySelector("#v112WelcomeDialog").close()')
        page.locator('#oc2Grid [data-route="ranked"]').click()
        assert page.locator('#roomAccountPanel').is_visible()
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#oc2Primary').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#oc2Grid .oc2-destination').first.evaluate('(e)=>e.getBoundingClientRect().height>=44')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.7 Online Competition 2.0 browser acceptance.')
