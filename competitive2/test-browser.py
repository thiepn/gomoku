"""Browser acceptance for Gomoku 1.6 Competitive Play 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'competitive2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('COMPETITIVE2_URL')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for name,viewport,mobile in [('desktop',{'width':1360,'height':960},False),('mobile',{'width':390,'height':844},True)]:
        ctx=b.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(22000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('document.body.dataset.uiReady==="true" && !!window.GomokuCompetitive2 && !!window.GomokuPostGame2 && typeof window.GomokuStudio?.startCompetitivePlay==="function"')
        page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
        page.evaluate('()=>GomokuStudio.startCompetitivePlay({mode:"ai",rule:"renju-practice",opening:"free",minutes:10,increment:5,total:3,level:"mid",color:1,names:{p1:"You",p2:"Computer"},label:"Acceptance"})')
        page.wait_for_function('GomokuStudio.competitivePlay()?.config?.total===3')
        page.evaluate('GomokuCompetitive2.refresh()')
        page.locator('#cp2Series').wait_for(state='visible')
        assert 'Game 1 of 3' in page.locator('#cp2SeriesLabel').text_content()
        assert page.locator('#cp2SeriesProgress').get_attribute('max')=='3'
        assert page.locator('#v97MatchStrip').is_visible()
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            assert page.locator('#v97ResumeClock').evaluate('(e)=>e.hidden || e.getBoundingClientRect().height>=40')
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        assert not errors,errors
        ctx.close()
    b.close()
(OUT/'summary.json').write_text(json.dumps({'profiles':['desktop','mobile'],'status':'pass'},indent=2))
print('PASS Gomoku 1.6 Competitive Play 2.0 browser acceptance.')
