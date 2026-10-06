from pathlib import Path
import os
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'gamefeel2-test-output';OUT.mkdir(exist_ok=True)
url=os.environ.get('GAMEFEEL2_URL','http://127.0.0.1:8768/')
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={'width':1280,'height':900})
    page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("document.body.dataset.ready==='true' && !!window.GomokuGameFeel2")
    assert page.evaluate("GomokuGameFeel2.version")=='1.4.0'
    page.wait_for_selector('#gf2Layer')
    page.evaluate("window.dispatchEvent(new CustomEvent('gomoku:move',{detail:{i:112,color:1,origin:'human',move:1}}))")
    page.wait_for_function("GomokuGameFeel2.snapshot().lastMove?.point===112")
    assert page.locator('#gf2Layer').get_attribute('data-last-move')=='112'
    page.evaluate("window.dispatchEvent(new CustomEvent('gomoku:result',{detail:{winner:1,reason:'five',winLines:[[110,111,112,113,114]],moves:21}}))")
    page.wait_for_function("GomokuGameFeel2.snapshot().lastResult?.copy?.kind==='win'")
    assert page.locator('#gf2Outcome').get_attribute('data-kind')=='win'
    assert page.locator('.gf2-win-point').count()==5
    page.locator('#undoBtn').dispatch_event('click')
    page.wait_for_function("GomokuGameFeel2.snapshot().lastAction==='undo'")
    page.screenshot(path=str(OUT/'gamefeel2-desktop.png'),full_page=True)
    b.close()
    br=p.chromium.launch(headless=True)
    mobile=br.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    mobile.goto(url,wait_until='domcontentloaded')
    mobile.wait_for_function("document.body.dataset.ready==='true' && !!window.GomokuGameFeel2")
    assert mobile.evaluate("GomokuGameFeel2.snapshot().reduced") is True
    mobile.evaluate("window.dispatchEvent(new CustomEvent('gomoku:result',{detail:{winner:1,reason:'five',winLines:[[110,111,112,113,114]],moves:21}}))")
    mobile.wait_for_function("GomokuGameFeel2.snapshot().lastResult?.copy?.kind==='win'")
    assert mobile.locator('.gf2-fleck').count()==0
    mobile.screenshot(path=str(OUT/'gamefeel2-mobile-reduced.png'),full_page=True)
    br.close()
print('PASS Game Feel 2.0 desktop, mobile and reduced-motion acceptance.')
