"""Storage/error-path regression tests. Storage is deliberately emulated in this harness."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review-test-output';OUT.mkdir(exist_ok=True)
html=(ROOT/'index.html').read_text();fixture=json.loads((ROOT/'review/fixture.json').read_text());passed=[]
def check(name,condition=True):
 assert condition,name
 passed.append(name);print('PASS '+name,flush=True)
def load(b,mode='normal'):
 pg=b.new_page();pg.set_content('<script>window.__reviewStore=new Map();Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__reviewStore.get(k)||null,setItem:(k,v)=>window.__reviewStore.set(k,String(v)),removeItem:k=>window.__reviewStore.delete(k),clear:()=>window.__reviewStore.clear()}});</script>'+html,wait_until='domcontentloaded');pg.wait_for_timeout(1700);pg.evaluate('(g)=>{document.querySelectorAll("dialog[open]").forEach(d=>d.close());GomokuStudio.importGame(g);}',fixture);return pg
with sync_playwright() as p:
 exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium');b=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,args=['--no-sandbox']);pg=load(b)
 pg.evaluate('GomokuReview.open()');pg.wait_for_function('GomokuReview.state().results.every(Boolean)&&!GomokuReview.state().scanning',timeout=30000)
 check('review cache persists completed judgments',pg.evaluate('JSON.parse(localStorage.getItem("gomoku.guided-review.v1")).items[0].results.filter(Boolean).length')==10)
 pg.evaluate('GomokuReview.select(7);GomokuReview.close();GomokuReview.open()');pg.wait_for_timeout(100)
 check('reopening restores full analysis and selected decision',pg.evaluate('GomokuReview.state().results.filter(Boolean).length===10&&GomokuReview.state().index===6'))
 check('export control and safety footer are visible',pg.locator('#grExport').is_visible())
 pg.evaluate('GomokuReview.close();localStorage.setItem("gomoku.guided-review.v1","{invalid");GomokuReview.open();document.getElementById("grPause").click()');check('malformed cache does not prevent opening',pg.locator('#grDialog').is_visible())
 pg.evaluate('GomokuReview.close();localStorage.removeItem("gomoku.guided-review.v1");window.__oldWorker=Worker;window.Worker=function(){throw Error("Worker blocked for test")};GomokuReview.open()');pg.wait_for_timeout(200)
 check('blocked worker produces explicit recoverable error','stopped' in pg.locator('#grFeedback').inner_text() and not pg.evaluate('GomokuReview.state().scanning'))
 pg.evaluate('window.Worker=window.__oldWorker;document.getElementById("grPause").click()');pg.wait_for_function('GomokuReview.state().results.every(Boolean)&&!GomokuReview.state().scanning',timeout=30000)
 check('analysis recovers after worker is available again')
 pg.evaluate('GomokuReview.close();localStorage.removeItem("gomoku.guided-review.v1");GomokuReview.open();GomokuReview.close()');pg.wait_for_timeout(500)
 check('closing during scan discards late worker updates',pg.evaluate('GomokuReview.state()===null'))
 # A different legal game must not inherit any prior result cache.
 short={**fixture,'moves':fixture['moves'][:6],'gameId':'other-game'}
 pg.evaluate('(g)=>{GomokuStudio.importGame(g);GomokuReview.open();document.getElementById("grPause").click()}',short)
 check('different game does not inherit cached grades',pg.evaluate('GomokuReview.state().results.every(x=>x===null)'))
 pg.evaluate('GomokuReview.close()');check('unfinished game closes review without editing its moves',len(pg.evaluate('GomokuStudio.exportGame().moves'))==6)
 b.close()
(OUT/'recovery-report.json').write_text(json.dumps({'passed':len(passed),'checks':passed,'scope':'Full HTML; explicit in-memory localStorage mock, worker failure injected. Native browser storage persistence requires an actual origin.'},indent=2))
print(f'{len(passed)} recovery checks passed',flush=True)
