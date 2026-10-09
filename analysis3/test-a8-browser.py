"""A8 real-origin practice persistence, non-destructive audit and recovery acceptance.
All tests use localhost Chromium with genuine IndexedDB, never fake localStorage.
"""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis8-test-output'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('A8_URL','http://127.0.0.1:8765/')
GAME=json.loads((ROOT/'review/fixture.json').read_text())
checks=[]
def check(name,value):
    assert value,name
    checks.append(name);print('PASS '+name,flush=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1280,'height':850})
    page=ctx.new_page();page.set_default_timeout(18000)
    page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function("!!window.GomokuPracticeIntegrity8&&!!window.GomokuMistakes?.audit&&!!window.GomokuReview?.deeper",timeout=24000)
    page.evaluate('g=>{document.querySelectorAll("dialog[open]").forEach(x=>x.close());GomokuStudio.importGame(g);GomokuReview.open()}',GAME)
    page.wait_for_function('GomokuReview.state()?.results.every(Boolean)&&!GomokuReview.state().scanning',timeout=75000)
    original=page.evaluate('GomokuStudio.exportGame().moves')
    page.evaluate('GomokuReview.select(7)')
    page.evaluate('GomokuReview.deeper()')
    page.wait_for_function('GomokuReview.state()?.results?.[6]?.budget>=2400&&!GomokuReview.state().interacting',timeout=65000)
    saved=page.evaluate('GomokuReview.saveMistakes()')
    cards=page.evaluate('GomokuMistakes.list()')
    check('real postgame position saved and readable',saved>0 and len(cards)>0)
    check('library uses persistent IndexedDB',page.evaluate('GomokuMistakes.status().persistent'))
    before=json.dumps(cards,sort_keys=True)
    def histories(rows):
        return json.dumps(sorted([{'id':c['id'],'board':c['board'],'stats':c['stats'],
                                  'events':c['events']} for c in rows],key=lambda x:x['id']),sort_keys=True)
    saved_history=histories(cards)
    audit=page.evaluate('GomokuMistakes.audit()')
    check('read-only library audit reports consistent recall',audit['ok'] and audit['counts']['positions']==len(cards))
    check('audit does not mutate record bytes',json.dumps(page.evaluate('GomokuMistakes.list()'),sort_keys=True)==before)
    page.evaluate('(ids)=>GomokuTraining.open({ids})',[cards[0]['id']])
    page.wait_for_function('GomokuTraining.state()?.card&&!GomokuTraining.state().busy',timeout=65000)
    check('training recovery controls visible',page.locator('#a8Audit').is_visible() and page.locator('#a8Backup').is_visible())
    page.locator('#a8Audit').click()
    page.wait_for_function("document.querySelector('#a8AuditStatus').dataset.health==='ok'",timeout=20000)
    check('verified record count shown without false cloud sync',str(len(cards)) in page.locator('#a8AuditStatus').inner_text())
    data=page.evaluate('GomokuMistakes.exportData()')
    preview=page.evaluate('(data)=>GomokuMistakes.previewImport(data)',data)
    check('backup preview recognizes already saved cards',preview['preserved']==len(cards) and preview['added']==0)
    page.evaluate('(d)=>GomokuMistakes.importData(d)',data)
    check('reimport preserves the exact original board, due dates and recall event IDs',histories(page.evaluate('GomokuMistakes.list()'))==saved_history)
    malformed=json.loads(json.dumps(data))
    malformed['cards'][0]['stats']['attempts']=-3
    failure=page.evaluate("""async backup=>{try{await GomokuMistakes.importData(backup);return false}catch{return true}}""",malformed)
    check('invalid imported practice history rejected atomically',failure and histories(page.evaluate('GomokuMistakes.list()'))==saved_history)
    page.screenshot(path=str(OUT/'a8-recovery-desktop.png'))
    page.evaluate('GomokuTraining.close();GomokuReview.close()')
    check('review/training never edited recorded moves',page.evaluate('GomokuStudio.exportGame().moves')==original)
    other=ctx.new_page()
    other.goto(BASE,wait_until='domcontentloaded',timeout=45000)
    other.wait_for_function('!!window.GomokuMistakes',timeout=16000)
    check('fresh document can reload persisted practice cards',len(other.evaluate('GomokuMistakes.list()'))==len(cards))
    check('fresh document sees valid recovery audit',other.evaluate('GomokuMistakes.audit().then(a=>a.ok)'))
    other.close()
    ctx.close();browser.close()
(OUT/'a8-browser-evidence.json').write_text(json.dumps({'passed':len(checks),'checks':checks,
 'scope':'Real Chromium IndexedDB; not physical Android or cloud backup certification'},indent=2))
print(f'{len(checks)} A8 real IndexedDB and backup recovery checks passed',flush=True)
