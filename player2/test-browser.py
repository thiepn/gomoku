"""Browser acceptance for Gomoku 2.0 Player Journey & Home 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'player2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('PLAYER2_URL');fixture=json.loads((ROOT/'review/fixture.json').read_text())
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(22000);errors=[]
        page.add_init_script("localStorage.setItem('gomoku.v112.onboarding.seen','1')")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuPlayer2 && !!window.GomokuStudio')
        page.locator('#pj2Home').wait_for(state='visible')
        snap=page.evaluate('window.GomokuPlayer2.snapshot()')
        assert snap['version']=='2.0.0'
        assert len(snap['stages'])==4 and len(snap['threads'])==4
        assert page.locator('#pj2HomeNav').get_attribute('aria-current')=='page'
        assert page.locator('#pj2Stages .pj2-stage').count()==4
        assert page.locator('#pj2Threads .pj2-thread').count()==4
        page.locator('#v92Primary [data-v92-route="play"]').click()
        page.locator('#mainContent').wait_for(state='visible')
        assert page.locator('#pj2Home').is_hidden()
        page.locator('#pj2HomeNav').click()
        page.locator('#pj2Home').wait_for(state='visible')
        assert page.locator('#v92Primary [data-v92-route="play"]').get_attribute('aria-current')=='false'
        if not mobile:
            page.evaluate('(g)=>{document.querySelectorAll("dialog[open]").forEach(d=>d.close());GomokuStudio.importGame(g);}',fixture)
            page.evaluate('document.getElementById("resultReviewBtn").click()')
            page.locator('#grDialog').wait_for(state='visible')
            page.wait_for_timeout(2300)
            assert not errors,errors
            page.keyboard.press('Escape')
            page.locator('#grDialog').wait_for(state='hidden')
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#pj2Primary').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#pj2Stages .pj2-stage').first.evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#pj2HomeNav').evaluate('(e)=>e.getBoundingClientRect().height>=39')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 2.0 Player Journey & Home browser acceptance.')
