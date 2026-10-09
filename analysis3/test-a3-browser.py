"""A3 interactive board and review acceptance. Synthetic fixture; no release certification."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis3-test-output'
OUT.mkdir(exist_ok=True)
GAME=json.loads((ROOT/'review/fixture.json').read_text())
HTML=(ROOT/'index.html').read_text()
URL=os.environ.get('A3_URL')
MOCK="""<script>const store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()}});</script>"""
passed=[]
def check(name,valid):
    assert valid,name
    passed.append(name)
    print('PASS '+name,flush=True)
def load(ctx):
    pg=ctx.new_page();pg.set_default_timeout(15000)
    if URL: pg.goto(URL,wait_until='domcontentloaded',timeout=45000)
    else: pg.set_content(MOCK+HTML,wait_until='domcontentloaded')
    pg.wait_for_function("window.GomokuReview?.workspaceVersion==='3.0.0-a5' && !!window.GomokuAnalysisWorkspace3",timeout=25000)
    pg.wait_for_timeout(800)
    pg.evaluate("""game=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());GomokuStudio.importGame(game);GomokuReview.open();}""",GAME)
    pg.wait_for_function("GomokuReview.state()?.results.every(Boolean) && !GomokuReview.state().scanning",timeout=55000)
    pg.evaluate("GomokuReview.setPanel('analysis');GomokuReview.select(7)")
    return pg
def state(pg):return pg.evaluate('GomokuReview.state()')
def stone_count(pg):return pg.locator('#grBoard [data-stone="1"],#grBoard [data-stone="2"]').count()

with sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
    browser=pw.chromium.launch(executable_path=executable if Path(executable).exists() else None,headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':900})
    pg=load(ctx)
    original=pg.evaluate('GomokuStudio.exportGame()')
    check('board-first analysis route and visible overlay toolbar',state(pg)['panel']=='analysis' and pg.locator('#a3Command').is_visible())
    check('analysis board is not replaced with decorative art',pg.locator('#grBoard [data-point]').count()==225)
    check('engine evidence is explicit, without fabricated win percentages',pg.locator('#a3Insights').is_visible() and '%' not in pg.locator('#a3Insights').inner_text())
    check('candidate controls present accessible preview action',pg.locator('#grCandidates [data-a3-preview]').count()>0 and pg.locator('#a3LineNext').get_attribute('aria-label')=='Next variation step')
    pg.screenshot(path=str(OUT/'01-a3-desktop.png'))
    initial=stone_count(pg)
    target=int(pg.locator('[data-a3-preview]').first.get_attribute('data-a3-preview'))
    pg.locator('[data-a3-preview]').first.click()
    check('candidate preview does not mutate the board at step zero',state(pg)['a3']['preview']['move']==target and state(pg)['a3']['preview']['step']==0 and stone_count(pg)==initial)
    pg.locator('#a3LineNext').click()
    check('variation next step displays one legal move',state(pg)['a3']['preview']['step']==1 and stone_count(pg)==initial+1)
    pg.locator('#a3LinePrev').click()
    check('variation previous step restores before-position',state(pg)['a3']['preview']['step']==0 and stone_count(pg)==initial)
    pg.locator('#a3LineNext').click()
    pg.locator('#a3LineReset').click()
    check('reset does not change recorded moves',state(pg)['a3']['preview'] is None and stone_count(pg)==initial and pg.evaluate('GomokuStudio.exportGame()')==original)
    pg.locator('[data-a3-mode="threats"]').click()
    check('threat mode is distinct and explains incomplete evidence',pg.locator('[data-a3-mode="threats"]').get_attribute('aria-pressed')=='true' and pg.locator('#a3BoardStatus').inner_text()!='')
    pg.locator('[data-a3-mode="candidates"]').click()
    check('candidate marks are bounded by returned lines',pg.locator('#a3BoardSvg .a3-dot').count()<=8)
    choices=pg.locator('#grCandidates [data-a3-pin]').count()
    if choices>=2:
        pin=int(pg.locator('[data-a3-pin]').first.get_attribute('data-a3-pin'))
        other=pg.locator('[data-a3-preview]').nth(1)
        pg.locator('[data-a3-pin]').first.click();other.click()
        check('two candidates can be compared without false proof claim',pg.locator('#a3Compare').is_visible() and state(pg)['a3']['pinned']==pin and pg.locator('.a3-compare-card').count()==2)
    pg.screenshot(path=str(OUT/'02-a3-compare.png'))
    pg.evaluate("GomokuReview.setPanel('review')")
    check('analysis overlays do not leak into Guided Review',not pg.locator('#a3Command').is_visible() and pg.locator('#a3BoardSvg .a3-dot').count()==0)
    pg.evaluate("GomokuReview.setPanel('analysis')")
    check('no game history change on leaving and reentering analysis',pg.evaluate('GomokuStudio.exportGame()')==original)
    pg.close();ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=load(ctx)
    check('mobile keeps actual board present',mobile.locator('#grBoard [data-point]').count()==225 and mobile.locator('#grBoard').is_visible())
    dims=mobile.evaluate('()=>[document.documentElement.scrollWidth,innerWidth,document.querySelector("#grDialog").scrollWidth,document.querySelector("#grDialog").clientWidth]')
    check('mobile analysis avoids horizontal overflow',dims[0]<=dims[1]+1 and dims[2]<=dims[3]+1)
    mobile.locator('[data-a3-mode="line"]').click()
    check('mobile analysis modes are usable by touch',mobile.locator('[data-a3-mode="line"]').get_attribute('aria-pressed')=='true')
    mobile.screenshot(path=str(OUT/'03-a3-mobile.png'))
    check('mobile game history stays unchanged',mobile.evaluate('GomokuStudio.exportGame()')==original)
    browser.close()

(OUT/'a3-report.json').write_text(json.dumps({'passed':len(passed),'checks':passed,'scope':'Chromium browser synthetic fixture; not physical device, Elo, or proof search completeness'},indent=2))
print(str(len(passed))+' A3 interactive browser checks passed',flush=True)
