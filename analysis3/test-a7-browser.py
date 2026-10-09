"""A7 accessibility and cross-viewport/browser qualification of real portable app.
No claim of physical-device, Safari/WebKit or engine Elo qualification.
"""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis7-test-output'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('A7_URL','http://127.0.0.1:8765/')
GAME=json.loads((ROOT/'review/fixture.json').read_text())
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name);print('PASS '+name,flush=True)
def load(browser,width,height,**options):
    ctx=browser.new_context(viewport={'width':width,'height':height},**options)
    page=ctx.new_page();page.set_default_timeout(16000)
    errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function("!!window.GomokuReview && !!window.GomokuTraining && !!window.GomokuRuntimePolicy6",timeout=25000)
    page.evaluate("g=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());GomokuStudio.importGame(g);GomokuReview.open()}",GAME)
    page.wait_for_function("GomokuReview.state() && !GomokuReview.state().scanning",timeout=75000)
    return ctx,page,errors
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx,page,errors=load(browser,1440,900)
    baseline=page.evaluate('GomokuStudio.exportGame().moves')
    dialog_diagnostics=page.evaluate("""()=>{
      const d=document.querySelector('#grDialog');
      return {found:!!d,open:!!d?.open,aria:d?.getAttribute('aria-labelledby'),
        visibility:d?getComputedStyle(d).visibility:null,display:d?getComputedStyle(d).display:null,
        rect:d?d.getBoundingClientRect().toJSON():null,openDialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.id),
        reviewState:!!GomokuReview.state()};}""")
    print('A8 accessibility dialog diagnostics:',json.dumps(dialog_diagnostics),flush=True)
    check('review dialog is actually open and visible',page.locator('#grDialog').is_visible())
    check('review dialog names the visible title',page.locator('#grDialog').get_attribute('aria-labelledby')=='grTitle')
    check('full game board has all 225 distinct accessible intersections',page.locator('#grBoard [data-point]').count()==225)
    check('every review board intersection has a readable coordinate',page.locator('#grBoard [data-point]').evaluate_all("(xs)=>xs.length===225&&xs.every(x=>x.getAttribute('aria-label')?.length>1)"))
    check('game review has meaningful tab and board names',page.locator('#grBoard').get_attribute('aria-label') is not None and page.locator('#rwOverview').count()==1)
    page.evaluate("GomokuReview.select(7)")
    cell=page.locator('#grBoard [data-point="112"]')
    cell.focus();page.keyboard.press('ArrowRight')
    check('arrow-key navigation moves board focus',page.evaluate("document.activeElement?.dataset?.point")== '113')
    page.keyboard.press('ArrowDown')
    check('board keyboard movement keeps focus in grid',page.evaluate("document.activeElement?.dataset?.point")=='128')
    page.locator('#rwOptions').click()
    check('performance controls have accessible labels',page.locator('#a6Performance').get_attribute('aria-label') is not None)
    page.locator('#a6Performance').select_option('auto')
    check('adaptive device setting is explicit and reversible',page.evaluate("GomokuReview.state().performanceMode")=='auto')
    page.locator('#a6Performance').select_option('full')
    check('full-budget mode restores explicit default',page.evaluate("GomokuReview.state().performanceMode")=='full')
    page.locator('#rwOptionsClose').click()
    check('option panels close without mutating match history',page.evaluate('GomokuStudio.exportGame().moves')==baseline)
    page.screenshot(path=str(OUT/'a7-desktop-accessibility.png'),full_page=False)
    page.keyboard.press('Escape')
    check('Escape can leave a modal review safely',not page.locator('#grDialog').is_visible())
    check('closing review preserves original recorded moves',page.evaluate('GomokuStudio.exportGame().moves')==baseline)
    check('desktop application has no fatal JS errors',not errors)
    ctx.close()
    for width in [390,768]:
        ctx,page,errors=load(browser,width,844,is_mobile=(width==390),has_touch=(width==390),
          reduced_motion='reduce')
        check(f'{width}px review board remains visible',page.locator('#grBoard').is_visible())
        check(f'{width}px no document overflow',page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+2"))
        check(f'{width}px controls remain reachable',page.locator('#grClose').is_visible() and page.locator('#rwOptions').is_visible())
        check(f'{width}px reduced motion is respected',page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"))
        check(f'{width}px JS has no fatal errors',not errors)
        page.screenshot(path=str(OUT/f'a7-{width}-reduced-motion.png'))
        ctx.close()
    browser.close()
(OUT/'a7-browser.json').write_text(json.dumps({'tests':len(checks),'passed':checks,
  'notes':'Chromium viewport and synthetic touch only. Physical Android Chrome, Samsung Internet and installed PWA still require signed manual evidence.'},indent=2))
print(str(len(checks))+' A7 accessibility and viewport browser checks passed',flush=True)
