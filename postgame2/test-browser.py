"""Browser acceptance for Gomoku 1.5 Post-Game Experience 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'postgame2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('POSTGAME2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(20000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && window.GomokuPostGame2 && window.GomokuReview')
        page.evaluate('GomokuPostGame2.present({winner:1,reason:"five",moves:9,winLines:[[112,113,114,115,116]]})')
        page.locator('#resultDialog').evaluate('(d)=>{if(!d.open)d.showModal()}')
        page.locator('#pg2Summary').wait_for(state='visible')
        assert page.locator('#resultAnalyzeBtn').evaluate('(e)=>getComputedStyle(e).display==="none"')
        assert page.locator('#resultCoachBtn').evaluate('(e)=>getComputedStyle(e).display==="none"')
        assert page.locator('#resultReviewBtn').is_visible()
        assert page.locator('#rematchBtn').is_visible()
        assert page.locator('#pg2Summary').text_content().strip()
        if mobile:
            assert page.locator('#resultReviewBtn').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#rematchBtn').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.5 Post-Game Experience 2.0 browser acceptance.')
