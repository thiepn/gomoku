"""Browser acceptance for Gomoku 1.7 Online Play 2.0."""
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
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuOnline2 && !!window.GomokuCompetitionBridge')
        page.locator('#onlineBtn').click()
        page.wait_for_function('document.querySelector("#op2Start")?.offsetParent!==null')
        assert page.locator('#workbenchTitle').text_content().strip()=='Play online'
        assert page.locator('#op2Choices [data-op2-route]').count()==4
        assert page.locator('#op2Choices').get_by_text('Ranked',exact=True).is_visible()
        assert page.locator('#op2Choices').get_by_text('Tournaments & players',exact=True).is_visible()
        page.locator('[data-op2-route="private"]').click()
        assert page.evaluate('document.activeElement?.id==="roomCode"')
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            for sel in ['[data-op2-route="ranked"]','[data-op2-route="competition"]','[data-op2-route="private"]','[data-op2-route="live"]']:
                assert page.locator(sel).evaluate('(e)=>e.getBoundingClientRect().height>=44')
        fake={'id':'RANK-TEST','role':'player','state':{'ranked':True,'round':2,'players':[{},{}],'game':{'result':{'winner':1}},'rankedResult':{'before':1500,'after':1512,'delta':12}}}
        snap=page.evaluate('(r)=>GomokuOnline2.present(r)',fake)
        assert snap['context']['kind']=='ranked'
        assert snap['post']['detail'].endswith('(+12)')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.7 Online Play 2.0 browser acceptance.')
