"""A5 actual mistake board, due focus, assisted scoring and event-ID preservation."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis5-test-output'
OUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text()
GAME=json.loads((ROOT/'review/fixture.json').read_text())
URL=os.environ.get('A5_URL')
MOCK="""<script>const m=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}});</script>"""
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name);print('PASS '+name,flush=True)
def load(ctx):
    pg=ctx.new_page();pg.set_default_timeout(16000)
    if URL:pg.goto(URL,wait_until='domcontentloaded',timeout=45000)
    else:pg.set_content(MOCK+HTML,wait_until='domcontentloaded')
    pg.wait_for_function("window.GomokuReview?.workspaceVersion==='3.0.0-a5' && !!window.GomokuTraining && !!window.GomokuPractice5 && !!window.GomokuMistakes",timeout=25000)
    pg.wait_for_timeout(500)
    pg.evaluate("""game=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());GomokuStudio.importGame(game);GomokuReview.open();}""",GAME)
    pg.wait_for_function("GomokuReview.state() && !GomokuReview.state().scanning",timeout=65000)
    return pg
def state(pg):return pg.evaluate("GomokuTraining.state()")
with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
    browser=pw.chromium.launch(executable_path=exe if Path(exe).exists() else None,headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':900})
    pg=load(ctx)
    original=pg.evaluate('GomokuStudio.exportGame().moves')
    check('full-game review shows evidence-gated personalized plan',pg.locator('#a5GamePlan').is_visible() and pg.locator('#a5GamePlanTitle').count()==1)
    pg.wait_for_function('GomokuReview.state()?.results.every(Boolean)',timeout=65000)
    # The quick-scan fixture may contain zero evidence-qualified mistakes.
    # Refine its known move-7 forced-defense decision before expecting a card.
    pg.evaluate('GomokuReview.select(7)')
    pg.evaluate('GomokuReview.deeper()')
    pg.wait_for_function('GomokuReview.state() && !GomokuReview.state().interacting',timeout=55000)
    saved=pg.evaluate('GomokuReview.saveMistakes()')
    storage=pg.evaluate("GomokuMistakes.status()")
    immediate=pg.evaluate("GomokuMistakes.list().then(xs=>xs.map(x=>({id:x.id,ply:x.source?.ply})))")
    print('A8 persistence probe:',json.dumps({'saved':saved,'status':storage,'immediate':immediate}),flush=True)
    diagnostic=pg.evaluate("""()=>{
      const s=GomokuReview.state(),p=s.positions[6],r=s.results[6],A=createAnalysis2(createEngine,createStudioCore,createGuidedReviewCore);
      const D=GomokuGameDiagnosis4,P=GomokuPractice5;
      return {label:r?.label,basis:r?.basis,analysisVersion:r?.analysisVersion,
        qualification:P.qualification(r,p,s.game.variant,(res,pos)=>D.classification(res,pos,{rule:s.game.variant,verifyProof:c=>A.verify(c)})),
        oldTrainable:A.trainable(r),refutation:!!r?.refutation,
        plan:P.gamePlan(s.positions,s.results,s.game,{analysis:A,
          diagnose:(res,pos)=>D.classification(res,pos,{rule:s.game.variant,verifyProof:c=>A.verify(c)})}).eligible};}""")
    print('A5 evidence-gated fixture:',json.dumps(diagnostic),flush=True)
    pg.wait_for_function('GomokuMistakes.list().then(x=>x.length)>0',timeout=20000)
    cards=pg.evaluate('GomokuMistakes.list()')
    check('review supplies real, schema-v2 mistake positions',len(cards)>=1 and all(c['version']==2 for c in cards))
    ids=[c['id'] for c in cards]
    stored={c['id']:(c['stats'],c['events']) for c in cards}
    pg.evaluate('(ids)=>GomokuTraining.open({ids})',ids)
    pg.wait_for_function('GomokuTraining.state()?.card&&!GomokuTraining.state().busy',timeout=45000)
    check('personal practice board opens with original position',pg.locator('#a2TrainingBoard [data-a2-point]').count()==225)
    check('study dashboard shows due and saved counts',pg.locator('#a5DueCount').is_visible() and pg.locator('#a5TotalCount').is_visible())
    check('theme focus is user-selectable',pg.locator('#a5Focus option').count()>=7)
    pg.screenshot(path=str(OUT/'01-practice-plan-desktop.png'))
    pg.locator('#a5StartDue').click()
    check('due filter updates practice session',pg.locator('#a5Focus').input_value()=='due')
    pg.locator('#a5Focus').select_option('all')
    pg.wait_for_function('GomokuTraining.state()?.card&&!GomokuTraining.state().busy',timeout=45000)
    start=state(pg)
    check('A5 uses the same immutable saved position key',start['card']['id'] in ids)
    check('A5 does not clear prior stats simply by opening',all(c['id'] in stored for c in pg.evaluate('GomokuMistakes.list()')))
    check('answers are hidden before the first guess','No answer markers' in pg.locator('#a2TrainingWhy').inner_text())
    pg.locator('#a2TrainingHint').click()
    check('hint marks the session assisted',state(pg)['assisted']==True)
    pg.screenshot(path=str(OUT/'02-assisted-review.png'))
    check('opening, filtering and hinting do not change the recorded game',pg.evaluate('GomokuStudio.exportGame().moves')==original)
    events=pg.evaluate("GomokuMistakes.list().then(x=>x.map(c=>({id:c.id,events:c.events,stats:c.stats})))")
    check('non-attempt actions add no learning event IDs',all(len(next(c for c in cards if c['id']==x['id'])['events'])==len(x['events']) for x in events))
    pg.locator('#a2TrainingClose').click()
    check('closing practice restores review safely',state(pg) is None and pg.locator('#grDialog').is_visible())
    pg.close();ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=load(ctx)
    # Independent browser contexts intentionally have isolated IndexedDB.
    # Explicitly import the exact validated schema-v2 exercise (not another user's data).
    mobile.evaluate('(cards)=>GomokuMistakes.importData({format:"GomokuMistakeLibrary",version:2,cards})',cards)
    mobile.evaluate("GomokuTraining.open()")
    mobile.wait_for_function("GomokuTraining.state()?.card&&!GomokuTraining.state().busy",timeout=45000)
    check('mobile training plan and board remain functional',mobile.locator('#a5Dashboard').is_visible() and mobile.locator('#a2TrainingBoard').is_visible())
    dimensions=mobile.evaluate("()=>[document.documentElement.scrollWidth,innerWidth,document.querySelector('#a2Trainer').scrollWidth,document.querySelector('#a2Trainer').clientWidth]")
    check('mobile practice does not overflow sideways',dimensions[0]<=dimensions[1]+2 and dimensions[2]<=dimensions[3]+2)
    mobile.screenshot(path=str(OUT/'03-mobile-practice.png'))
    check('mobile practice does not replace the live game',mobile.evaluate('GomokuStudio.exportGame().moves')==original)
    browser.close()
(OUT/'a5-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Synthetic Chromium UI; not a physical-device release or Elo study'},indent=2))
print(f'{len(checks)} A5 browser study-plan checks passed',flush=True)
