"""Browser acceptance for Gomoku 1.9 Library & Archive 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'library2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('LIBRARY2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(22000);errors=[]
        page.add_init_script("localStorage.setItem('gomoku.v112.onboarding.seen','1')")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuLibrary2 && !!window.GomokuStudio')
        page.locator('#v92Primary [data-v92-route="library"]').click()
        page.locator('#lib2Home').wait_for(state='visible')
        snap=page.evaluate('window.GomokuLibrary2.snapshot()')
        assert snap['version']=='1.9.0'
        assert snap['counts']['total']==0
        assert page.locator('#lib2Primary').is_visible()
        page.locator('#lib2Search').fill('opening')
        assert page.locator('#librarySearch').input_value()=='opening'
        page.locator('#lib2Clear').click()
        assert page.locator('#librarySearch').input_value()==''
        assert page.locator('.lib2-actions button').count()==4
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#lib2Primary').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('#lib2Search').evaluate('(e)=>e.getBoundingClientRect().height>=44')
            assert page.locator('.lib2-metrics button').first.evaluate('(e)=>e.getBoundingClientRect().height>=44')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.9 Library & Archive 2.0 browser acceptance.')
