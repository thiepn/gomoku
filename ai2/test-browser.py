from pathlib import Path
import os
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'ai2-test-output';OUT.mkdir(exist_ok=True)
url=os.environ.get('AI2_URL','http://127.0.0.1:8767/')
with sync_playwright() as p:
    b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':900});page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("document.body.dataset.ready==='true' && !!window.GomokuAI2");page.wait_for_selector('#ai2OpponentCard')
    assert page.evaluate("GomokuAI2.version")=='1.3.0';page.locator('#ai2AdaptiveToggle').check();page.wait_for_function("GomokuAI2.snapshot().adaptive===true")
    a=page.evaluate("GomokuAI2.effectiveLevel({selected:'mid',mode:'ai',rule:'renju-practice',moveCount:0,gameId:'browser-contract'})")
    z=page.evaluate("GomokuAI2.effectiveLevel({selected:'mid',mode:'ai',rule:'renju-practice',moveCount:12,gameId:'browser-contract'})");assert a==z,'Effective level changed inside one game'
    page.locator('#ai2Details').click();page.wait_for_selector('#ai2Dialog[open]');assert 'never reacts to the current game' in page.locator('#ai2DialogBody').inner_text()
    page.screenshot(path=str(OUT/'ai2-desktop.png'),full_page=True);b.close()
print('PASS AI 2.0 browser integration and in-game freeze contract.')
